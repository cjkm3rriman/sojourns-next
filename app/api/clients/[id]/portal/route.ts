import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientPortals, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

const portalSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

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
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 400 });
    }

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);

    if (clientResult.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    const portal = await db
      .select()
      .from(clientPortals)
      .where(eq(clientPortals.clientId, clientId))
      .limit(1);

    return NextResponse.json({ portal: portal[0] ?? null });
  } catch (error) {
    console.error('Error fetching portal:', error);
    return NextResponse.json({ error: 'Failed to fetch portal' }, { status: 500 });
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
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 400 });
    }

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);

    if (clientResult.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Return existing portal if already created
    const existing = await db
      .select()
      .from(clientPortals)
      .where(eq(clientPortals.clientId, clientId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ portal: existing[0] });
    }

    const [portal] = await db
      .insert(clientPortals)
      .values({ clientId, slug: portalSlug() })
      .returning();

    return NextResponse.json({ portal }, { status: 201 });
  } catch (error) {
    console.error('Error creating portal:', error);
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
