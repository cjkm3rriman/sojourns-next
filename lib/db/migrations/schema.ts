import {
  pgTable,
  unique,
  uuid,
  text,
  timestamp,
  foreignKey,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const itemType = pgEnum('item_type', [
  'flight',
  'hotel',
  'transfer',
  'restaurant',
  'activity',
]);
export const membershipRole = pgEnum('membership_role', [
  'admin',
  'agent',
  'member',
]);
export const placeType = pgEnum('place_type', [
  'hotel',
  'restaurant',
  'attraction',
  'venue',
]);
export const tripStatus = pgEnum('trip_status', [
  'draft',
  'planning',
  'confirmed',
  'cancelled',
]);
export const userRole = pgEnum('user_role', ['agent', 'traveler']);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clerkOrgId: text('clerk_org_id').notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('organizations_clerk_org_id_unique').on(table.clerkOrgId),
    unique('organizations_slug_unique').on(table.slug),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text().notNull(),
    name: text().notNull(),
    role: userRole().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('users_clerk_user_id_unique').on(table.clerkUserId)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    role: membershipRole().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'memberships_user_id_users_id_fk',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'memberships_organization_id_organizations_id_fk',
    }),
  ],
);

export const trips = pgTable(
  'trips',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientName: text('client_name').notNull(),
    destination: text(),
    tripSummary: text('trip_summary'),
    agentId: uuid('agent_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    partnerId: uuid('partner_id'),
    startDate: timestamp('start_date', { mode: 'string' }),
    endDate: timestamp('end_date', { mode: 'string' }),
    status: tripStatus().default('draft').notNull(),
    notes: text(),
    shareToken: text('share_token'),
    version: integer().default(1).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    icon: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [users.id],
      name: 'trips_agent_id_users_id_fk',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'trips_organization_id_organizations_id_fk',
    }),
    unique('trips_share_token_unique').on(table.shareToken),
  ],
);

export const places = pgTable('places', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  type: placeType().notNull(),
  description: text(),
  address: text(),
  phone: text(),
  email: text(),
  website: text(),
  photos: text(),
  priceRange: text('price_range'),
  rating: text(),
  data: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const documents = pgTable(
  'documents',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tripId: uuid('trip_id').notNull(),
    filename: text().notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    r2Key: text('r2_key').notNull(),
    r2Url: text('r2_url'),
    status: text().default('uploaded').notNull(),
    extractedData: text('extracted_data'),
    errorMessage: text('error_message'),
    uploadedBy: uuid('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    openaiFileId: text('openai_file_id'),
  },
  (table) => [
    foreignKey({
      columns: [table.tripId],
      foreignColumns: [trips.id],
      name: 'documents_trip_id_trips_id_fk',
    }),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
      name: 'documents_uploaded_by_users_id_fk',
    }),
  ],
);

export const items = pgTable(
  'items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tripId: uuid('trip_id').notNull(),
    type: itemType().notNull(),
    placeId: uuid('place_id'),
    title: text().notNull(),
    description: text(),
    icon: text(),
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }),
    endDate: timestamp('end_date', { withTimezone: true, mode: 'string' }),
    location: text(),
    cost: text(),
    status: text().default('pending'),
    sortOrder: integer('sort_order').default(0),
    data: text(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .notNull(),
    timezone: text(),
    originLocation: text('origin_location'),
    destinationLocation: text('destination_location'),
    phoneNumber: text('phone_number'),
    confirmationNumber: text('confirmation_number'),
  },
  (table) => [
    foreignKey({
      columns: [table.tripId],
      foreignColumns: [trips.id],
      name: 'items_trip_id_trips_id_fk',
    }),
    foreignKey({
      columns: [table.placeId],
      foreignColumns: [places.id],
      name: 'items_place_id_places_id_fk',
    }),
  ],
);
