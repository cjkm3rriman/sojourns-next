import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, users, memberships, clientCards, clientPassports } from '@/lib/db/schema';
import { eq, desc, ilike, or, and, inArray, count } from 'drizzle-orm';

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

    if (orgClients.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    const clientIds = orgClients.map((c) => c.id);

    const [cardCounts, passportCounts] = await Promise.all([
      db
        .select({ clientId: clientCards.clientId, n: count() })
        .from(clientCards)
        .where(inArray(clientCards.clientId, clientIds))
        .groupBy(clientCards.clientId),
      db
        .select({ clientId: clientPassports.clientId, n: count() })
        .from(clientPassports)
        .where(inArray(clientPassports.clientId, clientIds))
        .groupBy(clientPassports.clientId),
    ]);

    const cardMap = Object.fromEntries(cardCounts.map((r) => [r.clientId, r.n]));
    const passportMap = Object.fromEntries(passportCounts.map((r) => [r.clientId, r.n]));

    const result = orgClients.map((c) => ({
      ...c,
      cardCount: cardMap[c.id] ?? 0,
      passportCount: passportMap[c.id] ?? 0,
    }));

    return NextResponse.json({ clients: result });
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
    const {
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
      allergies,
      flightPreferences,
      otherPreferences,
      notes,
    } = body;

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
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zip: zip?.trim() || null,
        country: country?.trim() || null,
        allergies: allergies?.trim() || null,
        flightPreferences: flightPreferences?.trim() || null,
        otherPreferences: otherPreferences?.trim() || null,
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
