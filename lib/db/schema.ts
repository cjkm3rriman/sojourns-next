import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
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
  'planning',
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
]);

// Organizations table - represents travel agencies
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
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
  notes: text('notes'),

  // Client access
  shareToken: text('share_token').unique(),

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
  type: placeTypeEnum('type').notNull(),
  description: text('description'),

  // Contact & location
  address: text('address'),
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

  // Optional reference to a place (for hotels, restaurants, attractions)
  placeId: uuid('place_id').references(() => places.id), // NULL for flights/transfers

  // Standard display fields
  title: text('title').notNull(), // "Delta Flight to Rome", "Hotel Hassler", "Dinner at Osteria"
  description: text('description'), // Longer description/notes
  icon: text('icon'), // ✈️ 🏨 🚗 🍽️ 🎭

  // Timing (most items have some time component)
  startDate: timestamp('start_date', { withTimezone: true }), // Flight departure, hotel check-in, activity start
  endDate: timestamp('end_date', { withTimezone: true }), // Flight arrival, hotel check-out, activity end
  timezone: text('timezone'), // e.g., "Europe/Rome", "America/New_York"

  // Location (almost all items have a location)
  location: text('location'), // "JFK Airport", "Via Sistina 69, Rome", "Colosseum"

  // Business
  cost: text('cost'), // Flexible: "$500", "€200 per person", "Included"
  status: text('status').default('pending'), // "confirmed", "pending", "cancelled"

  // Organization
  sortOrder: integer('sort_order').default(0), // For day-by-day ordering

  // Type-specific flexible data
  data: text('data'), // JSON for airline codes, room types, etc.

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  status: text('status').default('uploaded').notNull(), // uploaded, processing, processed, failed
  extractedData: text('extracted_data'), // JSON from AI processing
  errorMessage: text('error_message'), // If processing failed

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
  place: one(places, {
    fields: [items.placeId],
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
