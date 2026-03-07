import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientPassports, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteItem, getVaultId } from '@/lib/1password';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; passportId: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId, passportId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);
    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const passportResult = await db
      .select()
      .from(clientPassports)
      .where(and(eq(clientPassports.id, passportId), eq(clientPassports.clientId, clientId)))
      .limit(1);
    if (passportResult.length === 0) return NextResponse.json({ error: 'Passport not found' }, { status: 404 });

    const vaultId = getVaultId();
    await deleteItem(vaultId, passportResult[0].opItemId);
    await db.delete(clientPassports).where(eq(clientPassports.id, passportId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting passport:', error);
    return NextResponse.json({ error: 'Failed to delete passport' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
