import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
  boolean,
  real,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['agent', 'traveler']);
export const membershipRoleEnum = pgEnum('membership_role', [
  'admin',
  'agent',
  'member',
]);
export const tripStatusEnum = pgEnum('trip_status', [
  'draft',
  'proposal',
  'confirmed',
  'cancelled',
]);
export const itemTypeEnum = pgEnum('item_type', [
  'flight',
  'hotel',
  'transfer',
  'restaurant',
  'activity',
]);
export const placeTypeEnum = pgEnum('place_type', [
  'hotel',
  'restaurant',
  'attraction',
  'venue',
  'airport',
]);

// Organizations table - represents travel agencies
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  flightsPhoneNumber: text('flights_phone_number'), // Flight desk phone number for the organization
  fromEmail: text('from_email'), // e.g. "Luxury Travel <hello@myagency.com>", fallback to RESEND_FROM env var
  logoSquareUrl: text('logo_square_url'),
  logoWordmarkUrl: text('logo_wordmark_url'),
  headerImageUrl: text('header_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users table - both agents and travelers
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').unique().notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull(),
  revealPin: text('reveal_pin'), // bcrypt hash, nullable until set
  revealPinAttempts: integer('reveal_pin_attempts').default(0).notNull(),
  revealPinLockedUntil: timestamp('reveal_pin_locked_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Memberships table - links users to organizations with roles
export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  role: membershipRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Trips table - travel itineraries managed by agents
export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Core trip info
  clientName: text('client_name').notNull(),
  destination: text('destination'),
  tripSummary: text('trip_summary'),
  icon: text('icon'), // Icon reference for trip type (beach, city, mountain, etc.)

  // Relationships
  agentId: uuid('agent_id')
    .references(() => users.id)
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  partnerId: uuid('partner_id'), // Future: references partners table

  // Trip details
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: tripStatusEnum('status').default('draft').notNull(),
  groupSize: integer('group_size'),
  flightsPhoneNumber: text('flights_phone_number'), // International format phone number
  notes: text('notes'),

  // Client access
  shareToken: text('share_token').unique(),

  // OpenAI Vector Store for document analysis
  vectorStoreId: text('vector_store_id'),

  // Future activity logging
  version: integer('version').default(1).notNull(),

  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Places table - reusable entities like hotels, restaurants, attractions
export const places = pgTable('places', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic info
  name: text('name').notNull(),
  shortName: text('short_name'), // Short display name (e.g., "JFK", "Hotel Hassler", "Central Park")
  type: placeTypeEnum('type').notNull(),
  description: text('description'),

  // External IDs
  googlePlaceId: text('google_place_id'), // Stable Google Places API ID for deduplication

  // Contact & location
  address: text('address'),
  city: text('city'),
  cityDisplay: text('city_display'), // Formatted city name for display (e.g., "New York, NY", "Rome, Italy")
  state: text('state'),
  country: text('country'),
  postalCode: text('postal_code'),
  lat: real('lat'), // Latitude coordinate
  lng: real('lng'), // Longitude coordinate
  timezone: text('timezone'), // e.g., "America/New_York", "Europe/Rome"
  phone: text('phone'),
  email: text('email'),
  website: text('website'),

  // Media
  photos: text('photos'), // JSON array of photo URLs

  // Business details
  priceRange: text('price_range'), // "$$$", "Luxury", etc.
  rating: text('rating'), // "4.5/5", "Michelin Star"

  // Flexible data for type-specific info
  data: text('data'), // JSON: amenities for hotels, cuisine for restaurants

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Items table - individual itinerary items
export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships
  tripId: uuid('trip_id')
    .references(() => trips.id)
    .notNull(),
  type: itemTypeEnum('type').notNull(),

  // Standard display fields
  title: text('title').notNull(), // "Delta Flight to Rome", "Hotel Hassler", "Dinner at Osteria"
  description: text('description'), // Longer description/notes
  icon: text('icon'), // ✈️ 🏨 🚗 🍽️ 🎭

  // Timing (most items have some time component) - local times without timezone
  startDate: timestamp('start_date', { withTimezone: false }), // Flight departure, hotel check-in, activity start
  endDate: timestamp('end_date', { withTimezone: false }), // Flight arrival, hotel check-out, activity end

  // Location references to places
  originPlaceId: uuid('origin_place_id').references(() => places.id), // Origin place reference
  destinationPlaceId: uuid('destination_place_id').references(() => places.id), // Destination place reference

  // Specific location details within places
  originLocationSpecific: text('origin_location_specific'), // e.g., "Terminal 3", "Gate A12", "Hotel Lobby"
  destinationLocationSpecific: text('destination_location_specific'), // e.g., "Baggage Claim", "Arrivals Hall"

  // Business
  cost: text('cost'), // Flexible: "$500", "€200 per person", "Included"
  status: text('status').default('pending'), // "confirmed", "pending", "cancelled"

  // Contact information
  phoneNumber: text('phone_number'), // International format with country code (e.g., "+1234567890")
  confirmationNumber: text('confirmation_number'), // Flight confirmation, hotel booking reference, etc.

  // Agent notes
  notes: text('notes'), // Agent notes and comments for this item

  // Client booking status
  clientBooked: boolean('client_booked').default(false).notNull(), // Whether client has booked this item

  // Organization
  sortOrder: integer('sort_order').default(0), // For day-by-day ordering

  // Type-specific flexible data
  data: text('data'), // JSON for airline codes, room types, etc.

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Clients table - CRM foundation for traveler profiles
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  middleName: text('middle_name'),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth'), // YYYY-MM-DD
  weddingAnniversary: text('wedding_anniversary'), // YYYY-MM-DD
  email: text('email'),
  phone: text('phone'),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country'),
  allergies: text('allergies'),
  flightPreferences: text('flight_preferences'),
  otherPreferences: text('other_preferences'),
  notes: text('notes'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  agentId: uuid('agent_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Client cards table - stores card metadata; sensitive data lives in 1Password
export const clientCards = pgTable('client_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => clients.id)
    .notNull(),
  last4: text('last_4').notNull(),
  expiry: text('expiry').notNull(), // MM/YYYY
  cardType: text('card_type'), // Visa, Mastercard, Amex, etc.
  opItemId: text('op_item_id').notNull(), // 1Password item ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Client passports table - stores passport metadata; sensitive data lives in 1Password
export const clientPassports = pgTable('client_passports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => clients.id)
    .notNull(),
  issuingCountry: text('issuing_country'),
  expiryDate: text('expiry_date').notNull(), // YYYY-MM-DD
  opItemId: text('op_item_id').notNull(), // 1Password item ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Documents table - track uploaded files and their processing status
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id)
    .notNull(),

  // File info
  filename: text('filename').notNull(), // Generated unique filename
  originalName: text('original_name').notNull(), // User's original filename
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),

  // Storage location
  r2Key: text('r2_key').notNull(), // Path in R2 bucket
  r2Url: text('r2_url'), // Public URL if needed

  // Processing status
  status: text('status').default('uploaded').notNull(), // uploaded, processing, processed, failed, ignored
  extractedData: text('extracted_data'), // JSON from AI processing
  errorMessage: text('error_message'), // If processing failed

  // OpenAI integration
  openaiFileId: text('openai_file_id'), // OpenAI file reference for reuse

  // Upload context
  uploadedBy: uuid('uploaded_by')
    .references(() => users.id)
    .notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  trips: many(trips),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  trips: many(trips),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  agent: one(users, {
    fields: [trips.agentId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [trips.organizationId],
    references: [organizations.id],
  }),
  items: many(items),
  documents: many(documents),
}));

export const placesRelations = relations(places, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  trip: one(trips, {
    fields: [items.tripId],
    references: [trips.id],
  }),
  originPlace: one(places, {
    fields: [items.originPlaceId],
    references: [places.id],
  }),
  destinationPlace: one(places, {
    fields: [items.destinationPlaceId],
    references: [places.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  trip: one(trips, {
    fields: [documents.tripId],
    references: [trips.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  agent: one(users, {
    fields: [clients.agentId],
    references: [users.id],
  }),
  cards: many(clientCards),
  passports: many(clientPassports),
  loyalty: many(clientLoyalty),
  portal: one(clientPortals, {
    fields: [clients.id],
    references: [clientPortals.clientId],
  }),
}));

export const clientCardsRelations = relations(clientCards, ({ one }) => ({
  client: one(clients, {
    fields: [clientCards.clientId],
    references: [clients.id],
  }),
}));

export const clientPassportsRelations = relations(clientPassports, ({ one }) => ({
  client: one(clients, {
    fields: [clientPassports.clientId],
    references: [clients.id],
  }),
}));

// Client loyalty programs — frequent flyer, hotel points, KTN, etc.
export const clientLoyalty = pgTable('client_loyalty', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  programName: text('program_name').notNull(),
  memberNumber: text('member_number').notNull(),
  expiryDate: text('expiry_date'), // YYYY-MM-DD, nullable
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Client portals — one per client; stable slug for portal URL
export const clientPortals = pgTable('client_portals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull().unique(),
  slug: text('slug').unique().notNull(), // nanoid(10) — stable portal URL identifier
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Portal tokens — magic link tokens; sections set at send time by link flavour
export const portalTokens = pgTable('portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id').references(() => clientPortals.id).notNull(),
  token: text('token').unique().notNull(), // nanoid(48)
  sections: text('sections').notNull(), // JSON string[] e.g. '["profile","preferences"]'
  usedAt: timestamp('used_at'), // null = unused; set on first use
  expiresAt: timestamp('expires_at').notNull(), // createdAt + 24h
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Portal sessions — created when client clicks magic link; valid 2 hours
export const portalSessions = pgTable('portal_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id').references(() => clientPortals.id).notNull(),
  sessionToken: text('session_token').unique().notNull(), // nanoid(64)
  sections: text('sections').notNull(), // copied from token at session creation
  expiresAt: timestamp('expires_at').notNull(), // createdAt + 2h
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clientPortalsRelations = relations(clientPortals, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientPortals.clientId],
    references: [clients.id],
  }),
  tokens: many(portalTokens),
  sessions: many(portalSessions),
}));

export const portalTokensRelations = relations(portalTokens, ({ one }) => ({
  portal: one(clientPortals, {
    fields: [portalTokens.portalId],
    references: [clientPortals.id],
  }),
}));

export const portalSessionsRelations = relations(portalSessions, ({ one }) => ({
  portal: one(clientPortals, {
    fields: [portalSessions.portalId],
    references: [clientPortals.id],
  }),
}));

export const clientLoyaltyRelations = relations(clientLoyalty, ({ one }) => ({
  client: one(clients, {
    fields: [clientLoyalty.clientId],
    references: [clients.id],
  }),
}));
