import OpenAI from 'openai';
import { getDb } from '@/lib/db';
import { items, places } from '@/lib/db/schema';
import { TRAVEL_ANALYZER_SYSTEM_INSTRUCTIONS } from '../prompt';
import { processFlightItem } from '../processors/flight-processor';
import { processHotelItem } from '../processors/hotel-processor';
import { processTransferItem } from '../processors/transfer-processor';
import { processActivityItem } from '../processors/activity-processor';
import { processRestaurantItem } from '../processors/restaurant-processor';

/**
 * Call GPT-5.2 Responses API to analyze text/document and extract trip items
 */
export async function analyzeWithAI(
  userMessage: string,
  vectorStoreId: string,
  openai: OpenAI,
): Promise<any> {
  console.log('Analyzing with GPT-5.2 Responses API...');

  const aiStartTime = Date.now();
  const response = await openai.responses.create({
    model: 'gpt-5.2',
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

  console.log(`GPT-5.2 analysis completed (${processingTimeMs}ms)`);

  // Extract the text response
  const rawAnalysisResult = response.output_text || response.output || '';

  // Convert to string if it's an array
  const analysisResult = Array.isArray(rawAnalysisResult)
    ? JSON.stringify(rawAnalysisResult)
    : rawAnalysisResult;

  if (!analysisResult) {
    throw new Error('No analysis result from GPT-5.2');
  }

  console.log(`AI Response:`, analysisResult);

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

    // Fallback: Create a basic item structure
    console.log(`Falling back to basic item creation`);

    extractedData = {
      items: [
        {
          type: 'activity',
          activityName: 'Unknown',
          activityTitle: 'Manual Review Required',
          startDateTime: null,
          endDateTime: null,
          data: {
            extractedFromAI: false,
            fallbackReason: `AI analysis failed. Original response: ${analysisResult.substring(0, 100)}...`,
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

  return extractedData;
}

/**
 * Process extracted items through type-specific processors and link transfers
 */
export async function processExtractedItems(
  extractedData: any,
  tripId: string,
  db: ReturnType<typeof getDb>,
  createdPlaces: any[],
  createdItems: any[],
): Promise<void> {
  // Process each extracted item through type-specific processors
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

  // Create items with enriched data
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
}
