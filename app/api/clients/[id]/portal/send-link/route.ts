import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  clients,
  clientPortals,
  portalTokens,
  users,
  memberships,
  organizations,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendMagicLink } from '@/lib/email';

type Flavour = 'general' | 'request_card' | 'request_passport';

const FLAVOUR_SECTIONS: Record<Flavour, string[]> = {
  general: ['profile', 'preferences'],
  request_card: ['cards'],
  request_passport: ['passports'],
};

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

    // Verify client belongs to org
    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);

    if (clientResult.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    const client = clientResult[0];
    if (!client.email) {
      return NextResponse.json({ error: 'Client has no email address' }, { status: 400 });
    }

    const body = await request.json();
    const { flavour } = body as { flavour: Flavour };
    if (!flavour || !FLAVOUR_SECTIONS[flavour]) {
      return NextResponse.json({ error: 'Invalid flavour' }, { status: 400 });
    }

    // Find or create portal
    let portalRow = (
      await db.select().from(clientPortals).where(eq(clientPortals.clientId, clientId)).limit(1)
    )[0];

    if (!portalRow) {
      [portalRow] = await db
        .insert(clientPortals)
        .values({ clientId, slug: nanoid(10) })
        .returning();
    }

    // Create token
    const sections = JSON.stringify(FLAVOUR_SECTIONS[flavour]);
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(portalTokens).values({
      portalId: portalRow.id,
      token,
      sections,
      expiresAt,
    });

    // Fetch org details for email
    const orgResult = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    const org = orgResult[0];

    const fromEmail = org?.fromEmail ?? process.env.RESEND_FROM ?? 'noreply@example.com';
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/portal/access/${token}`;

    await sendMagicLink({
      to: client.email,
      firstName: client.firstName,
      magicLink,
      orgName: org?.name ?? 'Your Travel Advisor',
      logoWordmarkUrl: org?.logoWordmarkUrl,
      fromEmail,
      flavour,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('Error sending portal link:', error);
    return NextResponse.json({ error: 'Failed to send link' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
