import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { items, trips, users, memberships, places } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get authenticated user
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tripId = id;

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

    // Create aliases for the different place joins
    const originPlace = alias(places, 'originPlace');
    const destinationPlace = alias(places, 'destinationPlace');

    // Fetch items for this trip with optional place information
    const tripItems = await db
      .select({
        id: items.id,
        type: items.type,
        title: items.title,
        description: items.description,
        startDate: items.startDate,
        endDate: items.endDate,
        originLocationSpecific: items.originLocationSpecific,
        destinationLocationSpecific: items.destinationLocationSpecific,
        cost: items.cost,
        status: items.status,
        sortOrder: items.sortOrder,
        createdAt: items.createdAt,
        phoneNumber: items.phoneNumber,
        confirmationNumber: items.confirmationNumber,
        notes: items.notes,
        data: items.data,
        // Origin place information (serves as main place for hotels/restaurants/activities)
        placeName: originPlace.name,
        placeShortName: originPlace.shortName,
        placeType: originPlace.type,
        placeAddress: originPlace.address,
        placeCity: originPlace.city,
        placeState: originPlace.state,
        placeCountry: originPlace.country,
        placePostalCode: originPlace.postalCode,
        placeTimezone: originPlace.timezone,
        originPlaceName: originPlace.name,
        originPlaceShortName: originPlace.shortName,
        originPlaceAddress: originPlace.address,
        originPlaceCity: originPlace.city,
        originPlaceState: originPlace.state,
        originPlaceCountry: originPlace.country,
        originPlacePostalCode: originPlace.postalCode,
        originPlaceTimezone: originPlace.timezone,
        // Destination place information
        destinationPlaceName: destinationPlace.name,
        destinationPlaceShortName: destinationPlace.shortName,
        destinationPlaceAddress: destinationPlace.address,
        destinationPlaceCity: destinationPlace.city,
        destinationPlaceState: destinationPlace.state,
        destinationPlaceCountry: destinationPlace.country,
        destinationPlacePostalCode: destinationPlace.postalCode,
        destinationPlaceTimezone: destinationPlace.timezone,
      })
      .from(items)
      .leftJoin(originPlace, eq(items.originPlaceId, originPlace.id))
      .leftJoin(
        destinationPlace,
        eq(items.destinationPlaceId, destinationPlace.id),
      )
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
