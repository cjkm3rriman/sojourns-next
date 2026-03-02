import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function getOrgId(userId: string) {
  const db = getDb();
  const result = await db
    .select({
      userId: users.id,
      organizationId: memberships.organizationId,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.clerkUserId, userId))
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

    const user = await getOrgId(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }
    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    const { id } = await params;
    const db = getDb();
    const result = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, id),
          eq(clients.organizationId, user.organizationId),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({ client: result[0] });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrgId(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }
    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address',
      'travelPreferences',
      'notes',
    ] as const;

    const updates: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]?.trim() || null;
      }
    }

    if (updates.firstName === null || updates.lastName === null) {
      return NextResponse.json(
        { error: 'First and last name cannot be empty' },
        { status: 400 },
      );
    }

    const db = getDb();
    const updated = await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, id),
          eq(clients.organizationId, user.organizationId),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({ client: updated[0] });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrgId(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }
    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    const { id } = await params;
    const db = getDb();
    const deleted = await db
      .delete(clients)
      .where(
        and(
          eq(clients.id, id),
          eq(clients.organizationId, user.organizationId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
