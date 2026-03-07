import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientPortals, portalSessions, organizations } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

const ALLOWED_PROFILE_FIELDS = ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'weddingAnniversary', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'zip', 'country'] as const;
const ALLOWED_PREFERENCES_FIELDS = ['allergies', 'flightPreferences', 'otherPreferences'] as const;

async function getSessionAndPortal(request: NextRequest, slug: string) {
  const sessionToken = request.cookies.get('portal_session')?.value;
  if (!sessionToken) return null;

  const db = getDb();
  const now = new Date();

  const result = await db
    .select({
      session: portalSessions,
      portal: clientPortals,
    })
    .from(portalSessions)
    .innerJoin(clientPortals, eq(portalSessions.portalId, clientPortals.id))
    .where(
      and(
        eq(portalSessions.sessionToken, sessionToken),
        eq(clientPortals.slug, slug),
        gt(portalSessions.expiresAt, now),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = await params;
    const row = await getSessionAndPortal(request, slug);
    if (!row) return NextResponse.json({ error: 'Unauthorized or session expired' }, { status: 401 });

    const db = getDb();
    const clientResult = await db
      .select()
      .from(clients)
      .where(eq(clients.id, row.portal.clientId))
      .limit(1);

    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const orgResult = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, clientResult[0].organizationId))
      .limit(1);

    return NextResponse.json({
      client: clientResult[0],
      sections: JSON.parse(row.session.sections) as string[],
      orgName: orgResult[0]?.name ?? '',
    });
  } catch (error) {
    console.error('Portal GET error:', error);
    return NextResponse.json({ error: 'Failed to load portal' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = await params;
    const row = await getSessionAndPortal(request, slug);
    if (!row) return NextResponse.json({ error: 'Unauthorized or session expired' }, { status: 401 });

    const sections = JSON.parse(row.session.sections) as string[];
    const body = await request.json();
    const db = getDb();

    // Build allowed update fields based on unlocked sections
    const allowedFields: Record<string, unknown> = {};

    if (sections.includes('profile')) {
      for (const field of ALLOWED_PROFILE_FIELDS) {
        if (field in body) allowedFields[field] = body[field];
      }
    }

    if (sections.includes('preferences')) {
      for (const field of ALLOWED_PREFERENCES_FIELDS) {
        if (field in body) allowedFields[field] = body[field];
      }
    }

    if (sections.includes('cards') || sections.includes('passports')) {
      return NextResponse.json(
        { error: 'Card and passport submission not yet available' },
        { status: 501 },
      );
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    allowedFields.updatedAt = new Date();

    const [updated] = await db
      .update(clients)
      .set(allowedFields)
      .where(eq(clients.id, row.portal.clientId))
      .returning();

    // Expire the session so the link cannot be reused
    await db
      .update(portalSessions)
      .set({ expiresAt: new Date() })
      .where(eq(portalSessions.id, row.session.id));

    const response = NextResponse.json({ client: updated });
    response.cookies.set('portal_session', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    console.error('Portal PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
