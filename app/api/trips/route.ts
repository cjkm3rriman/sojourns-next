import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { trips, users, memberships, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { clientName } = body;

    if (!clientName?.trim()) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 },
      );
    }

    // Get user and organization from database
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

    const { userId: dbUserId, organizationId } = userResult[0];

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization to create trips' },
        { status: 400 },
      );
    }

    // Generate unique share token
    const shareToken = nanoid(32);

    // Create trip
    const newTrip = await db
      .insert(trips)
      .values({
        clientName: clientName.trim(),
        agentId: dbUserId,
        organizationId,
        shareToken,
        status: 'draft',
        version: 1,
      })
      .returning();

    return NextResponse.json({
      success: true,
      trip: newTrip[0],
    });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json(
      { error: 'Failed to create trip' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and organization from database
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

    // Fetch all trips for the organization with agent information
    const agentUser = users; // Alias for the join
    const organizationTrips = await db
      .select({
        id: trips.id,
        clientName: trips.clientName,
        destination: trips.destination,
        tripSummary: trips.tripSummary,
        icon: trips.icon,
        status: trips.status,
        startDate: trips.startDate,
        endDate: trips.endDate,
        createdAt: trips.createdAt,
        updatedAt: trips.updatedAt,
        agentId: trips.agentId,
        agentName: agentUser.name,
        agentClerkUserId: agentUser.clerkUserId,
        organizationName: organizations.name,
      })
      .from(trips)
      .leftJoin(agentUser, eq(trips.agentId, agentUser.id))
      .leftJoin(organizations, eq(trips.organizationId, organizations.id))
      .where(eq(trips.organizationId, organizationId))
      .orderBy(desc(trips.createdAt));

    return NextResponse.json({
      trips: organizationTrips,
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trips' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
