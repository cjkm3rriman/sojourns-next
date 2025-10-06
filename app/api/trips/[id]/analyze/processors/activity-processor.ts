// Process activity item
export async function processActivityItem(
  item: any,
  db: any,
  createdPlaces: any[],
  processedItems: any[],
) {
  console.log(`Processing activity: ${item.activityName}`);

  // Parse start/end times
  let startDate = null;
  let endDate = null;

  if (item.startDateTime) {
    // Handle both Date objects and ISO strings
    if (item.startDateTime instanceof Date) {
      startDate = item.startDateTime;
    } else if (typeof item.startDateTime === 'string') {
      const parts = item.startDateTime.match(
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
    // Handle both Date objects and ISO strings
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

  // Generate 5-word title from activity name
  const generateTitle = (activityName: string): string => {
    if (!activityName) return 'Activity';

    const words = activityName.split(' ').filter((word) => word.length > 0);

    // Remove common words to focus on key terms
    const stopWords = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      '&',
      '-',
    ];
    const filteredWords = words.filter(
      (word) => !stopWords.includes(word.toLowerCase()) && word.length > 1,
    );

    // Take first 5 meaningful words
    const titleWords = filteredWords.slice(0, 5);

    // If we don't have enough words, fall back to original words
    if (titleWords.length < 3) {
      return words.slice(0, 5).join(' ');
    }

    return titleWords.join(' ');
  };

  const processedItem = {
    type: 'activity',
    title: item.activityTitle || generateTitle(item.activityName || ''),
    description: item.activityName || '',
    info: '', // Will be populated from activity notes/requirements
    startDate: startDate,
    endDate: endDate,
    originPlaceId: null, // TODO: Parse pickup location if possible
    destinationPlaceId: null, // TODO: Parse dropoff location if possible
    originLocationSpecific: null,
    destinationLocationSpecific: null,
    confirmationNumber: item.confirmationNumber || null,
    clientBooked: false, // Activities are typically arranged by the travel agent
    data: {
      contactName: item.contactName || null,
      service: item.service || null,
      activityType: item.activityType || null,
      vehicleType: item.vehicleType || null,
      placesVisited: [], // TODO: Extract places from activity name/description
    },
  };

  console.log(`Activity ${item.activityName}: processed activity item`);
  processedItems.push(processedItem);
}
