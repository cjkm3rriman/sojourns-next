import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { trips, users, memberships, organizations } from '@/lib/db/schema';
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

    // Create alias for agent user to avoid naming conflicts
    const agentUser = alias(users, 'agentUser');

    // Fetch trip with organization permission check and join agent/organization data
    const tripResult = await db
      .select({
        // Trip fields
        id: trips.id,
        clientName: trips.clientName,
        destination: trips.destination,
        tripSummary: trips.tripSummary,
        icon: trips.icon,
        agentId: trips.agentId,
        organizationId: trips.organizationId,
        partnerId: trips.partnerId,
        startDate: trips.startDate,
        endDate: trips.endDate,
        status: trips.status,
        groupSize: trips.groupSize,
        flightsPhoneNumber: trips.flightsPhoneNumber,
        notes: trips.notes,
        shareToken: trips.shareToken,
        version: trips.version,
        createdAt: trips.createdAt,
        updatedAt: trips.updatedAt,
        // Agent and organization names
        agentName: agentUser.name,
        organizationName: organizations.name,
        organizationFlightsPhoneNumber: organizations.flightsPhoneNumber,
      })
      .from(trips)
      .leftJoin(agentUser, eq(trips.agentId, agentUser.id))
      .leftJoin(organizations, eq(trips.organizationId, organizations.id))
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

export async function PATCH(
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

    const tripId = params.id;
    const body = await request.json();

    // Validate request body
    if (!body.status || typeof body.status !== 'string') {
      return NextResponse.json(
        { error: 'Status is required and must be a string' },
        { status: 400 },
      );
    }

    // Validate status value
    const validStatuses = ['draft', 'published', 'cancelled'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          error: 'Invalid status. Must be one of: draft, published, cancelled',
        },
        { status: 400 },
      );
    }

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

    // Update trip status
    const updatedTrip = await db
      .update(trips)
      .set({
        status: body.status as 'draft' | 'published' | 'cancelled',
        updatedAt: new Date(),
      })
      .where(
        and(eq(trips.id, tripId), eq(trips.organizationId, organizationId)),
      )
      .returning();

    if (updatedTrip.length === 0) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      trip: updatedTrip[0],
      message: `Trip status updated to ${body.status}`,
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    return NextResponse.json(
      { error: 'Failed to update trip' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
