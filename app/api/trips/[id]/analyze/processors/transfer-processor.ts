// Process transfer item
export async function processTransferItem(
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
