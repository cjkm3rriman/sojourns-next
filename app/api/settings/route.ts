import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, memberships, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const result = await db
      .select({
        userId: users.id,
        revealPin: users.revealPin,
        membershipRole: memberships.role,
        orgId: organizations.id,
        orgName: organizations.name,
        logoSquareUrl: organizations.logoSquareUrl,
        logoWordmarkUrl: organizations.logoWordmarkUrl,
        headerImageUrl: organizations.headerImageUrl,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const row = result[0];
    return NextResponse.json({
      pinSet: !!row.revealPin,
      membershipRole: row.membershipRole,
      org: {
        id: row.orgId,
        name: row.orgName,
        logoSquareUrl: row.logoSquareUrl,
        logoWordmarkUrl: row.logoWordmarkUrl,
        headerImageUrl: row.headerImageUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
