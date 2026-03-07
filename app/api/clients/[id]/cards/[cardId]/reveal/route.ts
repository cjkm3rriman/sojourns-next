import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientCards, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getItem, getVaultId } from '@/lib/1password';
import bcrypt from 'bcryptjs';

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function getOrgAndUser(clerkUserId: string) {
  const db = getDb();
  const result = await db
    .select({
      userId: users.id,
      dbUserId: users.id,
      organizationId: memberships.organizationId,
      revealPin: users.revealPin,
      revealPinAttempts: users.revealPinAttempts,
      revealPinLockedUntil: users.revealPinLockedUntil,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return result[0] ?? null;
}

export async function POST(
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

    // PIN must be set
    if (!user.revealPin) {
      return NextResponse.json(
        { error: 'PIN not set', pinNotSet: true },
        { status: 400 },
      );
    }

    // Check lockout
    if (user.revealPinLockedUntil && user.revealPinLockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts',
          lockedUntil: user.revealPinLockedUntil,
        },
        { status: 423 },
      );
    }

    const { pin } = await request.json();
    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    const db = getDb();
    const pinCorrect = await bcrypt.compare(String(pin), user.revealPin);

    if (!pinCorrect) {
      const newAttempts = (user.revealPinAttempts ?? 0) + 1;
      if (newAttempts >= LOCKOUT_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await db
          .update(users)
          .set({ revealPinAttempts: 0, revealPinLockedUntil: lockedUntil })
          .where(eq(users.id, user.dbUserId));
        return NextResponse.json(
          { error: 'Too many failed attempts', lockedUntil },
          { status: 423 },
        );
      }
      await db
        .update(users)
        .set({ revealPinAttempts: newAttempts })
        .where(eq(users.id, user.dbUserId));
      return NextResponse.json(
        {
          error: 'Incorrect PIN',
          attemptsRemaining: LOCKOUT_ATTEMPTS - newAttempts,
        },
        { status: 401 },
      );
    }

    // PIN correct — reset attempts
    await db
      .update(users)
      .set({ revealPinAttempts: 0, revealPinLockedUntil: null })
      .where(eq(users.id, user.dbUserId));

    const { id: clientId, cardId } = await params;

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

    const vaultId = getVaultId();
    const item = await getItem(vaultId, cardResult[0].opItemId);
    const fields = item.fields ?? [];

    const cardNumber = fields.find((f) => f.id === 'card_number')?.value ?? '';
    const cvv = fields.find((f) => f.id === 'cvv')?.value ?? '';
    const cardholderName =
      fields.find((f) => f.id === 'cardholder_name')?.value ?? '';
    const billingZip =
      fields.find((f) => f.id === 'billing_zip')?.value ?? null;
    const billingAddress =
      fields.find((f) => f.id === 'billing_address')?.value ?? null;
    const expiry = cardResult[0].expiry;

    return NextResponse.json({ cardNumber, cvv, cardholderName, expiry, billingZip, billingAddress });
  } catch (error) {
    console.error('Error revealing card:', error);
    return NextResponse.json(
      { error: 'Failed to reveal card' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
