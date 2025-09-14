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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get authenticated user
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;

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

    const analyzedDocuments = [];
    const createdItems = [];
    const createdPlaces = [];

    // Process each PDF document
    for (const doc of pdfDocuments) {
      try {
        // Update document status to processing
        await db
          .update(documents)
          .set({ status: 'processing' })
          .where(eq(documents.id, doc.id));

        // Check if we already have an OpenAI file ID for this document
        let openaiFileId = doc.openaiFileId;

        if (!openaiFileId) {
          console.log(
            `No existing OpenAI file for ${doc.originalName}, uploading...`,
          );

          // Get document from R2 and upload to OpenAI Files API
          const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: doc.r2Key,
          });

          const response = await r2Client.send(getObjectCommand);
          const documentContent = await response.Body?.transformToByteArray();

          if (!documentContent) {
            throw new Error('Failed to retrieve document content');
          }

          // Upload PDF to OpenAI Files API
          const fileBuffer = Buffer.from(documentContent);
          const openaiFile = await openai.files.create({
            file: new File([fileBuffer], doc.originalName, {
              type: 'application/pdf',
            }),
            purpose: 'assistants',
          });

          openaiFileId = openaiFile.id;

          // Store the OpenAI file ID in our database
          await db
            .update(documents)
            .set({ openaiFileId: openaiFileId })
            .where(eq(documents.id, doc.id));

          console.log(
            `Uploaded ${doc.originalName} to OpenAI Files:`,
            openaiFileId,
          );
        } else {
          console.log(
            `Reusing existing OpenAI file for ${doc.originalName}:`,
            openaiFileId,
          );

          // Verify the file still exists in OpenAI
          try {
            await openai.files.retrieve(openaiFileId);
            console.log(`Verified OpenAI file exists: ${openaiFileId}`);
          } catch (fileError: any) {
            console.warn(
              `OpenAI file ${openaiFileId} not found, re-uploading...`,
            );

            // Re-upload the file
            const getObjectCommand = new GetObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: doc.r2Key,
            });

            const response = await r2Client.send(getObjectCommand);
            const documentContent = await response.Body?.transformToByteArray();

            if (!documentContent) {
              throw new Error(
                'Failed to retrieve document content for re-upload',
              );
            }

            const fileBuffer = Buffer.from(documentContent);
            const openaiFile = await openai.files.create({
              file: new File([fileBuffer], doc.originalName, {
                type: 'application/pdf',
              }),
              purpose: 'assistants',
            });

            openaiFileId = openaiFile.id;

            // Update the database with new file ID
            await db
              .update(documents)
              .set({ openaiFileId: openaiFileId })
              .where(eq(documents.id, doc.id));

            console.log(
              `Re-uploaded ${doc.originalName} to OpenAI Files:`,
              openaiFileId,
            );
          }
        }

        // Create assistant with file search capabilities
        console.log('Creating assistant for document analysis...');
        const assistant = await openai.beta.assistants.create({
          name: `Travel Analyzer ${Date.now()}`, // Unique name to avoid conflicts
          instructions: `You are an expert travel itinerary analyzer. Carefully analyze uploaded travel documents and extract ALL travel-related information to create comprehensive structured itinerary items.

CRITICAL: Look for ALL types of travel components including:
- ✈️ FLIGHTS: Departures, arrivals, connections, flight numbers, times, terminals
- 🚗 TRANSFERS: ALL ground/water transportation - airport shuttles, taxis, private cars, trains, buses, car rentals, ferries, cruises, metro, uber, etc.
- 🏨 ACCOMMODATIONS: Hotels, resorts, B&Bs, vacation rentals, check-in/out times
- 🍽️ DINING: Restaurant reservations, meal bookings, special dinners, food tours
- 🎭 ACTIVITIES: Tours, excursions, shows, tickets, experiences, attractions

PAY SPECIAL ATTENTION TO:
- Airport transfers (pickup/drop-off services, shuttle buses, taxi vouchers)
- Transportation between locations (city-to-city travel, intercity transfers)
- Connection flights and layovers as separate items
- Meal reservations and dining experiences
- Tour pickups and activity transportation
- Any mentions of "transfer," "pickup," "shuttle," "transport," or "car service"

Database Schema Context:
- Places: reusable entities like hotels, restaurants, attractions with fields: name, type (must be one of: "hotel", "restaurant", "attraction", "venue"), address, phone, email, website, description, priceRange, rating
- Items: individual itinerary items with fields: type (must be one of: "flight", "hotel", "transfer", "restaurant", "activity"), title, description, startDate, endDate, timezone, location, cost, status

Return a JSON response with this structure:
{
  "places": [
    {
      "name": "Hotel Name",
      "type": "hotel",
      "address": "Full address",
      "phone": "phone number",
      "email": "email if available",
      "website": "website if available",
      "description": "hotel description",
      "priceRange": "price range like $$$ or Luxury",
      "rating": "rating if available"
    }
  ],
  "items": [
    {
      "type": "flight|hotel|transfer|restaurant|activity",
      "title": "For ACTIVITIES only: descriptive title (e.g., 'Wine Tasting Tour', 'City Walking Tour'). For flights/hotels/transfers/restaurants: use simple generic title - the system will auto-generate better ones",
      "description": "Detailed description with all important details (flight numbers, vehicle type, company, confirmation numbers, etc.)",
      "startDate": "ISO datetime string (e.g., 2024-03-15T10:30:00)",
      "endDate": "ISO datetime string (e.g., 2024-03-15T12:00:00)",
      "timezone": "timezone like Europe/Rome",
      "location": "Primary location (for hotels/restaurants/activities)",
      "originLocation": "For flights/transfers: departure point (e.g., 'JFK Airport', 'Hotel Grand Plaza')",
      "destinationLocation": "For flights/transfers: arrival point (e.g., 'Rome Fiumicino', 'City Center')",
      "cost": "cost information",
      "status": "confirmed",
      "placeId": "reference to place if applicable (use place name as temp identifier)"
    }
  ]
}

EXAMPLES of what to extract as "transfer" items (ALL non-flight transportation):
- "Airport pickup at 2:00 PM" → transfer item with originLocation: "Airport", destinationLocation: "Hotel"
- "Shuttle to hotel included" → transfer item with destinationLocation: "Hotel"
- "Private car service to restaurant" → transfer item with originLocation: "Hotel", destinationLocation: "Restaurant Name"
- "Train from Paris to Lyon" → transfer item with originLocation: "Paris", destinationLocation: "Lyon"
- "Taxi voucher from hotel to airport" → transfer item with originLocation: "Hotel", destinationLocation: "Airport"
- "Ferry to Capri island" → transfer item with originLocation: "Naples", destinationLocation: "Capri"
- "Uber ride to venue" → transfer item with destinationLocation: "Venue"
- "Rental car pickup" → transfer item with originLocation: "Rental Agency"
- "Cruise ship boarding" → transfer item with originLocation: "Port", destinationLocation: "Ship/Cruise"

EXAMPLES of what to extract as "flight" items:
- "Flight AA123 JFK to FCO departure 10:30 AM" → flight item with originLocation: "JFK Airport", destinationLocation: "Rome Fiumicino (FCO)"
- "Return flight Rome to New York" → flight item with originLocation: "Rome", destinationLocation: "New York"

Be thorough and extract EVERY travel component mentioned. If timing isn't specified, estimate reasonable times based on context. If you cannot extract specific information, use reasonable defaults or null values.

IMPORTANT: Return ONLY valid JSON in your response. Do not include any explanations, markdown formatting, or additional text. Your entire response should be parseable JSON starting with { and ending with }.`,
          model: 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
        });

        console.log(`Created assistant:`, assistant.id);

        // Create a thread with the uploaded file
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: 'user',
              content: `Analyze the uploaded travel document "${doc.originalName}" and extract all travel-related information including flights, hotels, restaurants, activities, and any other bookings or reservations. Return the analysis as structured JSON.`,
              attachments: [
                {
                  file_id: openaiFileId,
                  tools: [{ type: 'file_search' }],
                },
              ],
            },
          ],
        });

        console.log(`Created thread:`, thread.id);

        // Run the assistant and poll for completion
        const runStatus = await openai.beta.threads.runs.createAndPoll(
          thread.id,
          {
            assistant_id: assistant.id,
          },
        );

        console.log(`Run completed with status:`, runStatus.status);

        if (runStatus.status === 'failed') {
          throw new Error(
            `Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`,
          );
        }

        // Get the response
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data.find(
          (msg) => msg.role === 'assistant',
        );

        if (
          !assistantMessage ||
          !assistantMessage.content[0] ||
          assistantMessage.content[0].type !== 'text'
        ) {
          throw new Error('No analysis result from assistant');
        }

        const analysisResult = assistantMessage.content[0].text.value;

        // Clean up resources
        try {
          await openai.beta.assistants.delete(assistant.id);

          // Only delete the file if we just uploaded it (not if we reused an existing one)
          if (!doc.openaiFileId) {
            await openai.files.delete(openaiFileId);
            console.log('Cleaned up assistant and newly uploaded file');
          } else {
            console.log('Cleaned up assistant (kept existing file for reuse)');
          }
        } catch (cleanupError) {
          console.warn('Error cleaning up resources:', cleanupError);
        }

        console.log(`AI Response for ${doc.originalName}:`, analysisResult);

        // Parse the JSON response with detailed error handling
        let extractedData;
        try {
          // First try to find JSON within the response if it's wrapped in markdown or other text
          let jsonString = analysisResult;

          // Check if response is wrapped in code blocks
          const codeBlockMatch = analysisResult.match(
            /```(?:json)?\s*([\s\S]*?)\s*```/,
          );
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
            console.log('Found JSON in code block:', jsonString);
          }

          extractedData = JSON.parse(jsonString);
          console.log('Successfully parsed AI response:', extractedData);
        } catch (parseError) {
          console.error('JSON Parse Error Details:');
          console.error('Original AI Response:', analysisResult);
          console.error('Parse Error:', parseError);

          // Fallback: Create a basic item based on the document name
          console.log(
            `Falling back to basic item creation for ${doc.originalName}`,
          );

          extractedData = {
            places: [],
            items: [
              {
                type: 'activity',
                title: `Document: ${doc.originalName}`,
                description: `AI analysis failed for this document. Please review manually. Original response: ${analysisResult.substring(0, 100)}...`,
                startDate: null,
                endDate: null,
                timezone: null,
                location: 'Unknown',
                cost: null,
                status: 'pending',
                placeId: null,
              },
            ],
          };

          console.log('Using fallback data structure:', extractedData);
        }

        // Validate the structure of the parsed data
        if (!extractedData || typeof extractedData !== 'object') {
          throw new Error('AI response is not a valid object');
        }

        // Ensure required arrays exist
        if (!Array.isArray(extractedData.places)) {
          console.warn(
            'AI response missing places array, defaulting to empty array',
          );
          extractedData.places = [];
        }

        if (!Array.isArray(extractedData.items)) {
          console.warn(
            'AI response missing items array, defaulting to empty array',
          );
          extractedData.items = [];
        }

        console.log(
          `Extracted ${extractedData.places.length} places and ${extractedData.items.length} items`,
        );

        // Create places first (if any)
        const placeIdMap: Record<string, string> = {};
        const validPlaceTypes = ['hotel', 'restaurant', 'attraction', 'venue'];

        if (extractedData.places && Array.isArray(extractedData.places)) {
          for (const placeData of extractedData.places) {
            // Ensure place type is valid, default to 'venue'
            const placeType = validPlaceTypes.includes(placeData.type)
              ? placeData.type
              : 'venue';

            const [newPlace] = await db
              .insert(places)
              .values({
                name: placeData.name || 'Unnamed Place',
                type: placeType,
                address: placeData.address || null,
                phone: placeData.phone || null,
                email: placeData.email || null,
                website: placeData.website || null,
                description: placeData.description || null,
                priceRange: placeData.priceRange || null,
                rating: placeData.rating || null,
              })
              .returning();

            createdPlaces.push(newPlace);
            placeIdMap[placeData.name] = newPlace.id;
          }
        }

        // Create items with auto-generated titles for structured types
        const validItemTypes = [
          'flight',
          'hotel',
          'transfer',
          'restaurant',
          'activity',
        ];

        if (extractedData.items && Array.isArray(extractedData.items)) {
          for (const itemData of extractedData.items) {
            const placeId = itemData.placeId
              ? placeIdMap[itemData.placeId]
              : null;

            // Ensure item type is valid, default to 'activity'
            const itemType = validItemTypes.includes(itemData.type)
              ? itemData.type
              : 'activity';

            // Parse dates safely
            let startDate = null;
            let endDate = null;
            try {
              if (itemData.startDate) {
                startDate = new Date(itemData.startDate);
                if (isNaN(startDate.getTime())) startDate = null;
              }
              if (itemData.endDate) {
                endDate = new Date(itemData.endDate);
                if (isNaN(endDate.getTime())) endDate = null;
              }
            } catch (e) {
              // Invalid date format, keep as null
            }

            // Generate smart titles based on type
            let generatedTitle = itemData.title || 'Untitled Item';

            if (itemType === 'flight') {
              // Generate flight title from origin and destination
              const origin = itemData.originLocation || '';
              const destination =
                itemData.destinationLocation || itemData.location || '';
              const cost = itemData.cost ? ` - ${itemData.cost}` : '';

              if (origin && destination) {
                generatedTitle = `Flight ${origin} → ${destination}${cost}`;
              } else if (destination) {
                generatedTitle = `Flight to ${destination}${cost}`;
              } else {
                generatedTitle = `Flight${cost}`;
              }
            } else if (itemType === 'hotel') {
              // Use place name or location for hotel
              const placeName = itemData.placeId
                ? itemData.placeId
                : itemData.location;
              const nights =
                startDate && endDate
                  ? Math.ceil(
                      (endDate.getTime() - startDate.getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;
              generatedTitle = placeName
                ? `${placeName}${nights ? ` (${nights} nights)` : ''}`
                : 'Hotel Stay';
            } else if (itemType === 'transfer') {
              // Generate transfer title from origin and destination
              const origin = itemData.originLocation || '';
              const destination =
                itemData.destinationLocation || itemData.location || '';
              const desc = itemData.description || '';

              if (origin && destination) {
                generatedTitle = `Transfer ${origin} → ${destination}`;
              } else if (destination) {
                generatedTitle = `Transfer to ${destination}`;
              } else if (origin) {
                generatedTitle = `Transfer from ${origin}`;
              } else if (desc.toLowerCase().includes('airport')) {
                generatedTitle =
                  desc.toLowerCase().includes('pickup') ||
                  desc.toLowerCase().includes('arrival')
                    ? 'Airport Pickup'
                    : 'Airport Transfer';
              } else {
                generatedTitle = 'Transportation';
              }
            } else if (itemType === 'restaurant') {
              // Use place name or location for dining
              const placeName = itemData.placeId
                ? itemData.placeId
                : itemData.location;
              const time = startDate
                ? startDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';
              generatedTitle = placeName
                ? `Dinner at ${placeName}${time ? ` (${time})` : ''}`
                : 'Restaurant Reservation';
            } else {
              // For activities, keep the AI-generated title as it makes more sense
              generatedTitle = itemData.title || 'Activity';
            }

            const [newItem] = await db
              .insert(items)
              .values({
                tripId,
                type: itemType,
                placeId,
                title: generatedTitle,
                description: itemData.description || null,
                startDate,
                endDate,
                timezone: itemData.timezone || null,
                location: itemData.location || null,
                originLocation: itemData.originLocation || null,
                destinationLocation: itemData.destinationLocation || null,
                cost: itemData.cost || null,
                status: itemData.status || 'pending',
              })
              .returning();

            createdItems.push(newItem);
          }
        }

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
