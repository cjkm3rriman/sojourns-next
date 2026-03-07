import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  documents,
  trips,
  users,
  memberships,
  items,
  places,
} from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import OpenAI from 'openai';
import { validatePhoneNumber } from '@/lib/validation';
import { analyzeWithAI, processExtractedItems } from './utils/core-analyzer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Get authenticated user
    const { getAuth } = await import('@clerk/nextjs/server');
    const authResult = getAuth(request);
    const { userId } = authResult;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tripId = id;

    // Get user and verify trip access
    const db = getDb();
    const userResult = await db
      .select({
        userId: users.id,
        organizationId: memberships.organizationId,
      })
      .from(users)
      .leftJoin(memberships, eq(memberships.userId, users.id))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }

    const { userId: dbUserId, organizationId } = userResult[0];

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    // Verify trip exists and user has access
    const tripResult = await db
      .select()
      .from(trips)
      .where(
        and(eq(trips.id, tripId), eq(trips.organizationId, organizationId)),
      )
      .limit(1);

    if (tripResult.length === 0) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 },
      );
    }

    const trip = tripResult[0];

    // Get all PDF documents for this trip (including failed ones for retry, excluding ignored)
    const pdfDocuments = await db
      .select({
        id: documents.id,
        originalName: documents.originalName,
        r2Key: documents.r2Key,
        openaiFileId: documents.openaiFileId,
        status: documents.status,
      })
      .from(documents)
      .where(
        and(
          eq(documents.tripId, tripId),
          eq(documents.mimeType, 'application/pdf'),
          // Allow both 'uploaded' and 'failed' status for retry capability, but exclude 'ignored'
          or(eq(documents.status, 'uploaded'), eq(documents.status, 'failed')),
        ),
      );

    if (pdfDocuments.length === 0) {
      return NextResponse.json(
        {
          error: 'No PDF documents available for analysis',
          userMessage:
            'No PDF documents found for this trip. Please upload some PDFs first! 📄✨',
        },
        { status: 400 },
      );
    }

    const analyzedDocuments: string[] = [];
    const createdItems: any[] = [];
    const createdPlaces: any[] = [];

    // Process each PDF document
    for (const doc of pdfDocuments) {
      try {
        // Update document status to processing
        await db
          .update(documents)
          .set({ status: 'processing' })
          .where(eq(documents.id, doc.id));

        // Step 1: Get or create vector store for this trip
        let vectorStoreId = trip.vectorStoreId;

        if (!vectorStoreId) {
          console.log(`Creating new vector store for trip ${tripId}...`);
          const vectorStore = await openai.vectorStores.create({
            name: `Trip ${trip.clientName} - ${tripId}`,
          });
          vectorStoreId = vectorStore.id;

          // Store vector store ID in database
          await db
            .update(trips)
            .set({ vectorStoreId: vectorStoreId })
            .where(eq(trips.id, tripId));

          console.log(`Created vector store: ${vectorStoreId}`);
        } else {
          console.log(`Reusing existing vector store: ${vectorStoreId}`);
        }

        // Step 2: Check if document is already in vector store
        let openaiFileId = doc.openaiFileId;

        if (!openaiFileId) {
          // First, check if a file with the same name already exists in the vector store
          console.log(
            `Checking if ${doc.originalName} already exists in vector store...`,
          );

          const existingFiles =
            await openai.vectorStores.files.list(vectorStoreId);
          const existingFile = existingFiles.data.find(
            (f) => f.id && f.id.includes(doc.originalName.replace(/\s+/g, '_')),
          );

          if (existingFile) {
            console.log(
              `Found existing file in vector store: ${existingFile.id}`,
            );
            openaiFileId = existingFile.id;

            // Update our database to remember this file ID
            await db
              .update(documents)
              .set({ openaiFileId: openaiFileId })
              .where(eq(documents.id, doc.id));

            console.log(
              `Reusing existing file ${doc.originalName} from vector store`,
            );
          } else {
            console.log(
              `File not found in vector store, uploading ${doc.originalName}...`,
            );

            // Get document from R2
            const getObjectCommand = new GetObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: doc.r2Key,
            });

            const response = await r2Client.send(getObjectCommand);
            const documentContent = await response.Body?.transformToByteArray();

            if (!documentContent) {
              throw new Error('Failed to retrieve document content');
            }

            // Upload PDF to vector store
            const fileBuffer = Buffer.from(documentContent);
            const openaiFile =
              await openai.vectorStores.fileBatches.uploadAndPoll(
                vectorStoreId,
                {
                  files: [
                    new File([fileBuffer], doc.originalName, {
                      type: 'application/pdf',
                    }),
                  ],
                },
              );

            openaiFileId =
              openaiFile.file_counts.completed > 0
                ? (
                    await openai.vectorStores.files.list(vectorStoreId, {
                      limit: 1,
                    })
                  ).data[0]?.id
                : null;

            if (!openaiFileId) {
              throw new Error('Failed to upload file to vector store');
            }

            // Store the OpenAI file ID in our database
            await db
              .update(documents)
              .set({ openaiFileId: openaiFileId })
              .where(eq(documents.id, doc.id));

            console.log(
              `Uploaded ${doc.originalName} to vector store:`,
              openaiFileId,
            );
          }
        } else {
          console.log(`File already in vector store: ${openaiFileId}`);
        }

        // Step 3: Use GPT-5.2 Responses API with vector store
        const userMessage = `Extract flight, hotel, transfer, activity, AND restaurant information from "${doc.originalName}". Return JSON with flights (flight number, departure/arrival times, class, confirmation), hotels (hotel name, check-in/out times, room category, perks, confirmation), transfers (contact name, pickup/dropoff times, transfer type, vehicle info, confirmation), activities (activity name, start/end times, activity type, contact, service, confirmation), and restaurants (restaurant name, reservation times, cuisine type, party size, confirmation).`;

        console.log('Analyzing document with GPT-5.2 Responses API...');

        // Use utility to analyze document with AI
        const extractedData = await analyzeWithAI(
          userMessage,
          vectorStoreId,
          openai,
        );

        // Process extracted items and create database records
        console.log(`Processing extracted items for trip ${tripId}...`);
        await processExtractedItems(
          extractedData,
          tripId,
          db,
          createdPlaces,
          createdItems,
        );

        // Update document status and save extracted data
        await db
          .update(documents)
          .set({
            status: 'processed',
            extractedData: JSON.stringify(extractedData),
          })
          .where(eq(documents.id, doc.id));

        analyzedDocuments.push(doc.originalName);
      } catch (error: any) {
        // Log detailed error information for debugging
        console.error(`Error processing document ${doc.originalName}:`, error);
        console.error('Full error object:', JSON.stringify(error, null, 2));

        // Handle OpenAI-specific errors first
        if (error?.error?.code === 'insufficient_quota') {
          throw new Error(
            'OpenAI API quota exceeded. Please add credits to your OpenAI account.',
          );
        } else if (error?.error?.code === 'invalid_api_key') {
          throw new Error(
            'Invalid OpenAI API key. Please check your configuration.',
          );
        } else if (error?.error?.type === 'invalid_request_error') {
          console.error(
            'Invalid request error details:',
            error?.error?.message,
          );
          throw new Error(
            `Invalid request to OpenAI API: ${error?.error?.message || 'Please try again.'}`,
          );
        } else if (
          error?.code === 'ECONNREFUSED' ||
          error?.code === 'ENOTFOUND'
        ) {
          throw new Error(
            'Unable to connect to OpenAI API. Please check your internet connection.',
          );
        } else if (error?.status === 400) {
          console.error('Bad request to OpenAI API:', error?.error);
          throw new Error(
            `OpenAI API bad request: ${error?.error?.message || 'Check request parameters.'}`,
          );
        } else if (error?.status === 404) {
          console.error('OpenAI resource not found:', error?.error);
          throw new Error(
            `OpenAI resource not found. The file or assistant may have been deleted.`,
          );
        }

        // Update document status to failed
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await db
          .update(documents)
          .set({
            status: 'failed',
            errorMessage,
          })
          .where(eq(documents.id, doc.id));

        // If it's an OpenAI quota error, we should stop processing and return immediately
        if (
          error instanceof Error &&
          error.message.includes('quota exceeded')
        ) {
          throw error; // Re-throw to stop processing other documents
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Analysis complete. Processed ${analyzedDocuments.length} documents.`,
      analyzedDocuments,
      createdItems: createdItems.length,
      createdPlaces: createdPlaces.length,
      items: createdItems,
      places: createdPlaces,
    });
  } catch (error) {
    console.error('Error analyzing documents:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    let statusCode = 500;

    // Provide more specific error responses
    if (errorMessage.includes('quota exceeded')) {
      statusCode = 402; // Payment Required
    } else if (
      errorMessage.includes('invalid_api_key') ||
      errorMessage.includes('Unauthorized')
    ) {
      statusCode = 401; // Unauthorized
    } else if (errorMessage.includes('No PDF documents found')) {
      statusCode = 400; // Bad Request
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze documents',
        details: errorMessage,
        userMessage: errorMessage.includes('quota exceeded')
          ? 'Oops! Looks like Sojourns forgot to top up their AI credits. Hold tight while we sort this out! 🤖💳'
          : errorMessage.includes('invalid_api_key')
            ? 'Our AI assistant is having a bit of trouble connecting. Please contact support.'
            : errorMessage.includes('Failed to parse AI response')
              ? 'Our AI had trouble understanding the document format. The analysis completed with basic items created - you can review and edit them manually! 🤖📄'
              : errorMessage,
      },
      { status: statusCode },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
