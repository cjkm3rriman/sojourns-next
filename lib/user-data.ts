import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { users, organizations, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface UserWithOrg {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  };
}

/**
 * Get user data for dashboard display
 * Hybrid approach:
 * - Names/emails from database (fast, consistent)
 * - Avatar images from Clerk (fresh, CDN-optimized)
 * - Falls back to full Clerk if database missing
 */
export async function getUserDisplayData(): Promise<UserWithOrg | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // Try database first (fast, reliable)
    const dbUser = await getUserFromDatabase(userId);
    if (dbUser) {
      return dbUser;
    }

    // Fallback to Clerk (slower, but ensures we have data)
    console.warn(`User ${userId} not found in database, falling back to Clerk`);
    return await getUserFromClerk(userId);
  } catch (error) {
    console.error('Error fetching user display data:', error);
    return null;
  }
}

async function getUserFromDatabase(
  clerkUserId: string,
): Promise<UserWithOrg | null> {
  const db = getDb();
  const result = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      orgClerkId: organizations.clerkOrgId,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];

  // Get fresh avatar URLs from Clerk
  try {
    const [clerkUser, clerkOrg] = await Promise.all([
      clerkClient.users.getUser(clerkUserId),
      row.orgClerkId
        ? clerkClient.organizations
            .getOrganization({
              organizationId: row.orgClerkId,
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      id: clerkUserId,
      name: row.userName,
      email: row.userEmail,
      imageUrl: clerkUser.imageUrl, // Fresh from Clerk
      organization: row.orgId
        ? {
            id: row.orgId,
            name: row.orgName!,
            slug: row.orgSlug!,
            imageUrl: clerkOrg?.imageUrl, // Fresh from Clerk
          }
        : undefined,
    };
  } catch (error) {
    console.error('Error fetching avatars from Clerk:', error);
    // Fallback to database data without avatars
    return {
      id: clerkUserId,
      name: row.userName,
      email: row.userEmail,
      organization: row.orgId
        ? {
            id: row.orgId,
            name: row.orgName!,
            slug: row.orgSlug!,
          }
        : undefined,
    };
  }
}

async function getUserFromClerk(
  clerkUserId: string,
): Promise<UserWithOrg | null> {
  try {
    const user = await clerkClient.users.getUser(clerkUserId);
    const memberships = await clerkClient.users.getOrganizationMembershipList({
      userId: clerkUserId,
      limit: 1, // Just get the first/primary org
    });

    const primaryOrg = memberships.data[0]?.organization;

    return {
      id: user.id,
      name:
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
      email: user.emailAddresses[0]?.emailAddress || '',
      imageUrl: user.imageUrl,
      organization: primaryOrg
        ? {
            id: primaryOrg.id,
            name: primaryOrg.name,
            slug:
              primaryOrg.slug ||
              primaryOrg.name.toLowerCase().replace(/\s+/g, '-'),
            imageUrl: primaryOrg.imageUrl,
          }
        : undefined,
    };
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);
    return null;
  }
}

/**
 * Hook for React components to get user display data
 */
export function useUserDisplayData() {
  // This could be enhanced with SWR/React Query for caching
  // For now, just use the server function
  return { getUserDisplayData };
}
