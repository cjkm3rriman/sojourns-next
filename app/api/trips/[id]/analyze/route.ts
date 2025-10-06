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
import { findOrCreateHotel, findOrCreateRestaurant } from './utils/places';
import {
  findOrCreateAirport,
  processFlightItem,
} from './processors/flight-processor';
import { processHotelItem } from './processors/hotel-processor';
import { processTransferItem } from './processors/transfer-processor';
import { processRestaurantItem } from './processors/restaurant-processor';
import { processActivityItem } from './processors/activity-processor';

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

        // Step 3: Use Responses API with GPT-4o and vector store
        const userMessage = `Extract flight, hotel, transfer, activity, AND restaurant information from "${doc.originalName}". Return JSON with flights (flight number, departure/arrival times, class, confirmation), hotels (hotel name, check-in/out times, room category, perks, confirmation), transfers (contact name, pickup/dropoff times, transfer type, vehicle info, confirmation), activities (activity name, start/end times, activity type, contact, service, confirmation), and restaurants (restaurant name, reservation times, cuisine type, party size, confirmation).`;

        console.log('Analyzing document with GPT-5 Responses API...');

        const aiStartTime = Date.now();
        const response = await openai.responses.create({
          model: 'gpt-5',
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

        console.log(`GPT-5 analysis completed (${processingTimeMs}ms)`);

        // Extract the text response
        const rawAnalysisResult = response.output_text || response.output || '';

        // Convert to string if it's an array
        const analysisResult = Array.isArray(rawAnalysisResult)
          ? JSON.stringify(rawAnalysisResult)
          : rawAnalysisResult;

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
            await processFlightItem(
              item,
              tripId,
              db,
              createdPlaces,
              processedItems,
            );
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
