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

async function getClientForOrg(clientId: string, organizationId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  return result[0] ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; loyaltyId: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId, loyaltyId } = await params;
    const client = await getClientForOrg(clientId, user.organizationId);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const db = getDb();
    const body = await request.json();
    const { programName, memberNumber, expiryDate } = body;

    const updates: Partial<{ programName: string; memberNumber: string; expiryDate: string | null }> = {};
    if (programName !== undefined) updates.programName = programName;
    if (memberNumber !== undefined) updates.memberNumber = memberNumber;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate || null;

    const [entry] = await db
      .update(clientLoyalty)
      .set(updates)
      .where(and(eq(clientLoyalty.id, loyaltyId), eq(clientLoyalty.clientId, clientId)))
      .returning();

    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error updating loyalty program:', error);
    return NextResponse.json({ error: 'Failed to update loyalty program' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; loyaltyId: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId, loyaltyId } = await params;
    const client = await getClientForOrg(clientId, user.organizationId);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const db = getDb();
    const deleted = await db
      .delete(clientLoyalty)
      .where(and(eq(clientLoyalty.id, loyaltyId), eq(clientLoyalty.clientId, clientId)))
      .returning();

    if (deleted.length === 0) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting loyalty program:', error);
    return NextResponse.json({ error: 'Failed to delete loyalty program' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
