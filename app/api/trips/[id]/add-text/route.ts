import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { trips, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { processExtractedItems } from '../analyze/utils/core-analyzer';
import { TEXT_ANALYZER_SYSTEM_INSTRUCTIONS } from './prompt';

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

    // Parse request body
    const body = await request.json();
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          userMessage: 'Please enter some text to analyze',
        },
        { status: 400 },
      );
    }

    const createdItems: any[] = [];
    const createdPlaces: any[] = [];

    // Use GPT-5.2 Responses API to analyze text
    const userMessage = `Extract travel items from the following text:\n\n${text}`;

    console.log(`Analyzing text with GPT-5.2...`);

    const aiStartTime = Date.now();
    const response = await openai.responses.create({
      model: 'gpt-5.2',
      input: userMessage,
      instructions: TEXT_ANALYZER_SYSTEM_INSTRUCTIONS,
    });
    const aiEndTime = Date.now();
    const processingTimeMs = aiEndTime - aiStartTime;

    console.log(`GPT-5.2 analysis completed (${processingTimeMs}ms)`);

    // Extract the text response
    const rawAnalysisResult = response.output_text || response.output || '';
    const analysisResult = Array.isArray(rawAnalysisResult)
      ? JSON.stringify(rawAnalysisResult)
      : rawAnalysisResult;

    if (!analysisResult) {
      throw new Error('No analysis result from GPT-5.2');
    }

    console.log(`AI Response:`, analysisResult);

    // Parse the JSON response
    let extractedData;
    try {
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

      // Fallback: Create a basic item structure
      console.log(`Falling back to basic item creation`);

      extractedData = {
        items: [],
      };

      console.log('Using fallback data structure:', extractedData);
    }

    // Validate the structure of the parsed data
    if (!extractedData || typeof extractedData !== 'object') {
      throw new Error('AI response is not a valid object');
    }

    // Ensure required arrays exist
    if (!Array.isArray(extractedData.items)) {
      console.warn(
        'AI response missing items array, defaulting to empty array',
      );
      extractedData.items = [];
    }

    // Process extracted items
    console.log(`Processing extracted items for trip ${tripId}...`);
    await processExtractedItems(extractedData, tripId, db, createdPlaces, createdItems);

    console.log(
      `✅ Text analysis complete! Created ${createdItems.length} items and ${createdPlaces.length} places.`,
    );

    return NextResponse.json({
      success: true,
      createdItems: createdItems.length,
      createdPlaces: createdPlaces.length,
      items: createdItems,
      places: createdPlaces,
    });
  } catch (error: any) {
    console.error('Error analyzing text:', error);

    // Handle specific error cases
    if (error.message?.includes('quota') || error.message?.includes('credits')) {
      return NextResponse.json(
        {
          error: 'OpenAI credits depleted',
          userMessage:
            'Unable to process request - OpenAI credits have been exhausted. Please contact support.',
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to analyze text',
        userMessage: error.message || 'An unexpected error occurred during text analysis',
      },
      { status: 500 },
    );
  }
}
