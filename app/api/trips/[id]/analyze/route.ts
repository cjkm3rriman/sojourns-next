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
            'places.displayName,places.formattedAddress,places.location,places.id',
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

    // Create new hotel place from Google Places data
    const [newHotel] = await db
      .insert(places)
      .values({
        name: place.displayName?.text || hotelName,
        shortName: null,
        type: 'hotel',
        address: place.formattedAddress || null,
        city: null, // TODO: Parse from formattedAddress if needed
        state: null, // TODO: Parse from formattedAddress if needed
        country: null, // TODO: Parse from formattedAddress if needed
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        timezone: null,
        description: `Hotel`,
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
          instructions: `You are a travel document analyzer. Extract flight, hotel, AND transfer information from travel documents.

⚠️ IMPORTANT: Always look for TRANSFERS! Many documents contain transfer information that gets missed. Look for words like "transfer", "vehicle", "departs from", "arrives to", "car service", "pickup", etc.

FOR FLIGHTS - EXTRACT THESE 6 FIELDS:
1. Flight number (e.g., "AA123", "DL456") - REQUIRED
2. Departure datetime in local time - OPTIONAL
3. Arrival datetime in local time - OPTIONAL
4. Client booked (boolean) - OPTIONAL
5. Class of service - OPTIONAL
6. Confirmation number - OPTIONAL

FOR HOTELS - EXTRACT THESE 6 FIELDS:
1. Hotel name - REQUIRED
2. Check-in datetime in local time - OPTIONAL
3. Check-out datetime in local time - OPTIONAL
4. Room category/type - OPTIONAL
5. Perks/amenities (array of strings) - OPTIONAL
6. Confirmation number - OPTIONAL

FOR TRANSFERS - EXTRACT THESE 6 FIELDS:
1. Contact name/company (can be service description if no company name) - REQUIRED
2. Pickup datetime in local time - OPTIONAL
3. Dropoff datetime in local time - OPTIONAL
4. Transfer type (airport pickup, hotel transfer, private car, etc.) - OPTIONAL
5. Vehicle information (car type, license plate, driver name, etc.) - OPTIONAL
6. Confirmation number - OPTIONAL

❌ CRITICAL DATETIME RULES - READ CAREFULLY ❌:
- ONLY extract times that are EXPLICITLY stated in the document
- DO NOT guess, infer, or calculate missing times
- If you see "arrives 6:15 AM" - ONLY set arrivalDateTime, leave departureDateTime as null
- If you see "departs 7:30 PM" - ONLY set departureDateTime, leave arrivalDateTime as null
- If you see both departure and arrival times - set both fields
- If you see neither - set both fields to null
- ❌ NEVER set departureDateTime and arrivalDateTime to the same time
- ❌ NEVER copy one time to the other field
- ❌ NEVER assume or calculate the missing time based on the other time
- ❌ WRONG: {"departureDateTime": "2025-10-07T06:15:00", "arrivalDateTime": "2025-10-07T06:15:00"}
- ✅ CORRECT: {"departureDateTime": null, "arrivalDateTime": "2025-10-07T06:15:00"}

HOTEL IDENTIFICATION KEYWORDS:
- Look for: "check in", "check-in", "check out", "check-out", "your stay", "hotel", "accommodation", "room", "suite", "booking", "reservation"
- Hotel confirmation patterns: "Hotel confirmation:", "Booking reference:", "Reservation number:", "Hotel booking:"

TRANSFER IDENTIFICATION KEYWORDS:
- Look for: "transfer", "pickup", "pick up", "pick-up", "driver", "car service", "transportation", "shuttle", "taxi", "private car", "meet and greet", "airport transfer", "hotel transfer", "private airport transfer", "transfer departs", "transfer arrives"
- Transfer confirmation patterns: "Transfer confirmation:", "Driver details:", "Pickup details:", "Transportation booking:", "Car service confirmation:"
- Location specifics: "pickup location", "departure point", "arrival terminal", "hotel lobby", "baggage claim", "meeting point", "departs from", "arrives to"
- Vehicle patterns: "Vehicle Type:", "Luxury Sedan", "S-Class", "vehicle details"

CRITICAL: ALWAYS SCAN FOR THREE TYPES OF ITEMS:
1. FLIGHTS - Any flight information
2. HOTELS - Any hotel/accommodation information
3. TRANSFERS - ANY transportation between locations (this is often missed!)

TRANSFER DETECTION IS CRITICAL:
- Look for ANY mention of transportation, pickup, drop-off, car service, transfer, driver
- Even simple phrases like "transfer departs" or "vehicle type" indicate a transfer
- DO NOT skip transfers - they are as important as flights and hotels
- Extract each transfer as a separate item
- Include connecting flights as separate items
- Include multi-night hotel stays as single items
- Ignore restaurants, activities (for now)

Return a JSON response with this structure:
{
  "items": [
    {
      "type": "flight",
      "flightNumber": "AA 123",
      "departureDateTime": "2024-03-15T10:30:00",
      "arrivalDateTime": "2024-03-15T22:15:00",
      "clientBooked": false,
      "class": "business",
      "confirmationNumber": "ABC123"
    },
    {
      "type": "hotel",
      "hotelName": "Marriott Downtown",
      "checkInDateTime": "2024-03-15T15:00:00",
      "checkOutDateTime": "2024-03-18T11:00:00",
      "roomCategory": "King Executive Suite",
      "perks": ["Free WiFi", "Executive Lounge Access"],
      "confirmationNumber": "HTL456"
    },
    {
      "type": "transfer",
      "contactName": "Elite Car Service",
      "pickupDateTime": "2024-03-15T14:00:00",
      "dropoffDateTime": "2024-03-15T14:30:00",
      "transferType": "airport pickup",
      "vehicleInfo": "Black Mercedes S-Class, License: ABC123, Driver: John Smith",
      "confirmationNumber": "TXF789"
    }
  ]
}

RULES:
- Flight number format: "XX 123" (airline code space flight number)
- Use ISO format YYYY-MM-DDTHH:MM:SS for datetimes (no timezone)
- Times should be in local time as shown in the document
- Ignore timezone indicators (EST, PST, etc.) - just extract the local time
- ❌ CRITICAL: Set departureDateTime or arrivalDateTime to null if not explicitly stated in the document
- ❌ NEVER infer one time from the other - if only arrival time is shown, departureDateTime must be null
- ❌ NEVER infer one time from the other - if only departure time is shown, arrivalDateTime must be null
- ❌ NEVER set both times to the same value unless the document explicitly shows both the same time
- ✅ Only extract times you are confident about - it's better to leave null than guess
- ✅ If you see only "arrives 6:15 AM" → departureDateTime: null, arrivalDateTime: "06:15:00"
- ✅ If you see only "departs 7:30 PM" → departureDateTime: "19:30:00", arrivalDateTime: null
- Set clientBooked to true ONLY if you see explicit phrases like "own arrangement", "(own arrangement)", "booked by client", "booked by guest", "client booking" - DO NOT GUESS, set to false if uncertain
- Set clientBooked to false by default unless explicitly indicated otherwise
- For class, look for explicit mentions of: "first", "first class", "upper class", "business", "business class", "premium economy", "economy", "economy plus", "economy class", "club world", "main cabin", "coach"
- Normalize class values to: "first", "business", "premium economy", "economy" (use these exact strings)
- Set class to null if no class information is clearly stated - DO NOT GUESS the class
- For confirmation numbers, look for: "PNR:", "Confirmation:", "Conf:", "Reference:", "Ref:", "Booking:", "Record Locator:", "Reservation:", "Airline confirmation:", "Flight confirmation:", "Hotel confirmation:", "Hotel booking:", "Booking reference:", "Reservation number:", "Confirmation code:", "Confirmation #:", or alphanumeric codes near these terms
- Extract confirmation numbers as they appear (preserve original format and case)
- IMPORTANT: If only ONE confirmation number appears in the document, apply it to ALL flights extracted from that document (outbound and return flights often share the same confirmation)
- If multiple different confirmation numbers exist, match them to their specific flights
- Hotels typically have separate confirmation numbers from flights
- For hotels: extract room categories like "Standard Room", "King Suite", "Executive Room", "Deluxe Double", etc. as they appear
- For hotel perks: look for amenities like "Free WiFi", "Breakfast Included", "Pool Access", "Spa Access", "Executive Lounge", "Late Checkout", "Room Upgrade", etc.
- Set confirmationNumber to null if no clear confirmation number is found - DO NOT GUESS
- IMPORTANT: Better to leave clientBooked, class, and confirmationNumber blank/null than to guess incorrectly
- Extract EVERY flight mentioned in the document
- Return ONLY valid JSON, no explanations or markdown

EXAMPLES:
Input: "Flight AA123 departing JFK March 15 at 10:30 AM EST"
Output: {"items": [{"type": "flight", "flightNumber": "AA 123", "departureDateTime": "2024-03-15T10:30:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": null}]}

Input: "Delta 456 Atlanta to LAX March 16, departs 2:15 PM EST, arrives 4:45 PM PST Business Class - PNR: XYZ789"
Output: {"items": [{"type": "flight", "flightNumber": "DL 456", "departureDateTime": "2024-03-16T14:15:00", "arrivalDateTime": "2024-03-16T16:45:00", "clientBooked": false, "class": "business", "confirmationNumber": "XYZ789"}]}

Input: "United flight UA789 Economy Plus - no times specified"
Output: {"items": [{"type": "flight", "flightNumber": "UA 789", "departureDateTime": null, "arrivalDateTime": null, "clientBooked": false, "class": "premium economy", "confirmationNumber": null}]}

Input: "Icelandair Flight FI 622. Flight arrives to Keflavik (KEF) at 6:15 AM. Confirmation: KEF456"
Output: {"items": [{"type": "flight", "flightNumber": "FI 622", "departureDateTime": null, "arrivalDateTime": "2024-03-15T06:15:00", "clientBooked": false, "class": null, "confirmationNumber": "KEF456"}]}

Input: "Flight EI 111 departs Shannon at 11:00 AM. Confirmation: ABC123"
Output: {"items": [{"type": "flight", "flightNumber": "EI 111", "departureDateTime": "2024-03-15T11:00:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": "ABC123"}]}

Input: "Flight FI 622 arrives at 6:15 AM (own arrangement). Confirmation: 82111287"
Output: {"items": [{"type": "flight", "flightNumber": "FI 622", "departureDateTime": null, "arrivalDateTime": "2025-10-07T06:15:00", "clientBooked": true, "class": null, "confirmationNumber": "82111287"}]}

Input: "Flight BA456 London to Paris 2:30 PM First Class - Own arrangement by client - Ref: ABC123"
Output: {"items": [{"type": "flight", "flightNumber": "BA 456", "departureDateTime": "2024-03-15T14:30:00", "arrivalDateTime": null, "clientBooked": true, "class": "first", "confirmationNumber": "ABC123"}]}

Input: "Check in to Marriott Downtown March 15 at 3:00 PM. Check out March 18 at 11:00 AM. King Executive Suite with Executive Lounge Access and Free WiFi. Hotel confirmation: HTL789"
Output: {"items": [{"type": "hotel", "hotelName": "Marriott Downtown", "checkInDateTime": "2024-03-15T15:00:00", "checkOutDateTime": "2024-03-18T11:00:00", "roomCategory": "King Executive Suite", "perks": ["Executive Lounge Access", "Free WiFi"], "confirmationNumber": "HTL789"}]}

Input: "Airport transfer pickup at Terminal 1 Arrivals March 15 at 2:00 PM. Elite Car Service driver John Smith with Black Mercedes S-Class. Transfer confirmation: CAR456"
Output: {"items": [{"type": "transfer", "contactName": "Elite Car Service", "pickupDateTime": "2024-03-15T14:00:00", "dropoffDateTime": null, "transferType": "airport pickup", "vehicleInfo": "Black Mercedes S-Class, Driver: John Smith", "confirmationNumber": "CAR456"}]}

Input: "Private car service from hotel to airport March 18 at 10:30 AM. Premium Transfers - Driver will meet in hotel lobby. Booking reference: PT789"
Output: {"items": [{"type": "transfer", "contactName": "Premium Transfers", "pickupDateTime": "2024-03-18T10:30:00", "dropoffDateTime": null, "transferType": "hotel transfer", "vehicleInfo": "Driver will meet in hotel lobby", "confirmationNumber": "PT789"}]}

Input: "Private Airport Transfer 6:15 AM - Transfer departs from Keflavik International Airport (KEF) Transfer arrives to The Reykjavik EDITION Vehicle Type: Luxury Sedan (S-Class or similar)"
Output: {"items": [{"type": "transfer", "contactName": "Private Airport Transfer", "pickupDateTime": "2025-10-07T06:15:00", "dropoffDateTime": null, "transferType": "airport transfer", "vehicleInfo": "Luxury Sedan (S-Class or similar)", "confirmationNumber": null}]}

Input: "Private Airport Transfer\\n6:15 AM - Transfer departs from Keflavik International Airport\\nTransfer arrives to The Reykjavik EDITION\\nVehicle Type: Luxury Sedan"
Output: {"items": [{"type": "transfer", "contactName": "Private Airport Transfer", "pickupDateTime": "2025-10-07T06:15:00", "dropoffDateTime": null, "transferType": "airport transfer", "vehicleInfo": "Luxury Sedan", "confirmationNumber": null}]}

Input: "Your stay at The Plaza Hotel begins March 20. Deluxe Room. Breakfast included and late checkout available. Booking reference: PLZ456"
Output: {"items": [{"type": "hotel", "hotelName": "The Plaza Hotel", "checkInDateTime": "2024-03-20T15:00:00", "checkOutDateTime": null, "roomCategory": "Deluxe Room", "perks": ["Breakfast included", "Late checkout"], "confirmationNumber": "PLZ456"}]}

Input: "Virgin Atlantic VS123 Club World seat 2A departing 6:45 PM Record Locator: GHI789"
Output: {"items": [{"type": "flight", "flightNumber": "VS 123", "departureDateTime": "2024-03-15T18:45:00", "arrivalDateTime": null, "clientBooked": false, "class": "business", "confirmationNumber": "GHI789"}]}

Input: "Flight LH456 Frankfurt to Munich 3:15 PM (own arrangement)"
Output: {"items": [{"type": "flight", "flightNumber": "LH 456", "departureDateTime": "2024-03-15T15:15:00", "arrivalDateTime": null, "clientBooked": true, "class": null, "confirmationNumber": null}]}

Input: "Aer Lingus EI110 JFK to Shannon 7:30 PM - Airline confirmation: 24IT7W"
Output: {"items": [{"type": "flight", "flightNumber": "EI 110", "departureDateTime": "2024-03-15T19:30:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": "24IT7W"}]}

Input: "Outbound: Flight EI110 JFK to Shannon March 19 7:30 PM. Return: Flight EI111 Shannon to JFK March 25 11:00 AM. Airline confirmation: 24IT7W"
Output: {"items": [{"type": "flight", "flightNumber": "EI 110", "departureDateTime": "2024-03-19T19:30:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": "24IT7W"}, {"type": "flight", "flightNumber": "EI 111", "departureDateTime": "2024-03-25T11:00:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": "24IT7W"}]}`,
          model: 'gpt-4o',
          tools: [{ type: 'file_search' }],
        });

        console.log(`Created assistant:`, assistant.id);

        // Create a thread with the uploaded file
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: 'user',
              content: `Extract flight and hotel information from "${doc.originalName}". Return JSON with flights (flight number, departure/arrival times, class, confirmation) and hotels (hotel name, check-in/out times, room category, perks, confirmation).`,
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
        const aiStartTime = Date.now();
        const runStatus = await openai.beta.threads.runs.createAndPoll(
          thread.id,
          {
            assistant_id: assistant.id,
          },
        );
        const aiEndTime = Date.now();
        const processingTimeMs = aiEndTime - aiStartTime;

        console.log(
          `Run completed with status: ${runStatus.status} (${processingTimeMs}ms)`,
        );

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
              transferType: item.transferType || null,
              vehicleInfo: item.vehicleInfo || null,
            },
          };

          console.log(`Transfer ${item.contactName}: processed transfer item`);
          processedItems.push(processedItem);
        }

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
            console.log(`Raw startDate from OAG: ${itemData.startDate}`);
            console.log(`Raw endDate from OAG: ${itemData.endDate}`);

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
                  console.log(
                    `Parsed startDate as UTC: ${startDate.toISOString()}`,
                  );
                  console.log(`Local representation: ${startDate.toString()}`);
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
                  console.log(
                    `Parsed endDate as UTC: ${endDate.toISOString()}`,
                  );
                  console.log(`Local representation: ${endDate.toString()}`);
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
