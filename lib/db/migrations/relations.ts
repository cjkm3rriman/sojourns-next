import { relations } from 'drizzle-orm/relations';
import {
  users,
  memberships,
  organizations,
  trips,
  documents,
  items,
  places,
} from './schema';

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

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  trips: many(trips),
  documents: many(documents),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.agentId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [trips.organizationId],
    references: [organizations.id],
  }),
  documents: many(documents),
  items: many(items),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  trip: one(trips, {
    fields: [documents.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
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

export const placesRelations = relations(places, ({ many }) => ({
  items: many(items),
}));
