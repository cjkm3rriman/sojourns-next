import { findOrCreateHotel } from '../utils/places';

// Process hotel item
export async function processHotelItem(
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
      item.city,
      item.state,
      item.country,
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
