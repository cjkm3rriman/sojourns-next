import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, memberships, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const result = await db
      .select({
        membershipRole: memberships.role,
        orgId: organizations.id,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (result[0].membershipRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await db
      .update(organizations)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(organizations.id, result[0].orgId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating org:', error);
    return NextResponse.json({ error: 'Failed to update organisation' }, { status: 500 });
  }
}
