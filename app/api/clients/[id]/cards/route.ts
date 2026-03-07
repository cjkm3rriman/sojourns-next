import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientCards, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createCardItem,
  getItem,
  getVaultId,
  deleteItem,
} from '@/lib/1password';


function detectCardType(number: string): string {
  const n = number.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65|64[4-9]|622)/.test(n)) return 'Discover';
  if (/^3[068]/.test(n)) return 'Diners';
  if (/^35/.test(n)) return 'JCB';
  if (/^62/.test(n)) return 'UnionPay';
  return 'Card';
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const { id: clientId } = await params;
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

    const vaultId = getVaultId();
    const rows = await db
      .select()
      .from(clientCards)
      .where(eq(clientCards.clientId, clientId));

    // Reconcile with 1Password — it is the source of truth
    const toDelete: string[] = [];
    const toUpdate: { id: string; expiry: string; cardType: string | null }[] =
      [];

    for (const row of rows) {
      try {
        const item = await getItem(vaultId, row.opItemId);
        const fields = item.fields ?? [];

        const expiryField = fields.find((f) => f.id === 'expiry');
        const typeField = fields.find((f) => f.id === 'card_type');

        const freshExpiry = expiryField?.value ?? row.expiry;
        const freshType = typeField?.value ?? row.cardType ?? null;

        if (freshExpiry !== row.expiry || freshType !== row.cardType) {
          toUpdate.push({
            id: row.id,
            expiry: freshExpiry,
            cardType: freshType,
          });
        }
      } catch {
        // Item deleted externally — mark for removal
        toDelete.push(row.id);
      }
    }

    for (const id of toDelete) {
      await db.delete(clientCards).where(eq(clientCards.id, id));
    }
    for (const u of toUpdate) {
      await db
        .update(clientCards)
        .set({ expiry: u.expiry, cardType: u.cardType })
        .where(eq(clientCards.id, u.id));
    }

    const reconciled = await db
      .select()
      .from(clientCards)
      .where(eq(clientCards.clientId, clientId));

    return NextResponse.json({ cards: reconciled });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const { id: clientId } = await params;
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

    const body = await request.json();
    const {
      cardholderName,
      cardNumber,
      expiry,
      cvv,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
    } = body;

    // Assemble a readable address string for 1Password storage
    const billingAddress =
      [billingLine1, billingLine2, billingCity, billingState]
        .filter(Boolean)
        .join(', ') || undefined;

    if (!cardholderName || !cardNumber || !expiry || !cvv) {
      return NextResponse.json(
        { error: 'cardholderName, cardNumber, expiry, and cvv are required' },
        { status: 400 },
      );
    }

    const clientRow = clientResult[0];
    const clientName = `${clientRow.firstName} ${clientRow.lastName}`;
    const vaultId = getVaultId();

    const item = await createCardItem(vaultId, {
      clientName,
      cardholderName,
      cardNumber,
      expiry,
      cvv,
      cardType: detectCardType(cardNumber),
      billingAddress: billingAddress || undefined,
      billingZip: billingZip || undefined,
    });

    const last4 = cardNumber.replace(/\s/g, '').slice(-4);

    const [inserted] = await db
      .insert(clientCards)
      .values({
        clientId,
        last4,
        expiry,
        cardType: detectCardType(cardNumber),
        opItemId: item.id,
      })
      .returning();

    return NextResponse.json({ card: inserted }, { status: 201 });
  } catch (error) {
    console.error('Error adding card:', error);
    return NextResponse.json({ error: 'Failed to add card' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
