import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { organizations, users, memberships } from '@/lib/db/schema';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';

export async function POST() {
  try {
    const db = getDb();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);

    // Get user's organizations from Clerk
    const clerkOrgs = await clerkClient.users.getOrganizationMembershipList({
      userId: userId,
    });

    console.log('Clerk User:', clerkUser);
    console.log('Clerk Organizations:', clerkOrgs);

    const results = {
      user: null as any,
      organizations: [] as any[],
      memberships: [] as any[],
    };

    // Create/update user in database
    const userData = {
      clerkUserId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      name:
        `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
        'Unknown',
      role: 'agent' as const, // Assuming agent for now
    };

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    let dbUser;
    if (existingUser.length === 0) {
      const [newUser] = await db.insert(users).values(userData).returning();
      dbUser = newUser;
      results.user = { action: 'created', user: newUser };
    } else {
      dbUser = existingUser[0];
      results.user = { action: 'existed', user: dbUser };
    }

    // Create organizations and memberships
    for (const membership of clerkOrgs.data) {
      const clerkOrg = membership.organization;

      // Create/update organization
      const orgData = {
        clerkOrgId: clerkOrg.id,
        name: clerkOrg.name,
        slug: clerkOrg.slug || clerkOrg.name.toLowerCase().replace(/\s+/g, '-'),
      };

      const existingOrg = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrg.id))
        .limit(1);

      let dbOrg;
      if (existingOrg.length === 0) {
        const [newOrg] = await db
          .insert(organizations)
          .values(orgData)
          .returning();
        dbOrg = newOrg;
        results.organizations.push({ action: 'created', org: newOrg });
      } else {
        dbOrg = existingOrg[0];
        results.organizations.push({ action: 'existed', org: dbOrg });
      }

      // Create membership
      const membershipData = {
        userId: dbUser.id,
        organizationId: dbOrg.id,
        role:
          membership.role === 'org:admin'
            ? ('admin' as const)
            : ('member' as const),
      };

      const existingMembership = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, dbUser.id),
            eq(memberships.organizationId, dbOrg.id),
          ),
        )
        .limit(1);

      if (existingMembership.length === 0) {
        const [newMembership] = await db
          .insert(memberships)
          .values(membershipData)
          .returning();
        results.memberships.push({
          action: 'created',
          membership: newMembership,
        });
      } else {
        results.memberships.push({
          action: 'existed',
          membership: existingMembership[0],
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Clerk data synced successfully',
      results,
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
