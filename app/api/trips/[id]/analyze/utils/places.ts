import { getDb } from '@/lib/db';
import { places } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Helper function to find or create restaurant place
export async function findOrCreateRestaurant(
  restaurantName: string,
  db: any,
  createdPlaces: any[] = [],
  city?: string,
  state?: string,
  country?: string,
): Promise<string | null> {
  try {
    console.log(`Looking up restaurant: ${restaurantName}`);

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

    // Build enhanced search query with location context
    let searchQuery = restaurantName;
    if (city) {
      searchQuery += ` ${city}`;
    }
    if (state) {
      searchQuery += ` ${state}`;
    }
    if (country) {
      searchQuery += ` ${country}`;
    }

    console.log(`Google Places search query: "${searchQuery}"`);

    // Use the new Places API (New) with Text Search
    const placesResponse = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesApiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.id,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary,places.utcOffsetMinutes,places.types,places.primaryType,places.photos',
        },
        body: JSON.stringify({
          textQuery: searchQuery,
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

    // Log place types for debugging
    console.log(
      `Restaurant "${restaurantName}" - primaryType: ${place.primaryType || 'N/A'}, types: ${place.types ? place.types.join(', ') : 'N/A'}`,
    );

    // Check if this Google Place ID already exists in our database
    if (place.id) {
      const existingByGoogleId = await db
        .select()
        .from(places)
        .where(eq(places.googlePlaceId, place.id))
        .limit(1);

      if (existingByGoogleId.length > 0) {
        console.log(
          `Found existing restaurant by Google Place ID: ${restaurantName} -> ${existingByGoogleId[0].id}`,
        );
        return existingByGoogleId[0].id;
      }
    }

    // Parse address components for structured data
    let streetAddress = null;
    let parsedCity = null;
    let parsedState = null;
    let parsedCountry = null;
    let postalCode = null;

    if (place.addressComponents) {
      for (const component of place.addressComponents) {
        const types = component.types || [];

        // Street number and route combine to form street address
        if (types.includes('street_number') || types.includes('route')) {
          streetAddress = streetAddress
            ? `${streetAddress} ${component.longText || component.shortText}`
            : component.longText || component.shortText;
        }

        // City
        if (types.includes('locality')) {
          parsedCity = component.longText || component.shortText;
        }

        // State/Province
        if (types.includes('administrative_area_level_1')) {
          parsedState = component.shortText || component.longText;
        }

        // Country
        if (types.includes('country')) {
          parsedCountry = component.shortText || component.longText;
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

    // Fetch photo URLs from Google Places
    let photoUrls: string[] = [];
    if (place.photos && place.photos.length > 0) {
      console.log(`Fetching ${Math.min(place.photos.length, 5)} photos for ${restaurantName}`);
      // Take up to 5 photos
      const photosToFetch = place.photos.slice(0, 5);
      for (const photo of photosToFetch) {
        try {
          // Construct photo URL with max dimensions
          const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${googlePlacesApiKey}&maxHeightPx=800&maxWidthPx=800`;
          photoUrls.push(photoUrl);
        } catch (photoError) {
          console.warn(`Error processing photo for ${restaurantName}:`, photoError);
        }
      }
      console.log(`Added ${photoUrls.length} photo URLs for ${restaurantName}`);
    }

    // Create new restaurant place from Google Places data
    const [newRestaurant] = await db
      .insert(places)
      .values({
        name: place.displayName?.text || restaurantName,
        shortName: null,
        type: 'restaurant',
        googlePlaceId: place.id || null,
        address: streetAddress || place.formattedAddress || null,
        city: parsedCity,
        state: parsedState,
        country: parsedCountry,
        postalCode: postalCode,
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        timezone: timezone,
        phone: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        description: place.editorialSummary?.text || 'Restaurant',
        photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      })
      .returning();

    console.log(
      `Created new restaurant place: ${restaurantName} -> ${newRestaurant.id}`,
    );
    createdPlaces.push(newRestaurant);
    return newRestaurant.id;
  } catch (error) {
    console.error(
      `Error finding/creating restaurant ${restaurantName}:`,
      error,
    );
    return null;
  }
}

// Helper function to find or create hotel place
export async function findOrCreateHotel(
  hotelName: string,
  db: any,
  createdPlaces: any[] = [],
  city?: string,
  state?: string,
  country?: string,
): Promise<string | null> {
  try {
    console.log(`Looking up hotel: ${hotelName}`);

    // Check if we already created this hotel in this session
    const alreadyCreated = createdPlaces.find(
      (p) => p.name === hotelName && p.type === 'hotel',
    );
    if (alreadyCreated) {
      console.log(
        `Already created hotel in this session: ${hotelName} -> ${alreadyCreated.id}`,
      );
      return alreadyCreated.id;
    }

    const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googlePlacesApiKey) {
      console.warn(
        'GOOGLE_PLACES_API_KEY not set, creating hotel with name only',
      );

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

    // Build enhanced search query with location context
    let searchQuery = hotelName;
    if (city) {
      searchQuery += ` ${city}`;
    }
    if (state) {
      searchQuery += ` ${state}`;
    }
    if (country) {
      searchQuery += ` ${country}`;
    }

    console.log(`Google Places search query: "${searchQuery}"`);

    // Use the new Places API (New) with Text Search
    const placesResponse = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesApiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.id,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary,places.utcOffsetMinutes,places.photos',
        },
        body: JSON.stringify({
          textQuery: searchQuery,
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

    // Check if this Google Place ID already exists in our database
    if (place.id) {
      const existingByGoogleId = await db
        .select()
        .from(places)
        .where(eq(places.googlePlaceId, place.id))
        .limit(1);

      if (existingByGoogleId.length > 0) {
        console.log(
          `Found existing hotel by Google Place ID: ${hotelName} -> ${existingByGoogleId[0].id}`,
        );
        return existingByGoogleId[0].id;
      }
    }

    // Parse address components for structured data
    let streetAddress = null;
    let parsedCity = null;
    let parsedState = null;
    let parsedCountry = null;
    let postalCode = null;

    if (place.addressComponents) {
      for (const component of place.addressComponents) {
        const types = component.types || [];

        // Street number and route combine to form street address
        if (types.includes('street_number') || types.includes('route')) {
          streetAddress = streetAddress
            ? `${streetAddress} ${component.longText || component.shortText}`
            : component.longText || component.shortText;
        }

        // City
        if (types.includes('locality')) {
          parsedCity = component.longText || component.shortText;
        }

        // State/Province
        if (types.includes('administrative_area_level_1')) {
          parsedState = component.shortText || component.longText;
        }

        // Country
        if (types.includes('country')) {
          parsedCountry = component.shortText || component.longText;
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

    // Fetch photo URLs from Google Places
    let photoUrls: string[] = [];
    if (place.photos && place.photos.length > 0) {
      console.log(`Fetching ${Math.min(place.photos.length, 5)} photos for ${hotelName}`);
      // Take up to 5 photos
      const photosToFetch = place.photos.slice(0, 5);
      for (const photo of photosToFetch) {
        try {
          // Construct photo URL with max dimensions
          const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${googlePlacesApiKey}&maxHeightPx=800&maxWidthPx=800`;
          photoUrls.push(photoUrl);
        } catch (photoError) {
          console.warn(`Error processing photo for ${hotelName}:`, photoError);
        }
      }
      console.log(`Added ${photoUrls.length} photo URLs for ${hotelName}`);
    }

    // Create new hotel place from Google Places data
    const [newHotel] = await db
      .insert(places)
      .values({
        name: place.displayName?.text || hotelName,
        shortName: null,
        type: 'hotel',
        googlePlaceId: place.id || null,
        address: streetAddress || place.formattedAddress || null,
        city: parsedCity,
        state: parsedState,
        country: parsedCountry,
        postalCode: postalCode,
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        timezone: timezone,
        phone: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        description: place.editorialSummary?.text || 'Hotel',
        photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
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
