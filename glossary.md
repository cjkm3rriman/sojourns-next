# Sojourns System Glossary

## Location Structure & Place Usage Patterns

### Core Concepts

**Places**: Reusable location entities in the database representing real-world locations like airports, hotels, restaurants, attractions, train stations, etc.

**Items**: Individual itinerary components (flights, hotels, transfers, restaurants, activities) that reference places for their locations.

### Place Reference Pattern

All items use a consistent **origin → destination** pattern for location references:

#### Single-Location Items

For items that occur at one location, we use `origin_place_id`:

- **Hotels**: `origin_place_id` = the hotel, `destination_place_id` = null
- **Restaurants**: `origin_place_id` = the restaurant, `destination_place_id` = null
- **Activities**: `origin_place_id` = the venue/attraction, `destination_place_id` = null

#### Travel Items

For items involving movement between locations:

- **Flights**: `origin_place_id` = departure airport, `destination_place_id` = arrival airport
- **Transfers**: `origin_place_id` = pickup location, `destination_place_id` = drop-off location

### Location Specificity

Each item can also include specific details within a place:

- **`origin_location_specific`**: Terminal numbers, gate info, hotel lobby, restaurant section
- **`destination_location_specific`**: Arrival terminal, baggage claim, hotel room number

#### Examples

**Flight Example:**

- `origin_place_id` → "JFK Airport" (place)
- `origin_location_specific` → "Terminal 4"
- `destination_place_id` → "Rome Fiumicino Airport" (place)
- `destination_location_specific` → "Terminal 3"

**Hotel Example:**

- `origin_place_id` → "Hotel Hassler" (place)
- `origin_location_specific` → "Room 502" or "Rooftop Terrace"
- `destination_place_id` → null

**Transfer Example:**

- `origin_place_id` → "JFK Airport" (place)
- `origin_location_specific` → "Arrivals Hall"
- `destination_place_id` → "Hotel Hassler" (place)
- `destination_location_specific` → "Main Entrance"

### Timezone Handling

Items support separate timezones for start and end times:

- **`start_timezone`**: Timezone at the origin location
- **`end_timezone`**: Timezone at the destination location (important for flights crossing time zones)

### Benefits of This Structure

1. **Reusability**: Places can be shared across multiple trips and items
2. **Consistency**: All items follow the same origin → destination pattern
3. **Specificity**: Detailed location information stored separately from place names
4. **Scalability**: Easy to add new place types and location details
5. **Data Integrity**: Foreign key relationships ensure valid place references

### Database Schema

```sql
-- Places table stores reusable location entities
places (
  id, name, type, address, phone, email, website, description, ...
)

-- Items reference places for their locations
items (
  id, trip_id, type, title, description,
  origin_place_id → references places(id),
  destination_place_id → references places(id),
  origin_location_specific,
  destination_location_specific,
  start_timezone, end_timezone,
  ...
)
```

This structure provides a disciplined, scalable approach to location management that works consistently across all travel item types.
