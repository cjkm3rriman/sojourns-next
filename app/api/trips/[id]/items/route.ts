import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { items, trips, users, memberships, places } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get authenticated user
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;

    // Get user and verify trip access
    const db = getDb();
    const userResult = await db
      .select({
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

    // Verify trip exists and user has access
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

    // Fetch items for this trip with optional place information
    const tripItems = await db
      .select({
        id: items.id,
        type: items.type,
        title: items.title,
        description: items.description,
        startDate: items.startDate,
        endDate: items.endDate,
        timezone: items.timezone,
        location: items.location,
        originLocation: items.originLocation,
        destinationLocation: items.destinationLocation,
        cost: items.cost,
        status: items.status,
        sortOrder: items.sortOrder,
        createdAt: items.createdAt,
        // Place information if linked
        placeName: places.name,
        placeType: places.type,
        placeAddress: places.address,
      })
      .from(items)
      .leftJoin(places, eq(items.placeId, places.id))
      .where(eq(items.tripId, tripId))
      .orderBy(items.startDate, items.sortOrder, items.createdAt);

    return NextResponse.json({
      items: tripItems,
    });
  } catch (error) {
    console.error('Error fetching trip items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip items' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
