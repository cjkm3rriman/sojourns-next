import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, users, memberships } from '@/lib/db/schema';
import { eq, desc, ilike, or, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const searchQuery = request.nextUrl.searchParams.get('q');
    const orgFilter = eq(clients.organizationId, organizationId);

    const whereClause = searchQuery
      ? and(
          orgFilter,
          or(
            ilike(clients.firstName, `%${searchQuery}%`),
            ilike(clients.lastName, `%${searchQuery}%`),
            ilike(clients.email, `%${searchQuery}%`),
          ),
        )
      : orgFilter;

    const orgClients = await db
      .select()
      .from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt));

    return NextResponse.json({ clients: orgClients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, address, travelPreferences, notes } = body;

    if (!firstName?.trim()) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 },
      );
    }

    if (!lastName?.trim()) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 },
      );
    }

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
        { error: 'User must be part of an organization to create clients' },
        { status: 400 },
      );
    }

    const newClient = await db
      .insert(clients)
      .values({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        travelPreferences: travelPreferences?.trim() || null,
        notes: notes?.trim() || null,
        organizationId,
        agentId: dbUserId,
      })
      .returning();

    return NextResponse.json({ success: true, client: newClient[0] });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
