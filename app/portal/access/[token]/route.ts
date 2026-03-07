import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { portalTokens, clientPortals, portalSessions } from '@/lib/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const { token } = await params;
  const db = getDb();
  const now = new Date();

  // Look up the token
  const tokenResult = await db
    .select({
      tokenRow: portalTokens,
      portal: clientPortals,
    })
    .from(portalTokens)
    .innerJoin(clientPortals, eq(portalTokens.portalId, clientPortals.id))
    .where(
      and(
        eq(portalTokens.token, token),
        gt(portalTokens.expiresAt, now),
        isNull(portalTokens.usedAt),
      ),
    )
    .limit(1);

  if (tokenResult.length === 0) {
    return NextResponse.redirect(new URL('/portal/invalid', request.url));
  }

  const { tokenRow, portal } = tokenResult[0];

  // Mark token as used
  await db
    .update(portalTokens)
    .set({ usedAt: now })
    .where(eq(portalTokens.id, tokenRow.id));

  // Create portal session
  const sessionToken = nanoid(64);
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  await db.insert(portalSessions).values({
    portalId: portal.id,
    sessionToken,
    sections: tokenRow.sections,
    expiresAt,
  });

  // Set HTTP-only cookie and redirect
  const cookieStore = await cookies();
  cookieStore.set('portal_session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7200,
    path: '/',
  });

  redirect(`/portal/${portal.slug}`);
}
