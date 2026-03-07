import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientCards, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteItem, getVaultId } from '@/lib/1password';

async function getOrgAndUser(clerkUserId: string) {
  const db = getDb();
  const result = await db
    .select({
      userId: users.id,
      organizationId: memberships.organizationId,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return result[0] ?? null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; cardId: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    const { id: clientId, cardId } = await params;
    const db = getDb();

    // Verify client belongs to org
    const clientResult = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, user.organizationId),
        ),
      )
      .limit(1);

    if (clientResult.length === 0) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 },
      );
    }

    const cardResult = await db
      .select()
      .from(clientCards)
      .where(
        and(eq(clientCards.id, cardId), eq(clientCards.clientId, clientId)),
      )
      .limit(1);

    if (cardResult.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const card = cardResult[0];
    const vaultId = getVaultId();

    try {
      await deleteItem(vaultId, card.opItemId);
    } catch {
      // If already deleted in 1Password, continue with DB cleanup
    }

    await db.delete(clientCards).where(eq(clientCards.id, cardId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      { error: 'Failed to delete card' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
