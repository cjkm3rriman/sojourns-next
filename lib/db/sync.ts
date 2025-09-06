import { getDb } from './connection';
import { organizations, users, memberships } from './schema';
import { eq, and } from 'drizzle-orm';

async function getClerkClient() {
  const mod = await import('@clerk/nextjs/server');
  return mod.clerkClient;
}

/**
 * Ensures a user exists in our database, creates if needed
 */
export async function ensureUserExists(clerkUserId: string): Promise<string> {
  try {
    const db = getDb();
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0].id;
    }

    // User doesn't exist, fetch from Clerk and create
    const clerkClient = await getClerkClient();
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const userData = {
      clerkUserId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      name:
        `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
        'Unknown',
      role: 'agent' as const, // Default to agent, can be updated later
    };

    const [newUser] = await db.insert(users).values(userData).returning();
    console.log(`Auto-created user: ${newUser.name} (${newUser.email})`);

    return newUser.id;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

/**
 * Ensures an organization exists in our database, creates if needed
 */
export async function ensureOrganizationExists(
  clerkOrgId: string,
): Promise<string> {
  try {
    const db = getDb();
    // Check if organization already exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (existingOrg.length > 0) {
      return existingOrg[0].id;
    }

    // Organization doesn't exist, fetch from Clerk and create
    const clerkClient = await getClerkClient();
    const clerkOrg = await clerkClient.organizations.getOrganization({
      organizationId: clerkOrgId,
    });

    const orgData = {
      clerkOrgId: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug || clerkOrg.name.toLowerCase().replace(/\s+/g, '-'),
    };

    const [newOrg] = await db.insert(organizations).values(orgData).returning();
    console.log(`Auto-created organization: ${newOrg.name}`);

    return newOrg.id;
  } catch (error) {
    console.error('Error ensuring organization exists:', error);
    throw error;
  }
}

/**
 * Ensures a membership exists between user and organization
 */
export async function ensureMembershipExists(
  userId: string,
  organizationId: string,
  role: 'admin' | 'agent' | 'member' = 'member',
): Promise<void> {
  try {
    const db = getDb();
    // Check if membership already exists
    const existingMembership = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return; // Membership already exists
    }

    // Create membership
    await db.insert(memberships).values({
      userId,
      organizationId,
      role,
    });

    console.log(
      `Auto-created membership: User ${userId} -> Org ${organizationId} (${role})`,
    );
  } catch (error) {
    console.error('Error ensuring membership exists:', error);
    throw error;
  }
}

/**
 * Full sync for a user - ensures user, their orgs, and memberships all exist
 */
export async function syncUserWithOrganizations(
  clerkUserId: string,
): Promise<void> {
  try {
    // Ensure user exists
    const userId = await ensureUserExists(clerkUserId);

    // Get user's organization memberships from Clerk
    const clerkClient = await getClerkClient();
    const clerkMemberships =
      await clerkClient.users.getOrganizationMembershipList({
        userId: clerkUserId,
      });

    // Process each organization membership
    for (const membership of clerkMemberships.data) {
      // Ensure organization exists
      const organizationId = await ensureOrganizationExists(
        membership.organization.id,
      );

      // Map Clerk role to our role
      const role =
        membership.role === 'org:admin'
          ? ('admin' as const)
          : membership.role === 'org:member'
            ? ('member' as const)
            : ('member' as const);

      // Ensure membership exists
      await ensureMembershipExists(userId, organizationId, role);
    }

    console.log(
      `Synced user ${clerkUserId} with ${clerkMemberships.data.length} organizations`,
    );
  } catch (error) {
    console.error('Error syncing user with organizations:', error);
    throw error;
  }
}

/**
 * Quick check if user exists in our database
 */
export async function userExistsInDatabase(
  clerkUserId: string,
): Promise<boolean> {
  try {
    const db = getDb();
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return false;
  }
}
