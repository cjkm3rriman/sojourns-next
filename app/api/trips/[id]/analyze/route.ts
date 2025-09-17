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
          instructions: `You are a flight document analyzer. Extract ONLY basic flight information from travel documents.

EXTRACT ONLY THESE 6 FIELDS:
1. Flight number (e.g., "AA123", "DL456") - REQUIRED
2. Departure datetime in local time - OPTIONAL
3. Arrival datetime in local time - OPTIONAL
4. Client booked (boolean) - OPTIONAL
5. Class of service - OPTIONAL
6. Confirmation number - OPTIONAL

IMPORTANT: PDFs may not contain both departure and arrival times, or may contain neither. Only populate datetime fields when you are confident the information is present and accurate.

FOCUS EXCLUSIVELY ON FLIGHTS:
- Extract each flight segment as a separate item
- Include connecting flights as separate items
- Ignore hotels, restaurants, transfers, activities

Return a JSON response with this minimal structure:
{
  "items": [
    {
      "flightNumber": "AA 123",
      "departureDateTime": "2024-03-15T10:30:00",
      "arrivalDateTime": "2024-03-15T22:15:00",
      "clientBooked": false,
      "class": "business",
      "confirmationNumber": "ABC123"
    }
  ]
}

RULES:
- Flight number format: "XX 123" (airline code space flight number)
- Use ISO format YYYY-MM-DDTHH:MM:SS for datetimes (no timezone)
- Times should be in local time as shown in the document
- Ignore timezone indicators (EST, PST, etc.) - just extract the local time
- Set departureDateTime or arrivalDateTime to null if not clearly stated
- Only extract times you are confident about - it's better to leave null than guess
- Set clientBooked to true ONLY if you see explicit phrases like "own arrangement", "(own arrangement)", "booked by client", "booked by guest", "client booking" - DO NOT GUESS, set to false if uncertain
- Set clientBooked to false by default unless explicitly indicated otherwise
- For class, look for explicit mentions of: "first", "first class", "upper class", "business", "business class", "premium economy", "economy", "economy plus", "economy class", "club world", "main cabin", "coach"
- Normalize class values to: "first", "business", "premium economy", "economy" (use these exact strings)
- Set class to null if no class information is clearly stated - DO NOT GUESS the class
- For confirmation numbers, look for: "PNR:", "Confirmation:", "Conf:", "Reference:", "Ref:", "Booking:", "Record Locator:", "Reservation:", or alphanumeric codes near these terms
- Extract confirmation numbers as they appear (preserve original format and case)
- Set confirmationNumber to null if no clear confirmation number is found - DO NOT GUESS
- IMPORTANT: Better to leave clientBooked, class, and confirmationNumber blank/null than to guess incorrectly
- Extract EVERY flight mentioned in the document
- Return ONLY valid JSON, no explanations or markdown

EXAMPLES:
Input: "Flight AA123 departing JFK March 15 at 10:30 AM EST"
Output: {"items": [{"flightNumber": "AA 123", "departureDateTime": "2024-03-15T10:30:00", "arrivalDateTime": null, "clientBooked": false, "class": null, "confirmationNumber": null}]}

Input: "Delta 456 Atlanta to LAX March 16, departs 2:15 PM EST, arrives 4:45 PM PST Business Class - PNR: XYZ789"
Output: {"items": [{"flightNumber": "DL 456", "departureDateTime": "2024-03-16T14:15:00", "arrivalDateTime": "2024-03-16T16:45:00", "clientBooked": false, "class": "business", "confirmationNumber": "XYZ789"}]}

Input: "United flight UA789 Economy Plus - no times specified"
Output: {"items": [{"flightNumber": "UA 789", "departureDateTime": null, "arrivalDateTime": null, "clientBooked": false, "class": "premium economy", "confirmationNumber": null}]}

Input: "Icelandair Flight FI 622. Flight departs from Newark (EWR). 6:15 AM - Flight arrives to Keflavik (KEF). Confirmation: KEF456"
Output: {"items": [{"flightNumber": "FI 622", "departureDateTime": null, "arrivalDateTime": "2024-03-15T06:15", "clientBooked": false, "class": null, "confirmationNumber": "KEF456"}]}

Input: "Flight BA456 London to Paris 2:30 PM First Class - Own arrangement by client - Ref: ABC123"
Output: {"items": [{"flightNumber": "BA 456", "departureDateTime": "2024-03-15T14:30:00", "arrivalDateTime": null, "clientBooked": true, "class": "first", "confirmationNumber": "ABC123"}]}

Input: "Virgin Atlantic VS123 Club World seat 2A departing 6:45 PM Record Locator: GHI789"
Output: {"items": [{"flightNumber": "VS 123", "departureDateTime": "2024-03-15T18:45:00", "arrivalDateTime": null, "clientBooked": false, "class": "business", "confirmationNumber": "GHI789"}]}

Input: "Flight LH456 Frankfurt to Munich 3:15 PM (own arrangement)"
Output: {"items": [{"flightNumber": "LH 456", "departureDateTime": "2024-03-15T15:15:00", "arrivalDateTime": null, "clientBooked": true, "class": null, "confirmationNumber": null}]}`,
          model: 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
        });

        console.log(`Created assistant:`, assistant.id);

        // Create a thread with the uploaded file
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: 'user',
              content: `Extract ONLY flight numbers, departure times, and arrival times from "${doc.originalName}". Return minimal JSON with just these 3 fields per flight.`,
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

        // Convert simplified extraction format and enrich with Amadeus data
        const processedItems = [];

        for (const item of extractedData.items) {
          let amadeusFlightData = null;

          // Call Amadeus API for each flight
          if (item.flightNumber) {
            try {
              // Parse flight number into carrier code and flight number for Amadeus
              const flightIdent = item.flightNumber.replace(/\s+/g, ''); // Remove spaces (AA 123 -> AA123)
              const match = flightIdent.match(/^([A-Z]{2,3})(\d+)$/);

              if (!match) {
                console.warn(
                  `Invalid flight number format for Amadeus: ${item.flightNumber}`,
                );
                continue;
              }

              const carrierCode = match[1];
              const flightNumber = match[2];

              // Determine scheduled departure date
              let scheduledDepartureDate = null;
              if (item.departureDateTime) {
                scheduledDepartureDate = new Date(item.departureDateTime)
                  .toISOString()
                  .split('T')[0]; // YYYY-MM-DD
              } else if (item.arrivalDateTime) {
                // If only arrival time, estimate departure date (same day or day before)
                const arrivalDate = new Date(item.arrivalDateTime);
                arrivalDate.setDate(arrivalDate.getDate() - 1); // Assume departure day before arrival
                scheduledDepartureDate = arrivalDate
                  .toISOString()
                  .split('T')[0];
              } else {
                // No times available, try today's date
                scheduledDepartureDate = new Date().toISOString().split('T')[0];
              }

              console.log(
                `Calling Amadeus API for flight ${carrierCode}${flightNumber} on ${scheduledDepartureDate}`,
              );

              // Get Amadeus access token first (using test environment)
              const tokenResponse = await fetch(
                'https://test.api.amadeus.com/v1/security/oauth2/token',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_API_KEY}&client_secret=${process.env.AMADEUS_API_SECRET}`,
                },
              );

              if (!tokenResponse.ok) {
                console.warn(
                  `Amadeus token error: ${tokenResponse.status} ${tokenResponse.statusText}`,
                );
                console.warn(
                  `Using Amadeus API Key: ${process.env.AMADEUS_API_KEY}`,
                );
                const tokenErrorText = await tokenResponse.text();
                console.warn(`Amadeus token error response:`, tokenErrorText);
                continue;
              }

              const tokenData = await tokenResponse.json();
              const accessToken = tokenData.access_token;

              // Call Amadeus On Demand Flight Status API (using test environment)
              const amadeusResponse = await fetch(
                `https://test.api.amadeus.com/v2/schedule/flights?carrierCode=${carrierCode}&flightNumber=${flightNumber}&scheduledDepartureDate=${scheduledDepartureDate}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                  },
                },
              );

              if (amadeusResponse.ok) {
                amadeusFlightData = await amadeusResponse.json();
                console.log(
                  `Amadeus response for ${carrierCode}${flightNumber}:`,
                  JSON.stringify(amadeusFlightData, null, 2),
                );
              } else {
                console.warn(
                  `Amadeus API error for ${carrierCode}${flightNumber}: ${amadeusResponse.status} ${amadeusResponse.statusText}`,
                );
                const errorText = await amadeusResponse.text();
                console.warn(`Amadeus error response:`, errorText);
              }
            } catch (amadeusError) {
              console.error(
                `Error calling Amadeus API for flight ${item.flightNumber}:`,
                amadeusError,
              );
            }
          }

          // Map Amadeus data to our structure
          let mappedStartDate = item.departureDateTime || null;
          let mappedEndDate = item.arrivalDateTime || null;
          let mappedData = {
            flightNumber: item.flightNumber || null,
            carrierCode: null, // Will be populated from Amadeus if available
            class: item.class || null, // Class of service from AI extraction
          };

          // If we have Amadeus data, use the first flight result
          if (
            amadeusFlightData &&
            amadeusFlightData.data &&
            amadeusFlightData.data.length > 0
          ) {
            const firstFlight = amadeusFlightData.data[0];

            // Extract scheduled times from Amadeus response
            if (
              firstFlight.flightPoints &&
              firstFlight.flightPoints.length >= 2
            ) {
              const departure = firstFlight.flightPoints[0];
              const arrival =
                firstFlight.flightPoints[firstFlight.flightPoints.length - 1];

              // Use departure timing (strip timezone)
              if (departure.departure && departure.departure.timings) {
                const stdTiming = departure.departure.timings.find(
                  (t: any) => t.qualifier === 'STD',
                );
                if (stdTiming) {
                  // Remove timezone info and store as local datetime
                  let localTime = stdTiming.value;
                  // Remove Z (UTC indicator)
                  if (localTime.endsWith('Z')) {
                    localTime = localTime.slice(0, -1);
                  }
                  // Remove timezone offset like +01:00 or -05:00
                  localTime = localTime.replace(/[+-]\d{2}:\d{2}$/, '');
                  mappedStartDate = localTime;
                  console.log(
                    `Using Amadeus STD (local): ${mappedStartDate} (original: ${stdTiming.value})`,
                  );
                }
              }

              // Use arrival timing (strip timezone)
              if (arrival.arrival && arrival.arrival.timings) {
                const staTiming = arrival.arrival.timings.find(
                  (t: any) => t.qualifier === 'STA',
                );
                if (staTiming) {
                  // Remove timezone info and store as local datetime
                  let localTime = staTiming.value;
                  // Remove Z (UTC indicator)
                  if (localTime.endsWith('Z')) {
                    localTime = localTime.slice(0, -1);
                  }
                  // Remove timezone offset like +01:00 or -05:00
                  localTime = localTime.replace(/[+-]\d{2}:\d{2}$/, '');
                  mappedEndDate = localTime;
                  console.log(
                    `Using Amadeus STA (local): ${mappedEndDate} (original: ${staTiming.value})`,
                  );
                }
              }
            }

            // Add essential flight information to data field
            if (firstFlight.flightDesignator) {
              mappedData = {
                carrierCode: firstFlight.flightDesignator.carrierCode || null,
                flightNumber: firstFlight.flightDesignator.flightNumber || null,
                class: mappedData.class, // Preserve class from AI extraction
              };

              console.log(
                `Mapped Amadeus flight data: Carrier=${firstFlight.flightDesignator.carrierCode}, Flight=${firstFlight.flightDesignator.flightNumber}, Class=${mappedData.class}`,
              );
            }
          }

          // Handle airport places and terminal info for origin and destination using Amadeus data + FlightAware airport details
          let originPlaceId = null;
          let destinationPlaceId = null;
          let originLocationSpecific = null;
          let destinationLocationSpecific = null;

          if (
            amadeusFlightData &&
            amadeusFlightData.data &&
            amadeusFlightData.data.length > 0
          ) {
            const firstFlight = amadeusFlightData.data[0];

            if (
              firstFlight.flightPoints &&
              firstFlight.flightPoints.length >= 2
            ) {
              const departure = firstFlight.flightPoints[0];
              const arrival =
                firstFlight.flightPoints[firstFlight.flightPoints.length - 1];

              // Process origin airport
              if (departure.iataCode) {
                originPlaceId = await findOrCreateAirport(
                  departure.iataCode,
                  db,
                  createdPlaces,
                );
              }

              // Process destination airport
              if (arrival.iataCode) {
                destinationPlaceId = await findOrCreateAirport(
                  arrival.iataCode,
                  db,
                  createdPlaces,
                );
              }

              // Extract terminal information
              if (departure.departure?.terminal?.code) {
                originLocationSpecific = departure.departure.terminal.code;
                console.log(`Origin terminal: ${originLocationSpecific}`);
              }

              if (arrival.arrival?.terminal?.code) {
                destinationLocationSpecific = arrival.arrival.terminal.code;
                console.log(
                  `Destination terminal: ${destinationLocationSpecific}`,
                );
              }
            }
          }

          // Create processed item with mapped Amadeus data
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
            data: mappedData,
          };

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
            console.log(`Raw startDate from Amadeus: ${itemData.startDate}`);
            console.log(`Raw endDate from Amadeus: ${itemData.endDate}`);

            let startDate = null;
            let endDate = null;

            if (itemData.startDate) {
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

            if (itemData.endDate) {
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
                console.log(`Parsed endDate as UTC: ${endDate.toISOString()}`);
                console.log(`Local representation: ${endDate.toString()}`);
              }
            }

            // Generate flight title from Amadeus data if available
            const flightNumber = itemData.data?.flightNumber || 'Flight';
            const carrierCode = itemData.data?.carrierCode || '';
            const generatedTitle = carrierCode
              ? `${carrierCode} ${flightNumber}`
              : flightNumber;

            const [newItem] = await db
              .insert(items)
              .values({
                tripId,
                type: 'flight',
                title: generatedTitle,
                description: null,
                icon: 'flight',
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
