import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientLoyalty, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function getOrgAndUser(clerkUserId: string) {
  const db = getDb();
  const result = await db
    .select({ userId: users.id, organizationId: memberships.organizationId })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return result[0] ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);
    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const loyalty = await db
      .select()
      .from(clientLoyalty)
      .where(eq(clientLoyalty.clientId, clientId));

    return NextResponse.json({ loyalty });
  } catch (error) {
    console.error('Error fetching loyalty programs:', error);
    return NextResponse.json({ error: 'Failed to fetch loyalty programs' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);
    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const body = await request.json();
    const { programName, memberNumber, expiryDate } = body;

    if (!programName || !memberNumber) {
      return NextResponse.json({ error: 'programName and memberNumber are required' }, { status: 400 });
    }

    const [entry] = await db
      .insert(clientLoyalty)
      .values({ clientId, programName, memberNumber, expiryDate: expiryDate || null })
      .returning();

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error adding loyalty program:', error);
    return NextResponse.json({ error: 'Failed to add loyalty program' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
