import { eq, and, like } from 'drizzle-orm';
import { places, items } from '@/lib/db/schema';

// Helper function to find or create airport place
export async function findOrCreateAirport(
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
      .where(and(eq(places.shortName, iataCode), eq(places.type, 'airport')))
      .limit(1);

    if (existingAirport.length > 0) {
      console.log(
        `Found existing airport: ${iataCode} -> ${existingAirport[0].id}`,
      );
      return existingAirport[0].id;
    }

    // Check if we already created this airport in this session
    const alreadyCreated = createdPlaces.find(
      (p) => p.shortName === iataCode && p.type === 'airport',
    );
    if (alreadyCreated) {
      console.log(
        `Already created airport in this session: ${iataCode} -> ${alreadyCreated.id}`,
      );
      return alreadyCreated.id;
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

// Process flight item
export async function processFlightItem(
  item: any,
  tripId: string,
  db: any,
  createdPlaces: any[],
  processedItems: any[],
) {
  try {
    // Check if this flight already exists in the trip by checking the title field
    // Flight titles are formatted as "AA 123" or just "123"
    const existingFlight = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.tripId, tripId),
          eq(items.type, 'flight'),
          like(items.title, `%${item.flightNumber}%`),
        ),
      )
      .limit(1);

    if (existingFlight.length > 0) {
      console.log(
        `Flight ${item.flightNumber} already exists in trip, skipping`,
      );
      return;
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
      ? item.class.charAt(0).toUpperCase() + item.class.slice(1).toLowerCase()
      : null;

    let mappedData = {
      flightNumber: item.flightNumber || null,
      carrierCode: null, // Will be populated from OAG if available
      class: capitalizedClass, // Class of service from AI extraction (capitalized)
    };

    // If we have OAG data, use the first flight result
    if (oagFlightData && oagFlightData.data && oagFlightData.data.length > 0) {
      const firstFlight = oagFlightData.data[0];

      // Extract scheduled times from OAG response
      if (firstFlight.departure && firstFlight.arrival) {
        // Use departure timing - combine date and time
        if (firstFlight.departure.date && firstFlight.departure.time) {
          mappedStartDate = `${firstFlight.departure.date.local}T${firstFlight.departure.time.local}`;
          console.log(`Using OAG departure time (local): ${mappedStartDate}`);
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

    if (oagFlightData && oagFlightData.data && oagFlightData.data.length > 0) {
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
        console.log(`Destination terminal: ${destinationLocationSpecific}`);
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
  } catch (error) {
    console.error(`Error processing flight ${item.flightNumber}:`, error);
  }
}
