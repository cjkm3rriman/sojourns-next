import { findOrCreateRestaurant } from '../utils/places';

// Process restaurant item
export async function processRestaurantItem(
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
      item.city,
      item.state,
      item.country,
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

  console.log(`Restaurant ${item.restaurantName}: processed restaurant item`);
  processedItems.push(processedItem);
}
