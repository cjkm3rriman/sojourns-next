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
import { TRAVEL_ANALYZER_SYSTEM_INSTRUCTIONS } from './prompt';

// Helper function to find or create restaurant place
async function findOrCreateRestaurant(
  restaurantName: string,
  db: any,
  createdPlaces: any[] = [],
): Promise<string | null> {
  try {
    console.log(`Looking up restaurant: ${restaurantName}`);

    // Check if restaurant already exists in database
    const existingRestaurant = await db
      .select()
      .from(places)
      .where(and(eq(places.name, restaurantName), eq(places.type, 'restaurant')))
      .limit(1);

    if (existingRestaurant.length > 0) {
      console.log(
        `Found existing restaurant: ${restaurantName} -> ${existingRestaurant[0].id}`,
      );
      return existingRestaurant[0].id;
    }

    // Check if we already created this restaurant in this session
    const alreadyCreated = createdPlaces.find(
      (p) => p.name === restaurantName && p.type === 'restaurant',
    );
    if (alreadyCreated) {
      console.log(
        `Already created restaurant in this session: ${restaurantName} -> ${alreadyCreated.id}`,
      );
      return alreadyCreated.id;
    }

    const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googlePlacesApiKey) {
      console.warn(
        'GOOGLE_PLACES_API_KEY not set, creating restaurant with name only',
      );

      const [newRestaurant] = await db
        .insert(places)
        .values({
          name: restaurantName,
          shortName: null,
          type: 'restaurant',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Restaurant`,
        })
        .returning();

      console.log(
        `Created new restaurant place: ${restaurantName} -> ${newRestaurant.id}`,
      );
      createdPlaces.push(newRestaurant);
      return newRestaurant.id;
    }

    // Use the new Places API (New) with Text Search
    const placesResponse = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesApiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.id,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary,places.utcOffsetMinutes',
        },
        body: JSON.stringify({
          textQuery: restaurantName,
          languageCode: 'en',
        }),
      },
    );

    if (!placesResponse.ok) {
      console.warn(
        `Google Places API error for ${restaurantName}: ${placesResponse.status} ${placesResponse.statusText}`,
      );
      const errorText = await placesResponse.text();
      console.warn(`Google Places error response:`, errorText);

      // Create restaurant with just the name
      const [newRestaurant] = await db
        .insert(places)
        .values({
          name: restaurantName,
          shortName: null,
          type: 'restaurant',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Restaurant`,
        })
        .returning();

      console.log(
        `Created new restaurant place: ${restaurantName} -> ${newRestaurant.id}`,
      );
      createdPlaces.push(newRestaurant);
      return newRestaurant.id;
    }

    const placesData = await placesResponse.json();
    console.log(
      `Google Places data for ${restaurantName}:`,
      JSON.stringify(placesData, null, 2),
    );

    if (!placesData.places || placesData.places.length === 0) {
      console.warn(`No Google Places results found for ${restaurantName}`);

      // Create restaurant with just the name
      const [newRestaurant] = await db
        .insert(places)
        .values({
          name: restaurantName,
          shortName: null,
          type: 'restaurant',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Restaurant`,
        })
        .returning();

      console.log(
        `Created new restaurant place: ${restaurantName} -> ${newRestaurant.id}`,
      );
      createdPlaces.push(newRestaurant);
      return newRestaurant.id;
    }

    const place = placesData.places[0];

    // Parse address components for structured data
    let streetAddress = null;
    let city = null;
    let state = null;
    let country = null;
    let postalCode = null;

    if (place.addressComponents) {
      for (const component of place.addressComponents) {
        const types = component.types || [];

        // Street number and route combine to form street address
        if (types.includes('street_number') || types.includes('route')) {
          streetAddress = streetAddress
            ? `${streetAddress} ${component.longText || component.shortText}`
            : (component.longText || component.shortText);
        }

        // City
        if (types.includes('locality')) {
          city = component.longText || component.shortText;
        }

        // State/Province
        if (types.includes('administrative_area_level_1')) {
          state = component.shortText || component.longText;
        }

        // Country
        if (types.includes('country')) {
          country = component.shortText || component.longText;
        }

        // Postal Code
        if (types.includes('postal_code')) {
          postalCode = component.longText || component.shortText;
        }
      }
    }

    // Convert UTC offset minutes to timezone string (approximate)
    let timezone = null;
    if (place.utcOffsetMinutes !== undefined) {
      const hours = Math.floor(Math.abs(place.utcOffsetMinutes) / 60);
      const minutes = Math.abs(place.utcOffsetMinutes) % 60;
      const sign = place.utcOffsetMinutes >= 0 ? '+' : '-';
      timezone = `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Create new restaurant place from Google Places data
    const [newRestaurant] = await db
      .insert(places)
      .values({
        name: place.displayName?.text || restaurantName,
        shortName: null,
        type: 'restaurant',
        address: streetAddress || place.formattedAddress || null,
        city: city,
        state: state,
        country: country,
        postalCode: postalCode,
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        timezone: timezone,
        phoneNumber: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        description: place.editorialSummary?.text || 'Restaurant',
      })
      .returning();

    console.log(
      `Created new restaurant place: ${restaurantName} -> ${newRestaurant.id}`,
    );
    createdPlaces.push(newRestaurant);
    return newRestaurant.id;
  } catch (error) {
    console.error(`Error finding/creating restaurant ${restaurantName}:`, error);
    return null;
  }
}

// Helper function to find or create hotel place
async function findOrCreateHotel(
  hotelName: string,
  db: any,
  createdPlaces: any[] = [],
): Promise<string | null> {
  try {
    console.log(`Looking up hotel: ${hotelName}`);

    // First check if hotel already exists in our places table
    const existingHotel = await db
      .select()
      .from(places)
      .where(and(eq(places.name, hotelName), eq(places.type, 'hotel')))
      .limit(1);

    if (existingHotel.length > 0) {
      console.log(
        `Found existing hotel: ${hotelName} -> ${existingHotel[0].id}`,
      );
      return existingHotel[0].id;
    }

    // Hotel doesn't exist, query Google Places API
    console.log(`Hotel ${hotelName} not found, querying Google Places API`);

    // TODO: Replace with actual Google Places API key
    const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googlePlacesApiKey) {
      console.warn(
        'GOOGLE_PLACES_API_KEY not set, creating hotel without address data',
      );

      // Create hotel with just the name
      const [newHotel] = await db
        .insert(places)
        .values({
          name: hotelName,
          shortName: null,
          type: 'hotel',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Hotel`,
        })
        .returning();

      console.log(`Created new hotel place: ${hotelName} -> ${newHotel.id}`);
      createdPlaces.push(newHotel);
      return newHotel.id;
    }

    // Use the new Places API (New) with Text Search
    const placesResponse = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesApiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.id,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary,places.utcOffsetMinutes',
        },
        body: JSON.stringify({
          textQuery: hotelName,
          languageCode: 'en',
        }),
      },
    );

    if (!placesResponse.ok) {
      console.warn(
        `Google Places API error for ${hotelName}: ${placesResponse.status} ${placesResponse.statusText}`,
      );
      const errorText = await placesResponse.text();
      console.warn(`Google Places error response:`, errorText);

      // Create hotel with just the name
      const [newHotel] = await db
        .insert(places)
        .values({
          name: hotelName,
          shortName: null,
          type: 'hotel',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Hotel`,
        })
        .returning();

      console.log(`Created new hotel place: ${hotelName} -> ${newHotel.id}`);
      createdPlaces.push(newHotel);
      return newHotel.id;
    }

    const placesData = await placesResponse.json();
    console.log(
      `Google Places data for ${hotelName}:`,
      JSON.stringify(placesData, null, 2),
    );

    if (!placesData.places || placesData.places.length === 0) {
      console.warn(`No Google Places results found for ${hotelName}`);

      // Create hotel with just the name
      const [newHotel] = await db
        .insert(places)
        .values({
          name: hotelName,
          shortName: null,
          type: 'hotel',
          city: null,
          state: null,
          country: null,
          lat: null,
          lng: null,
          timezone: null,
          description: `Hotel`,
        })
        .returning();

      console.log(`Created new hotel place: ${hotelName} -> ${newHotel.id}`);
      createdPlaces.push(newHotel);
      return newHotel.id;
    }

    const place = placesData.places[0];

    // Parse address components for structured data
    let streetAddress = null;
    let city = null;
    let state = null;
    let country = null;
    let postalCode = null;

    if (place.addressComponents) {
      for (const component of place.addressComponents) {
        const types = component.types || [];

        // Street number and route combine to form street address
        if (types.includes('street_number') || types.includes('route')) {
          streetAddress = streetAddress
            ? `${streetAddress} ${component.longText || component.shortText}`
            : (component.longText || component.shortText);
        }

        // City
        if (types.includes('locality')) {
          city = component.longText || component.shortText;
        }

        // State/Province
        if (types.includes('administrative_area_level_1')) {
          state = component.shortText || component.longText;
        }

        // Country
        if (types.includes('country')) {
          country = component.shortText || component.longText;
        }

        // Postal Code
        if (types.includes('postal_code')) {
          postalCode = component.longText || component.shortText;
        }
      }
    }

    // Convert UTC offset minutes to timezone string (approximate)
    let timezone = null;
    if (place.utcOffsetMinutes !== undefined) {
      const hours = Math.floor(Math.abs(place.utcOffsetMinutes) / 60);
      const minutes = Math.abs(place.utcOffsetMinutes) % 60;
      const sign = place.utcOffsetMinutes >= 0 ? '+' : '-';
      timezone = `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Create new hotel place from Google Places data
    const [newHotel] = await db
      .insert(places)
      .values({
        name: place.displayName?.text || hotelName,
        shortName: null,
        type: 'hotel',
        address: streetAddress || place.formattedAddress || null,
        city: city,
        state: state,
        country: country,
        postalCode: postalCode,
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        timezone: timezone,
        phoneNumber: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        description: place.editorialSummary?.text || 'Hotel',
      })
      .returning();

    console.log(`Created new hotel place: ${hotelName} -> ${newHotel.id}`);
    createdPlaces.push(newHotel);
    return newHotel.id;
  } catch (error) {
    console.error(`Error finding/creating hotel ${hotelName}:`, error);
    return null;
  }
}

// Helper function to find or create airport place
async function findOrCreateAirport(
  iataCode: string,
  db: any,
  createdPlaces: any[] = [],
): Promise<string | null> {
  try {
    console.log(`Looking up airport: ${iataCode}`);

    // First check if airport already exists in our places table
    const existingAirport = await db
      .select()
      .from(places)
      .where(
        and(
          eq(places.shortName, iataCode),
          eq(places.type, 'airport'), // Using 'airport' type for airports
        ),
      )
      .limit(1);

    if (existingAirport.length > 0) {
      console.log(
        `Found existing airport: ${iataCode} -> ${existingAirport[0].id}`,
      );
      return existingAirport[0].id;
    }

    // Airport doesn't exist, query FlightAware airports API
    console.log(
      `Airport ${iataCode} not found, querying FlightAware airports API`,
    );

    const airportResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/airports/${iataCode}`,
      {
        headers: {
          'x-apikey': process.env.FLIGHTAWARE_API_KEY!,
          Accept: 'application/json',
        },
      },
    );

    if (!airportResponse.ok) {
      console.warn(
        `FlightAware airports API error for ${iataCode}: ${airportResponse.status} ${airportResponse.statusText}`,
      );
      return null;
    }

    const airportData = await airportResponse.json();
    console.log(
      `FlightAware airport data for ${iataCode}:`,
      JSON.stringify(airportData, null, 2),
    );

    // Create new airport place from FlightAware data
    const [newAirport] = await db
      .insert(places)
      .values({
        name: airportData.name || `${iataCode} Airport`,
        shortName: iataCode,
        type: 'airport',
        city: airportData.city || null,
        state: airportData.state || null,
        country: airportData.country_code || null,
        lat: airportData.latitude || null,
        lng: airportData.longitude || null,
        timezone: airportData.timezone || null,
        description: `Airport (${iataCode})`,
      })
      .returning();

    console.log(`Created new airport place: ${iataCode} -> ${newAirport.id}`);

    // Add the newly created airport to the createdPlaces array
    createdPlaces.push(newAirport);

    return newAirport.id;
  } catch (error) {
    console.error(`Error finding/creating airport ${iataCode}:`, error);
    return null;
  }
}

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

          const existingFiles = await openai.vectorStores.files.list(
            vectorStoreId,
          );
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
            const openaiFile = await openai.vectorStores.fileBatches.uploadAndPoll(
              vectorStoreId,
              {
                files: [
                  new File([fileBuffer], doc.originalName, {
                    type: 'application/pdf',
                  }),
                ],
              },
            );

            openaiFileId = openaiFile.file_counts.completed > 0
              ? (await openai.vectorStores.files.list(vectorStoreId, { limit: 1 })).data[0]?.id
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
          console.log(
            `File already in vector store: ${openaiFileId}`,
          );
        }

        // Step 3: Use Responses API with GPT-4o and vector store
        const userMessage = `Extract flight, hotel, transfer, activity, AND restaurant information from "${doc.originalName}". Return JSON with flights (flight number, departure/arrival times, class, confirmation), hotels (hotel name, check-in/out times, room category, perks, confirmation), transfers (contact name, pickup/dropoff times, transfer type, vehicle info, confirmation), activities (activity name, start/end times, activity type, contact, service, confirmation), and restaurants (restaurant name, reservation times, cuisine type, party size, confirmation).`;

        console.log('Analyzing document with GPT-4o Responses API...');

        const aiStartTime = Date.now();
        const response = await openai.responses.create({
          model: 'gpt-4o',
          input: userMessage,
          instructions: TRAVEL_ANALYZER_SYSTEM_INSTRUCTIONS,
          tools: [
            {
              type: 'file_search',
              vector_store_ids: [vectorStoreId],
            },
          ],
        });
        const aiEndTime = Date.now();
        const processingTimeMs = aiEndTime - aiStartTime;

        console.log(
          `GPT-4o analysis completed (${processingTimeMs}ms)`,
        );

        // Extract the text response
        const analysisResult = response.output_text || response.output || '';

        if (!analysisResult) {
          throw new Error('No analysis result from GPT-5');
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
            items: [
              {
                flightNumber: 'Unknown',
                departureDateTime: null,
                arrivalDateTime: null,
                data: {
                  flightNumber: 'Unknown',
                  extractedFromAI: false,
                  fallbackReason: `AI analysis failed for ${doc.originalName}. Original response: ${analysisResult.substring(0, 100)}...`,
                },
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
        if (!Array.isArray(extractedData.items)) {
          console.warn(
            'AI response missing items array, defaulting to empty array',
          );
          extractedData.items = [];
        }

        // Convert simplified extraction format and enrich with OAG data
        const processedItems: any[] = [];

        for (const item of extractedData.items) {
          // Handle different item types
          if (item.type === 'flight') {
            await processFlightItem(item, db, createdPlaces, processedItems);
          } else if (item.type === 'hotel') {
            await processHotelItem(item, db, createdPlaces, processedItems);
          } else if (item.type === 'transfer') {
            await processTransferItem(item, db, createdPlaces, processedItems);
          } else if (item.type === 'activity') {
            await processActivityItem(item, db, createdPlaces, processedItems);
          } else if (item.type === 'restaurant') {
            await processRestaurantItem(
              item,
              db,
              createdPlaces,
              processedItems,
            );
          } else {
            console.warn(`Unknown item type: ${item.type}, skipping`);
          }
        }

        // Helper function to process flight items
        async function processFlightItem(
          item: any,
          db: any,
          createdPlaces: any[],
          processedItems: any[],
        ) {
          // Check if flight already exists in trip items
          if (item.flightNumber) {
            const existingFlight = await db
              .select()
              .from(items)
              .where(
                and(
                  eq(items.tripId, tripId),
                  eq(items.type, 'flight'),
                ),
              );

            // Check if any existing flight has this flight number in the title
            const flightExists = existingFlight.some((existingItem: any) =>
              existingItem.title?.includes(item.flightNumber),
            );

            if (flightExists) {
              console.log(
                `Flight ${item.flightNumber} already exists in trip, skipping...`,
              );
              return;
            }
          }

          let oagFlightData = null;

          // Call OAG API for each flight
          if (item.flightNumber) {
            try {
              // Parse flight number into carrier code and flight number for OAG
              const flightIdent = item.flightNumber.replace(/\s+/g, ''); // Remove spaces (AA 123 -> AA123)
              const match = flightIdent.match(/^([A-Z]{2,3})(\d+)$/);

              if (!match) {
                console.warn(
                  `Invalid flight number format for OAG: ${item.flightNumber}`,
                );
                return;
              }

              const carrierCode = match[1];
              const flightNumber = match[2];

              // Determine scheduled departure date
              // Prepare departure and arrival dates from extracted data
              let departureDate = '';
              let arrivalDate = '';

              if (item.departureDateTime) {
                departureDate = new Date(item.departureDateTime)
                  .toISOString()
                  .split('T')[0]; // YYYY-MM-DD
              }

              if (item.arrivalDateTime) {
                arrivalDate = new Date(item.arrivalDateTime)
                  .toISOString()
                  .split('T')[0]; // YYYY-MM-DD
              }

              console.log(
                `Calling OAG API for flight ${carrierCode}${flightNumber} - Departure: ${departureDate || 'not specified'}, Arrival: ${arrivalDate || 'not specified'}`,
              );

              // Call OAG Flight Instances API with both dates (with retry logic)
              let retryCount = 0;
              const maxRetries = 2;

              while (retryCount <= maxRetries && !oagFlightData) {
                if (retryCount > 0) {
                  console.log(
                    `Retrying OAG API call for ${carrierCode}${flightNumber} (attempt ${retryCount + 1})`,
                  );
                  // Add a small delay before retry
                  await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * retryCount),
                  );
                }

                try {
                  const oagResponse = await fetch(
                    `https://api.oag.com/flight-instances/?version=v2&carrierCode=${carrierCode}&FlightNumber=${flightNumber}&CodeType=IATA&DepartureDateTime=${departureDate}&ArrivalDateTime=${arrivalDate}`,
                    {
                      headers: {
                        'Subscription-Key': process.env.OAG_PRIMARY_KEY!,
                        Accept: 'application/json',
                      },
                    },
                  );

                  if (oagResponse.ok) {
                    oagFlightData = await oagResponse.json();
                    console.log(
                      `OAG response for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}):`,
                      JSON.stringify(oagFlightData, null, 2),
                    );
                    break; // Success, exit retry loop
                  } else {
                    console.warn(
                      `OAG API error for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}): ${oagResponse.status} ${oagResponse.statusText}`,
                    );
                    const errorText = await oagResponse.text();
                    console.warn(`OAG error response:`, errorText);
                  }
                } catch (fetchError) {
                  console.warn(
                    `OAG API fetch error for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}):`,
                    fetchError,
                  );
                }

                retryCount++;
              }
            } catch (oagError) {
              console.error(
                `Error calling OAG API for flight ${item.flightNumber}:`,
                oagError,
              );
            }
          }

          // Map OAG data to our structure
          let mappedStartDate = item.departureDateTime || null;
          let mappedEndDate = item.arrivalDateTime || null;
          // Capitalize class if present
          const capitalizedClass = item.class
            ? item.class.charAt(0).toUpperCase() +
              item.class.slice(1).toLowerCase()
            : null;

          let mappedData = {
            flightNumber: item.flightNumber || null,
            carrierCode: null, // Will be populated from OAG if available
            class: capitalizedClass, // Class of service from AI extraction (capitalized)
          };

          // If we have OAG data, use the first flight result
          if (
            oagFlightData &&
            oagFlightData.data &&
            oagFlightData.data.length > 0
          ) {
            const firstFlight = oagFlightData.data[0];

            // Extract scheduled times from OAG response
            if (firstFlight.departure && firstFlight.arrival) {
              // Use departure timing - combine date and time
              if (firstFlight.departure.date && firstFlight.departure.time) {
                mappedStartDate = `${firstFlight.departure.date.local}T${firstFlight.departure.time.local}`;
                console.log(
                  `Using OAG departure time (local): ${mappedStartDate}`,
                );
              }

              // Use arrival timing - combine date and time
              if (firstFlight.arrival.date && firstFlight.arrival.time) {
                mappedEndDate = `${firstFlight.arrival.date.local}T${firstFlight.arrival.time.local}`;
                console.log(`Using OAG arrival time (local): ${mappedEndDate}`);
              }
            }

            // Add essential flight information to data field
            if (firstFlight.carrier && firstFlight.flightNumber) {
              mappedData = {
                carrierCode: firstFlight.carrier.iata || null,
                flightNumber: firstFlight.flightNumber || null,
                class: mappedData.class, // Preserve class from AI extraction
              };

              console.log(
                `Mapped OAG flight data: Carrier=${firstFlight.carrier.iata}, Flight=${firstFlight.flightNumber}, Class=${mappedData.class}`,
              );
            }
          }

          // Handle airport places and terminal info for origin and destination using OAG data + FlightAware airport details
          let originPlaceId = null;
          let destinationPlaceId = null;
          let originLocationSpecific = null;
          let destinationLocationSpecific = null;

          if (
            oagFlightData &&
            oagFlightData.data &&
            oagFlightData.data.length > 0
          ) {
            const firstFlight = oagFlightData.data[0];

            // Process origin airport from OAG departure data
            if (firstFlight.departure?.airport?.iata) {
              originPlaceId = await findOrCreateAirport(
                firstFlight.departure.airport.iata,
                db,
                createdPlaces,
              );
              console.log(
                `Origin airport: ${firstFlight.departure.airport.iata} -> ${originPlaceId}`,
              );
            }

            // Process destination airport from OAG arrival data
            if (firstFlight.arrival?.airport?.iata) {
              destinationPlaceId = await findOrCreateAirport(
                firstFlight.arrival.airport.iata,
                db,
                createdPlaces,
              );
              console.log(
                `Destination airport: ${firstFlight.arrival.airport.iata} -> ${destinationPlaceId}`,
              );
            }

            // Extract terminal information from OAG format
            if (firstFlight.departure?.terminal) {
              const terminal = firstFlight.departure.terminal.trim();
              // If single number or letter, prefix with 'T'
              originLocationSpecific = /^[0-9A-Za-z]$/.test(terminal)
                ? `T${terminal}`
                : terminal;
              console.log(`Origin terminal: ${originLocationSpecific}`);
            }

            if (firstFlight.arrival?.terminal) {
              const terminal = firstFlight.arrival.terminal.trim();
              // If single number or letter, prefix with 'T'
              destinationLocationSpecific = /^[0-9A-Za-z]$/.test(terminal)
                ? `T${terminal}`
                : terminal;
              console.log(
                `Destination terminal: ${destinationLocationSpecific}`,
              );
            }
          } else {
            console.warn(
              `No OAG data available for flight ${item.flightNumber}, will attempt fallback airport creation if possible`,
            );

            // TODO: Add fallback logic here to extract airport codes from flight route info
            // For now, we'll rely on the user to manually add airport information
          }

          // Create processed item with mapped OAG data
          const processedItem = {
            type: 'flight',
            title: '', // Will be auto-generated
            description: '', // Will be auto-generated
            startDate: mappedStartDate,
            endDate: mappedEndDate,
            originPlaceId,
            destinationPlaceId,
            originLocationSpecific,
            destinationLocationSpecific,
            confirmationNumber: item.confirmationNumber || null,
            clientBooked: item.clientBooked || false,
            data: mappedData,
          };

          console.log(
            `Flight ${item.flightNumber}: originPlaceId=${originPlaceId}, destinationPlaceId=${destinationPlaceId}`,
          );

          processedItems.push(processedItem);
        }

        // Helper function to process hotel items
        async function processHotelItem(
          item: any,
          db: any,
          createdPlaces: any[],
          processedItems: any[],
        ) {
          console.log(`Processing hotel: ${item.hotelName}`);

          // Create hotel place
          let hotelPlaceId = null;
          if (item.hotelName) {
            hotelPlaceId = await findOrCreateHotel(
              item.hotelName,
              db,
              createdPlaces,
            );
            console.log(`Hotel place: ${item.hotelName} -> ${hotelPlaceId}`);
          }

          // Parse check-in/out times
          let checkInDate = null;
          let checkOutDate = null;

          if (item.checkInDateTime) {
            // Handle both Date objects and ISO strings
            if (item.checkInDateTime instanceof Date) {
              checkInDate = item.checkInDateTime;
            } else if (typeof item.checkInDateTime === 'string') {
              const parts = item.checkInDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                checkInDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          if (item.checkOutDateTime) {
            // Handle both Date objects and ISO strings
            if (item.checkOutDateTime instanceof Date) {
              checkOutDate = item.checkOutDateTime;
            } else if (typeof item.checkOutDateTime === 'string') {
              const parts = item.checkOutDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                checkOutDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          const processedItem = {
            type: 'hotel',
            title: item.hotelName || 'Hotel Stay',
            description: '', // Will be auto-generated
            startDate: checkInDate,
            endDate: checkOutDate,
            originPlaceId: hotelPlaceId,
            destinationPlaceId: null,
            originLocationSpecific: null, // TODO: Room number if available later
            destinationLocationSpecific: null,
            confirmationNumber: item.confirmationNumber || null,
            clientBooked: false, // TODO: Extract from hotel data if needed
            data: {
              hotelName: item.hotelName || null,
              roomCategory: item.roomCategory || null,
              perks: item.perks || [],
            },
          };

          console.log(`Hotel ${item.hotelName}: originPlaceId=${hotelPlaceId}`);
          processedItems.push(processedItem);
        }

        // Helper function to process transfer items
        async function processTransferItem(
          item: any,
          db: any,
          createdPlaces: any[],
          processedItems: any[],
        ) {
          console.log(`Processing transfer: ${item.contactName}`);

          // Parse pickup/dropoff times
          let pickupDate = null;
          let dropoffDate = null;

          if (item.pickupDateTime) {
            // Handle both Date objects and ISO strings
            if (item.pickupDateTime instanceof Date) {
              pickupDate = item.pickupDateTime;
            } else if (typeof item.pickupDateTime === 'string') {
              const parts = item.pickupDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                pickupDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          if (item.dropoffDateTime) {
            // Handle both Date objects and ISO strings
            if (item.dropoffDateTime instanceof Date) {
              dropoffDate = item.dropoffDateTime;
            } else if (typeof item.dropoffDateTime === 'string') {
              const parts = item.dropoffDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                dropoffDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          const processedItem = {
            type: 'transfer',
            title: item.contactName || 'Transfer Service',
            description: '', // Will be auto-generated
            startDate: pickupDate,
            endDate: dropoffDate,
            originPlaceId: null, // TODO: Parse pickup location if possible
            destinationPlaceId: null, // TODO: Parse dropoff location if possible
            originLocationSpecific: null, // e.g., "Terminal 1 Arrivals", "Hotel Lobby"
            destinationLocationSpecific: null,
            confirmationNumber: item.confirmationNumber || null,
            clientBooked: false, // Transfers are typically arranged by the travel agent
            data: {
              contactName: item.contactName || null,
              service: item.service || null,
              vehicleType: item.vehicleType || null,
              pickupLocation: item.pickupLocation || null,
              dropoffLocation: item.dropoffLocation || null,
            },
          };

          console.log(`Transfer ${item.contactName}: processed transfer item`);
          processedItems.push(processedItem);
        }

        // Helper function to process activity items
        async function processActivityItem(
          item: any,
          db: any,
          createdPlaces: any[],
          processedItems: any[],
        ) {
          console.log(`Processing activity: ${item.activityName}`);

          // Parse start/end times
          let startDate = null;
          let endDate = null;

          if (item.startDateTime) {
            // Handle both Date objects and ISO strings
            if (item.startDateTime instanceof Date) {
              startDate = item.startDateTime;
            } else if (typeof item.startDateTime === 'string') {
              const parts = item.startDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                startDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          if (item.endDateTime) {
            // Handle both Date objects and ISO strings
            if (item.endDateTime instanceof Date) {
              endDate = item.endDateTime;
            } else if (typeof item.endDateTime === 'string') {
              const parts = item.endDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                endDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          // Generate 5-word title from activity name
          const generateTitle = (activityName: string): string => {
            if (!activityName) return 'Activity';

            const words = activityName
              .split(' ')
              .filter((word) => word.length > 0);

            // Remove common words to focus on key terms
            const stopWords = [
              'the',
              'a',
              'an',
              'and',
              'or',
              'but',
              'in',
              'on',
              'at',
              'to',
              'for',
              'of',
              'with',
              'by',
              'from',
              '&',
              '-',
            ];
            const filteredWords = words.filter(
              (word) =>
                !stopWords.includes(word.toLowerCase()) && word.length > 1,
            );

            // Take first 5 meaningful words
            const titleWords = filteredWords.slice(0, 5);

            // If we don't have enough words, fall back to original words
            if (titleWords.length < 3) {
              return words.slice(0, 5).join(' ');
            }

            return titleWords.join(' ');
          };

          const processedItem = {
            type: 'activity',
            title: item.activityTitle || generateTitle(item.activityName || ''),
            description: item.activityName || '',
            info: '', // Will be populated from activity notes/requirements
            startDate: startDate,
            endDate: endDate,
            originPlaceId: null, // TODO: Parse pickup location if possible
            destinationPlaceId: null, // TODO: Parse dropoff location if possible
            originLocationSpecific: null,
            destinationLocationSpecific: null,
            confirmationNumber: item.confirmationNumber || null,
            clientBooked: false, // Activities are typically arranged by the travel agent
            data: {
              contactName: item.contactName || null,
              service: item.service || null,
              activityType: item.activityType || null,
              vehicleType: item.vehicleType || null,
              placesVisited: [], // TODO: Extract places from activity name/description
            },
          };

          console.log(`Activity ${item.activityName}: processed activity item`);
          processedItems.push(processedItem);
        }

        // Helper function to process restaurant items
        async function processRestaurantItem(
          item: any,
          db: any,
          createdPlaces: any[],
          processedItems: any[],
        ) {
          console.log(`Processing restaurant: ${item.restaurantName}`);

          // Create restaurant place using Google Places API
          let restaurantPlaceId = null;
          if (item.restaurantName) {
            restaurantPlaceId = await findOrCreateRestaurant(
              item.restaurantName,
              db,
              createdPlaces,
            );
          }

          // Parse start/end times
          let startDate = null;
          let endDate = null;

          if (item.reservationDateTime) {
            if (item.reservationDateTime instanceof Date) {
              startDate = item.reservationDateTime;
            } else if (typeof item.reservationDateTime === 'string') {
              const parts = item.reservationDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                startDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          if (item.endDateTime) {
            if (item.endDateTime instanceof Date) {
              endDate = item.endDateTime;
            } else if (typeof item.endDateTime === 'string') {
              const parts = item.endDateTime.match(
                /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
              );
              if (parts) {
                endDate = new Date(
                  Date.UTC(
                    parseInt(parts[1]), // year
                    parseInt(parts[2]) - 1, // month (0-indexed)
                    parseInt(parts[3]), // day
                    parseInt(parts[4]), // hour
                    parseInt(parts[5]), // minute
                  ),
                );
              }
            }
          }

          const processedItem = {
            type: 'restaurant',
            title: item.restaurantName || 'Restaurant',
            description: item.restaurantName || '',
            info: item.dietaryRequests || '',
            startDate: startDate,
            endDate: endDate,
            originPlaceId: restaurantPlaceId,
            destinationPlaceId: null,
            originLocationSpecific: null, // Table details, private dining room, etc.
            destinationLocationSpecific: null,
            confirmationNumber: item.confirmationNumber || null,
            clientBooked: false, // Restaurants are typically arranged by the travel agent
            data: {
              restaurantName: item.restaurantName || null,
              contactName: item.contactName || null,
              cuisineType: item.cuisineType || null,
              partySize: item.partySize || null,
              dietaryRequests: item.dietaryRequests || null,
            },
          };

          console.log(
            `Restaurant ${item.restaurantName}: processed restaurant item`,
          );
          processedItems.push(processedItem);
        }

        // Helper function to link transfer places to flights and hotels
        async function linkTransferPlaces(processedItems: any[]) {
          const flights = processedItems.filter(
            (item) => item.type === 'flight',
          );
          const hotels = processedItems.filter((item) => item.type === 'hotel');
          const transfers = processedItems.filter(
            (item) => item.type === 'transfer',
          );

          console.log(
            `🚗 TRANSFER LINKING: Processing ${transfers.length} transfers with ${flights.length} flights and ${hotels.length} hotels`,
          );

          for (const transfer of transfers) {
            let originPlaceId = null;
            let destinationPlaceId = null;

            const transferData =
              typeof transfer.data === 'string'
                ? JSON.parse(transfer.data || '{}')
                : transfer.data || {};
            const pickupLocation = transferData.pickupLocation;
            const dropoffLocation = transferData.dropoffLocation;

            console.log(
              `\n📍 Processing transfer: ${transferData.contactName}`,
            );
            console.log(`   AI extracted pickupLocation: "${pickupLocation}"`);
            console.log(
              `   AI extracted dropoffLocation: "${dropoffLocation}"`,
            );
            console.log(`   Transfer time: ${transfer.startDate}`);

            // Try to match pickup location
            if (pickupLocation) {
              console.log(
                `🔍 Attempting pickup location match for: "${pickupLocation}"`,
              );
              originPlaceId = await matchLocationToPlace(
                pickupLocation,
                flights,
                hotels,
                transfer.startDate,
                'pickup',
              );
              console.log(
                `   ✅ Pickup match result: ${originPlaceId ? `placeId=${originPlaceId}` : 'NO MATCH'}`,
              );
            } else {
              console.log(`⚠️  No pickup location provided by AI`);
            }

            // Try to match dropoff location
            if (dropoffLocation) {
              console.log(
                `🔍 Attempting dropoff location match for: "${dropoffLocation}"`,
              );
              destinationPlaceId = await matchLocationToPlace(
                dropoffLocation,
                flights,
                hotels,
                transfer.endDate || transfer.startDate,
                'dropoff',
              );
              console.log(
                `   ✅ Dropoff match result: ${destinationPlaceId ? `placeId=${destinationPlaceId}` : 'NO MATCH'}`,
              );
            } else {
              console.log(`⚠️  No dropoff location provided by AI`);
            }

            // If no explicit location data, try temporal matching
            if (!originPlaceId && !destinationPlaceId && transfer.startDate) {
              console.log(
                `🕐 No explicit matches found, trying temporal matching...`,
              );
              const temporalMatches = findTemporalMatches(transfer, [
                ...flights,
                ...hotels,
              ]);
              originPlaceId = temporalMatches.originPlaceId;
              destinationPlaceId = temporalMatches.destinationPlaceId;
              console.log(
                `   ⏰ Temporal match results: origin=${originPlaceId}, destination=${destinationPlaceId}`,
              );
            }

            // Update transfer with matched place IDs
            if (originPlaceId || destinationPlaceId) {
              transfer.originPlaceId = originPlaceId;
              transfer.destinationPlaceId = destinationPlaceId;
              console.log(
                `✅ FINAL: Linked transfer "${transferData.contactName}": origin=${originPlaceId}, destination=${destinationPlaceId}`,
              );
            } else {
              console.log(
                `❌ FINAL: No place links found for transfer "${transferData.contactName}"`,
              );
            }
          }

          console.log(`🚗 TRANSFER LINKING: Complete\n`);
        }

        // Helper function to match location references to actual places
        async function matchLocationToPlace(
          locationRef: string,
          flights: any[],
          hotels: any[],
          transferTime: Date,
          direction: 'pickup' | 'dropoff',
        ) {
          if (!locationRef) return null;

          console.log(
            `    🎯 matchLocationToPlace: "${locationRef}" (${direction})`,
          );
          console.log(
            `       Available flights: ${flights.length}, hotels: ${hotels.length}`,
          );

          const locationLower = locationRef.toLowerCase();

          // Try to match airport codes or names
          console.log(
            `    🛫 Checking ${flights.length} flights for airport matches...`,
          );

          // Collect all matching flights with their match details and timing
          const matchingFlights: Array<{
            flight: any;
            placeId: string;
            matchType: string;
            timeDiff: number;
            isAfter: boolean;
          }> = [];

          for (const flight of flights) {
            const flightStartTime = flight.startDate
              ? new Date(flight.startDate).getTime()
              : null;
            const transferStartTime = transferTime
              ? new Date(transferTime).getTime()
              : null;
            const timeDiff =
              flightStartTime && transferStartTime
                ? Math.abs(flightStartTime - transferStartTime)
                : Infinity;
            const isAfter =
              flightStartTime && transferStartTime
                ? flightStartTime > transferStartTime
                : false;

            console.log(
              `       ✈️  Flight ${flight.title || 'Unknown'} (${flight.startDate}): origin="${flight.originPlaceName}" destination="${flight.destinationPlaceName}"`,
            );
            console.log(
              `          Time diff: ${timeDiff}ms, Is after transfer: ${isAfter}`,
            );

            // Check for airport code matches (e.g., "JFK", "KEF")
            if (locationRef.length === 3 && locationRef.match(/^[A-Z]{3}$/)) {
              // Look for IATA code in flight data
              const flightData =
                typeof flight.data === 'string'
                  ? JSON.parse(flight.data || '{}')
                  : flight.data || {};
              if (flightData.carrierCode) {
                if (direction === 'pickup') {
                  matchingFlights.push({
                    flight,
                    placeId: flight.destinationPlaceId,
                    matchType: 'IATA code pickup to destination',
                    timeDiff,
                    isAfter,
                  });
                } else {
                  matchingFlights.push({
                    flight,
                    placeId: flight.originPlaceId,
                    matchType: 'IATA code dropoff to origin',
                    timeDiff,
                    isAfter,
                  });
                }
              }
            }

            // Check for specific airport name matches (more precise matching)
            if (
              locationLower.includes('airport') ||
              locationLower.includes('international')
            ) {
              // Try to match specific airport names to avoid wrong airport selection
              const originAirport = (
                flight.originPlaceName ||
                flight.originPlaceCity ||
                ''
              ).toLowerCase();
              const destinationAirport = (
                flight.destinationPlaceName ||
                flight.destinationPlaceCity ||
                ''
              ).toLowerCase();

              console.log(`          Origin airport: "${originAirport}"`);
              console.log(
                `          Destination airport: "${destinationAirport}"`,
              );

              // Check if the location reference matches the airport names
              const originMatch =
                (originAirport.includes('airport') &&
                  locationLower.includes('keflavik') &&
                  originAirport.includes('keflavik')) ||
                (locationLower.includes('reykjavik') &&
                  originAirport.includes('reykjavik')) ||
                (originAirport.length > 0 &&
                  locationLower.includes(originAirport.split(' ')[0]));

              const destinationMatch =
                (destinationAirport.includes('airport') &&
                  locationLower.includes('keflavik') &&
                  destinationAirport.includes('keflavik')) ||
                (locationLower.includes('reykjavik') &&
                  destinationAirport.includes('reykjavik')) ||
                (destinationAirport.length > 0 &&
                  locationLower.includes(destinationAirport.split(' ')[0]));

              console.log(
                `          Match results: originMatch=${originMatch}, destinationMatch=${destinationMatch}`,
              );

              if (direction === 'pickup') {
                // For pickup, prefer destination airport if it matches
                if (destinationMatch) {
                  matchingFlights.push({
                    flight,
                    placeId: flight.destinationPlaceId,
                    matchType: 'Name match pickup to destination',
                    timeDiff,
                    isAfter,
                  });
                } else if (originMatch) {
                  matchingFlights.push({
                    flight,
                    placeId: flight.originPlaceId,
                    matchType: 'Name match pickup to origin',
                    timeDiff,
                    isAfter,
                  });
                }
              } else {
                // For dropoff, prefer origin airport if it matches
                if (originMatch) {
                  matchingFlights.push({
                    flight,
                    placeId: flight.originPlaceId,
                    matchType: 'Name match dropoff to origin',
                    timeDiff,
                    isAfter,
                  });
                } else if (destinationMatch) {
                  matchingFlights.push({
                    flight,
                    placeId: flight.destinationPlaceId,
                    matchType: 'Name match dropoff to destination',
                    timeDiff,
                    isAfter,
                  });
                }
              }
            }
          }

          // Select the best matching flight based on timing
          if (matchingFlights.length > 0) {
            console.log(
              `    📊 Found ${matchingFlights.length} matching flights, selecting best by timing...`,
            );

            // Sort by: 1) flights after transfer first, 2) closest time difference
            const sortedMatches = matchingFlights.sort((a, b) => {
              // Prioritize flights that occur after the transfer
              if (a.isAfter !== b.isAfter) {
                return b.isAfter ? 1 : -1; // b.isAfter comes first
              }
              // Then by closest time difference
              return a.timeDiff - b.timeDiff;
            });

            const bestMatch = sortedMatches[0];
            console.log(
              `    ✅ BEST MATCH: ${bestMatch.matchType} - placeId=${bestMatch.placeId}`,
            );
            console.log(
              `       Flight occurs ${bestMatch.isAfter ? 'after' : 'before'} transfer, time diff: ${Math.round(bestMatch.timeDiff / (1000 * 60))} minutes`,
            );

            return bestMatch.placeId;
          } else {
            console.log(`    ❌ No airport matches found`);
          }

          // Try to match hotel names
          console.log(`    🏨 Checking ${hotels.length} hotels for matches...`);
          for (const hotel of hotels) {
            const hotelData =
              typeof hotel.data === 'string'
                ? JSON.parse(hotel.data || '{}')
                : hotel.data || {};
            const hotelName = hotelData.hotelName || hotel.title || '';

            console.log(
              `       🏨 Hotel: "${hotelName}" (placeId=${hotel.originPlaceId})`,
            );

            const nameMatch =
              hotelName &&
              (locationLower.includes(hotelName.toLowerCase()) ||
                hotelName.toLowerCase().includes(locationLower));
            const genericMatch =
              locationLower.includes('hotel') || locationLower === 'hotel';

            console.log(
              `          Name match: ${nameMatch}, Generic match: ${genericMatch}`,
            );

            if (hotelName && (nameMatch || genericMatch)) {
              console.log(
                `          ✅ HOTEL MATCH: Using placeId=${hotel.originPlaceId}`,
              );
              return hotel.originPlaceId;
            }
            console.log(`          ❌ No match for this hotel`);
          }

          console.log(`    ❌ No location matches found`);
          return null;
        }

        // Helper function to find temporal matches
        function findTemporalMatches(transfer: any, allItems: any[]) {
          if (!transfer.startDate)
            return { originPlaceId: null, destinationPlaceId: null };

          const transferTime = new Date(transfer.startDate);
          const timeWindow = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

          let originPlaceId = null;
          let destinationPlaceId = null;

          // Find items within time window
          const nearbyItems = allItems.filter((item) => {
            if (!item.startDate) return false;
            const itemTime = new Date(item.startDate);
            const timeDiff = Math.abs(
              transferTime.getTime() - itemTime.getTime(),
            );
            return timeDiff <= timeWindow;
          });

          // Look for pickup connections (transfer after item ends)
          let closestPickupItem = null;
          let closestPickupTimeDiff = Infinity;

          for (const item of nearbyItems) {
            if (item.type === 'flight') {
              // For flights, use END time (arrival time) and check it's before or at transfer time
              const flightEndTime = new Date(item.endDate || item.startDate);
              if (flightEndTime <= transferTime) {
                const timeDiff =
                  transferTime.getTime() - flightEndTime.getTime();
                if (
                  timeDiff <= timeWindow &&
                  timeDiff < closestPickupTimeDiff
                ) {
                  closestPickupItem = item;
                  closestPickupTimeDiff = timeDiff;
                }
              }
            } else if (item.type === 'hotel') {
              // For hotels, use existing logic (checkout time)
              const itemEndTime = new Date(item.endDate || item.startDate);
              if (
                transferTime >= itemEndTime &&
                transferTime.getTime() - itemEndTime.getTime() <= timeWindow
              ) {
                const timeDiff = transferTime.getTime() - itemEndTime.getTime();
                if (timeDiff < closestPickupTimeDiff) {
                  closestPickupItem = item;
                  closestPickupTimeDiff = timeDiff;
                }
              }
            }
          }

          if (closestPickupItem) {
            if (closestPickupItem.type === 'flight') {
              originPlaceId = closestPickupItem.destinationPlaceId; // Pickup from flight destination (where passenger arrives)
            } else if (closestPickupItem.type === 'hotel') {
              originPlaceId = closestPickupItem.originPlaceId; // Pickup from hotel
            }
          }

          // Look for dropoff connections (transfer before item starts)
          let closestDropoffItem = null;
          let closestDropoffTimeDiff = Infinity;

          for (const item of nearbyItems) {
            const itemStartTime = new Date(item.startDate);
            if (transferTime <= itemStartTime) {
              const timeDiff = itemStartTime.getTime() - transferTime.getTime();
              if (timeDiff <= timeWindow && timeDiff < closestDropoffTimeDiff) {
                if (item.type === 'flight') {
                  closestDropoffItem = item;
                  closestDropoffTimeDiff = timeDiff;
                  destinationPlaceId = item.originPlaceId; // Dropoff to flight origin
                } else if (item.type === 'hotel') {
                  closestDropoffItem = item;
                  closestDropoffTimeDiff = timeDiff;
                  destinationPlaceId = item.originPlaceId; // Dropoff to hotel
                }
              }
            }
          }

          return { originPlaceId, destinationPlaceId };
        }

        // Link transfer places after all items are processed
        await linkTransferPlaces(processedItems);

        // Replace the items array with our processed format
        extractedData.items = processedItems;
        extractedData.places = []; // No longer extracting places from AI

        console.log(
          `Extracted ${extractedData.places.length} places and ${extractedData.items.length} items`,
        );

        // Create places first (if any)
        const placeIdMap: Record<string, string> = {};
        const validPlaceTypes = [
          'hotel',
          'restaurant',
          'attraction',
          'venue',
          'airport',
        ];

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
                shortName: placeData.shortName || null,
                type: placeType,
                address: placeData.address || null,
                city: placeData.city || null,
                state: placeData.state || null,
                country: placeData.country || null,
                postalCode: placeData.postalCode || null,
                timezone: placeData.timezone || null,
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

        // Create flight items with FlightAware-enriched data
        if (extractedData.items && Array.isArray(extractedData.items)) {
          for (const itemData of extractedData.items) {
            // Convert datetime strings to Date objects while preserving local time

            let startDate = null;
            let endDate = null;

            if (itemData.startDate) {
              // Handle both Date objects and ISO strings
              if (itemData.startDate instanceof Date) {
                startDate = itemData.startDate;
              } else {
                // Parse as UTC to preserve the raw time values without timezone interpretation
                const parts = itemData.startDate.match(
                  /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
                );
                if (parts) {
                  startDate = new Date(
                    Date.UTC(
                      parseInt(parts[1]), // year
                      parseInt(parts[2]) - 1, // month (0-indexed)
                      parseInt(parts[3]), // day
                      parseInt(parts[4]), // hour
                      parseInt(parts[5]), // minute
                    ),
                  );
                }
              }
            }

            if (itemData.endDate) {
              // Handle both Date objects and ISO strings
              if (itemData.endDate instanceof Date) {
                endDate = itemData.endDate;
              } else {
                // Parse as UTC to preserve the raw time values without timezone interpretation
                const parts = itemData.endDate.match(
                  /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
                );
                if (parts) {
                  endDate = new Date(
                    Date.UTC(
                      parseInt(parts[1]), // year
                      parseInt(parts[2]) - 1, // month (0-indexed)
                      parseInt(parts[3]), // day
                      parseInt(parts[4]), // hour
                      parseInt(parts[5]), // minute
                    ),
                  );
                }
              }
            }

            // Generate title based on item type
            let generatedTitle = 'Item';
            let itemType = itemData.type || 'flight';
            let itemIcon = 'flight';

            if (itemType === 'flight') {
              const flightNumber = itemData.data?.flightNumber || 'Flight';
              const carrierCode = itemData.data?.carrierCode || '';
              generatedTitle = carrierCode
                ? `${carrierCode} ${flightNumber}`
                : flightNumber;
              itemIcon = 'flight';
            } else if (itemType === 'hotel') {
              generatedTitle =
                itemData.data?.hotelName || itemData.title || 'Hotel Stay';
              itemIcon = 'hotel';
            } else if (itemType === 'transfer') {
              generatedTitle =
                itemData.data?.contactName ||
                itemData.title ||
                'Transfer Service';
              itemIcon = 'transfer';
            } else if (itemType === 'activity') {
              generatedTitle = itemData.title || 'Activity';
              itemIcon = 'activities';
            } else if (itemType === 'restaurant') {
              generatedTitle = itemData.title || 'Restaurant';
              itemIcon = 'restaurant';
            }

            console.log(
              `Creating database item for ${itemType} ${generatedTitle}: originPlaceId=${itemData.originPlaceId}, destinationPlaceId=${itemData.destinationPlaceId}`,
            );

            const [newItem] = await db
              .insert(items)
              .values({
                tripId,
                type: itemType,
                title: generatedTitle,
                description: null,
                icon: itemIcon,
                startDate,
                endDate,
                originPlaceId: itemData.originPlaceId || null,
                destinationPlaceId: itemData.destinationPlaceId || null,
                originLocationSpecific: itemData.originLocationSpecific || null,
                destinationLocationSpecific:
                  itemData.destinationLocationSpecific || null,
                cost: null,
                status: 'pending',
                phoneNumber: null,
                confirmationNumber: itemData.confirmationNumber || null,
                clientBooked: itemData.clientBooked || false,
                data: itemData.data ? JSON.stringify(itemData.data) : null,
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
