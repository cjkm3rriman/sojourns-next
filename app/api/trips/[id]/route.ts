import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { trips, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;

    // Get user from database to check permissions
    const db = getDb();
    const userResult = await db
      .select({
        userId: users.id,
        organizationId: memberships.organizationId,
      })
      .from(users)
      .leftJoin(memberships, eq(memberships.userId, users.id))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }

    const { organizationId } = userResult[0];

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    // Fetch trip with organization permission check
    const tripResult = await db
      .select()
      .from(trips)
      .where(
        and(eq(trips.id, tripId), eq(trips.organizationId, organizationId)),
      )
      .limit(1);

    if (tripResult.length === 0) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      trip: tripResult[0],
    });
  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
