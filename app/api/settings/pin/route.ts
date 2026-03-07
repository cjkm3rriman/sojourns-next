import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, memberships } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const PIN_REGEX = /^\d{4}$/;
const BCRYPT_ROUNDS = 12;

async function getDbUser(clerkUserId: string) {
  const db = getDb();
  const result = await db
    .select({
      id: users.id,
      revealPin: users.revealPin,
    })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return result[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await getDbUser(userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ pinSet: !!dbUser.revealPin });
  } catch (error) {
    console.error('Error checking PIN status:', error);
    return NextResponse.json({ error: 'Failed to check PIN' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await getDbUser(userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { pin, currentPin } = await request.json();

    if (!pin || !PIN_REGEX.test(String(pin))) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 },
      );
    }

    // If PIN already set, require current PIN
    if (dbUser.revealPin) {
      if (!currentPin) {
        return NextResponse.json(
          { error: 'Current PIN is required to change PIN' },
          { status: 400 },
        );
      }
      const currentCorrect = await bcrypt.compare(
        String(currentPin),
        dbUser.revealPin,
      );
      if (!currentCorrect) {
        return NextResponse.json(
          { error: 'Current PIN is incorrect' },
          { status: 401 },
        );
      }
    }

    const hash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);

    const db = getDb();
    await db
      .update(users)
      .set({
        revealPin: hash,
        revealPinAttempts: 0,
        revealPinLockedUntil: null,
      })
      .where(eq(users.id, dbUser.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting PIN:', error);
    return NextResponse.json({ error: 'Failed to set PIN' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
