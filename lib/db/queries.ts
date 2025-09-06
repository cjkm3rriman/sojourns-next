import { eq, and } from 'drizzle-orm';
import { getDb } from './connection';
import { organizations, users, memberships } from './schema';

// Organization queries
export async function getOrganizationByClerkId(clerkOrgId: string) {
  const db = getDb();
  return db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);
}

export async function createOrganization(data: {
  clerkOrgId: string;
  name: string;
  slug: string;
}) {
  const db = getDb();
  return db.insert(organizations).values(data).returning();
}

// User queries
export async function getUserByClerkId(clerkUserId: string) {
  const db = getDb();
  return db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
}

export async function createUser(data: {
  clerkUserId: string;
  email: string;
  name: string;
  role: 'agent' | 'traveler';
}) {
  const db = getDb();
  return db.insert(users).values(data).returning();
}

// Membership queries
export async function getUserMemberships(userId: string) {
  const db = getDb();
  return db
    .select({
      membership: memberships,
      organization: organizations,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
}

export async function createMembership(data: {
  userId: string;
  organizationId: string;
  role: 'admin' | 'agent' | 'member';
}) {
  const db = getDb();
  return db.insert(memberships).values(data).returning();
}

export async function getUserInOrganization(
  userId: string,
  organizationId: string,
) {
  const db = getDb();
  return db
    .select({
      user: users,
      membership: memberships,
    })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.userId))
    .where(
      and(eq(users.id, userId), eq(memberships.organizationId, organizationId)),
    )
    .limit(1);
}
