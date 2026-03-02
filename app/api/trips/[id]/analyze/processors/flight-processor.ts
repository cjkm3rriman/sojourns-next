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

    // Airport doesn't exist, query AirLabs airports API
    console.log(
      `Airport ${iataCode} not found, querying AirLabs airports API`,
    );

    const airportResponse = await fetch(
      `https://airlabs.co/api/v9/airports?api_key=${process.env.AIRLABS_API_KEY}&iata_code=${iataCode}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!airportResponse.ok) {
      console.warn(
        `AirLabs airports API error for ${iataCode}: ${airportResponse.status} ${airportResponse.statusText}`,
      );
      return null;
    }

    const airportDataResponse = await airportResponse.json();

    // AirLabs returns an array in the 'response' field
    if (!airportDataResponse.response || airportDataResponse.response.length === 0) {
      console.warn(`No airport data found for ${iataCode} in AirLabs response`);
      return null;
    }

    const airportData = airportDataResponse.response[0];

    // Create new airport place from AirLabs data
    const [newAirport] = await db
      .insert(places)
      .values({
        name: airportData.name || `${iataCode} Airport`,
        shortName: iataCode,
        type: 'airport',
        city: airportData.city || null,
        state: null, // AirLabs doesn't provide state information
        country: airportData.country_code || null,
        lat: airportData.lat || null,
        lng: airportData.lng || null,
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

    let airlabsFlightData = null;

    // Call AirLabs API for each flight
    if (item.flightNumber) {
      try {
        // Parse flight number into carrier code and flight number for AirLabs
        const flightIdent = item.flightNumber.replace(/\s+/g, ''); // Remove spaces (AA 123 -> AA123)
        const match = flightIdent.match(/^([A-Z0-9]{2})(\d+)$/);

        if (!match) {
          console.warn(
            `Invalid flight number format for AirLabs: ${item.flightNumber}`,
          );
          return;
        }

        const carrierCode = match[1];
        const flightNumber = match[2];

        // Prepare departure and arrival dates from extracted data
        const departureDateISO = item.departureDateTime
          ? new Date(item.departureDateTime).toISOString().split('T')[0]
          : null; // YYYY-MM-DD
        const arrivalDateISO = item.arrivalDateTime
          ? new Date(item.arrivalDateTime).toISOString().split('T')[0]
          : null; // YYYY-MM-DD

        console.log(
          `Calling AirLabs API for flight ${carrierCode}${flightNumber}`,
        );

        // Call AirLabs Routes API
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries && !airlabsFlightData) {
          if (retryCount > 0) {
            console.log(
              `Retrying AirLabs API call for ${carrierCode}${flightNumber} (attempt ${retryCount + 1})`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount),
            );
          }

          try {
            const airlabsResponse = await fetch(
              `https://airlabs.co/api/v9/routes?api_key=${process.env.AIRLABS_API_KEY}&airline_iata=${carrierCode}&flight_number=${flightNumber}`,
              {
                headers: {
                  Accept: 'application/json',
                },
              },
            );

            if (airlabsResponse.ok) {
              airlabsFlightData = await airlabsResponse.json();
              console.log(
                `AirLabs response for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}): Success`,
              );
              break; // Success, exit retry loop
            } else {
              console.warn(
                `AirLabs API error for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}): ${airlabsResponse.status} ${airlabsResponse.statusText}`,
              );
              const errorText = await airlabsResponse.text();
              console.warn(`AirLabs error response:`, errorText);
            }
          } catch (fetchError) {
            console.warn(
              `AirLabs API fetch error for ${carrierCode}${flightNumber} (attempt ${retryCount + 1}):`,
              fetchError,
            );
          }

          retryCount++;
        }
      } catch (apiError) {
        console.error(
          `Error calling AirLabs API for flight ${item.flightNumber}:`,
          apiError,
        );
      }
    }

    // Map flight data to our structure
    let mappedStartDate = item.departureDateTime || null;
    let mappedEndDate = item.arrivalDateTime || null;
    // Capitalize class if present
    const capitalizedClass = item.class
      ? item.class.charAt(0).toUpperCase() + item.class.slice(1).toLowerCase()
      : null;

    let mappedData = {
      flightNumber: item.flightNumber || null,
      carrierCode: null, // Will be populated from API if available
      class: capitalizedClass, // Class of service from AI extraction (capitalized)
    };

    // If we have AirLabs data, use the first flight result
    if (
      airlabsFlightData &&
      airlabsFlightData.response &&
      airlabsFlightData.response.length > 0
    ) {
      const firstFlight = airlabsFlightData.response[0];

      const departureDateISO = item.departureDateTime
        ? new Date(item.departureDateTime).toISOString().split('T')[0]
        : null;
      const arrivalDateISO = item.arrivalDateTime
        ? new Date(item.arrivalDateTime).toISOString().split('T')[0]
        : null;

      // Use departure timing - combine date from extraction and time from AirLabs
      if (departureDateISO && firstFlight.dep_time) {
        mappedStartDate = `${departureDateISO}T${firstFlight.dep_time}`;
        console.log(`Using AirLabs departure time (local): ${mappedStartDate}`);
      }

      // Use arrival timing - combine date from extraction and time from AirLabs
      if (arrivalDateISO && firstFlight.arr_time) {
        mappedEndDate = `${arrivalDateISO}T${firstFlight.arr_time}`;
        console.log(`Using AirLabs arrival time (local): ${mappedEndDate}`);
      } else if (departureDateISO && firstFlight.arr_time) {
        // Arrival date not extracted, so we infer it
        if (firstFlight.arr_time < firstFlight.dep_time) {
          // Overnight flight, add one day to departure date
          const nextDay = new Date(departureDateISO);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayISO = nextDay.toISOString().split('T')[0];
          mappedEndDate = `${nextDayISO}T${firstFlight.arr_time}`;
          console.log(
            `Inferred overnight flight, using AirLabs arrival time: ${mappedEndDate}`,
          );
        } else {
          // Same day flight
          mappedEndDate = `${departureDateISO}T${firstFlight.arr_time}`;
          console.log(
            `Inferred same-day flight, using AirLabs arrival time: ${mappedEndDate}`,
          );
        }
      }

      // Add essential flight information to data field
      if (firstFlight.airline_iata && firstFlight.flight_number) {
        mappedData = {
          carrierCode: firstFlight.airline_iata || null,
          flightNumber: firstFlight.flight_number || null,
          class: mappedData.class, // Preserve class from AI extraction
        };

        console.log(
          `Mapped AirLabs flight data: Carrier=${firstFlight.airline_iata}, Flight=${firstFlight.flight_number}, Class=${mappedData.class}`,
        );
      }

      // Calculate missing departure or arrival time using duration (only if one is missing)
      if (firstFlight.duration && (mappedStartDate || mappedEndDate)) {
        const hasStart = mappedStartDate !== null;
        const hasEnd = mappedEndDate !== null;

        // Helper to format date as local ISO string (YYYY-MM-DDTHH:MM:SS)
        const formatLocalISO = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        // Only calculate if exactly one is missing
        if (hasStart && !hasEnd) {
          // Calculate arrival from departure + duration
          const durationMinutes = firstFlight.duration;
          const departureTime = new Date(mappedStartDate);
          const arrivalTime = new Date(
            departureTime.getTime() + durationMinutes * 60 * 1000,
          );
          mappedEndDate = formatLocalISO(arrivalTime);
          console.log(
            `Calculated arrival time from duration: ${mappedEndDate} (departure + ${durationMinutes} min)`,
          );
        } else if (!hasStart && hasEnd) {
          // Calculate departure from arrival - duration
          const durationMinutes = firstFlight.duration;
          const arrivalTime = new Date(mappedEndDate);
          const departureTime = new Date(
            arrivalTime.getTime() - durationMinutes * 60 * 1000,
          );
          mappedStartDate = formatLocalISO(departureTime);
          console.log(
            `Calculated departure time from duration: ${mappedStartDate} (arrival - ${durationMinutes} min)`,
          );
        }
      }
    }

    // Handle airport places and terminal info for origin and destination using AirLabs data
    let originPlaceId = null;
    let destinationPlaceId = null;
    let originLocationSpecific = null;
    let destinationLocationSpecific = null;

    if (
      airlabsFlightData &&
      airlabsFlightData.response &&
      airlabsFlightData.response.length > 0
    ) {
      const firstFlight = airlabsFlightData.response[0];

      // Process origin airport from AirLabs departure data
      if (firstFlight.dep_iata) {
        originPlaceId = await findOrCreateAirport(
          firstFlight.dep_iata,
          db,
          createdPlaces,
        );
        console.log(`Origin airport: ${firstFlight.dep_iata} -> ${originPlaceId}`);
      }

      // Process destination airport from AirLabs arrival data
      if (firstFlight.arr_iata) {
        destinationPlaceId = await findOrCreateAirport(
          firstFlight.arr_iata,
          db,
          createdPlaces,
        );
        console.log(
          `Destination airport: ${firstFlight.arr_iata} -> ${destinationPlaceId}`,
        );
      }

      // Extract terminal information from AirLabs format
      if (firstFlight.dep_terminals && firstFlight.dep_terminals.length > 0) {
        const terminal = firstFlight.dep_terminals[0].trim();
        // If single number or letter, prefix with 'T'
        originLocationSpecific = /^[0-9A-Za-z]$/.test(terminal)
          ? `T${terminal}`
          : terminal;
        console.log(`Origin terminal: ${originLocationSpecific}`);
      }

      if (firstFlight.arr_terminals && firstFlight.arr_terminals.length > 0) {
        const terminal = firstFlight.arr_terminals[0].trim();
        // If single number or letter, prefix with 'T'
        destinationLocationSpecific = /^[0-9A-Za-z]$/.test(terminal)
          ? `T${terminal}`
          : terminal;
        console.log(`Destination terminal: ${destinationLocationSpecific}`);
      }
    } else {
      console.warn(
        `No AirLabs data available for flight ${item.flightNumber}, will attempt fallback airport creation if possible`,
      );

      // TODO: Add fallback logic here to extract airport codes from flight route info
      // For now, we'll rely on the user to manually add airport information
    }

    // Look up place names from createdPlaces array
    const originPlace = createdPlaces.find((p) => p.id === originPlaceId);
    const destinationPlace = createdPlaces.find(
      (p) => p.id === destinationPlaceId,
    );

    // Create processed item with mapped AirLabs data
    const processedItem = {
      type: 'flight',
      title: '', // Will be auto-generated
      description: '', // Will be auto-generated
      startDate: mappedStartDate,
      endDate: mappedEndDate,
      originPlaceId,
      destinationPlaceId,
      originPlaceName: originPlace?.name || null,
      originPlaceCity: originPlace?.city || null,
      destinationPlaceName: destinationPlace?.name || null,
      destinationPlaceCity: destinationPlace?.city || null,
      originLocationSpecific,
      destinationLocationSpecific,
      confirmationNumber: item.confirmationNumber || null,
      clientBooked: item.clientBooked || false,
      data: mappedData,
    };

    console.log(
      `Flight ${item.flightNumber}: originPlaceId=${originPlaceId} (${originPlace?.name}), destinationPlaceId=${destinationPlaceId} (${destinationPlace?.name})`,
    );

    processedItems.push(processedItem);
  } catch (error) {
    console.error(`Error processing flight ${item.flightNumber}:`, error);
  }
}
