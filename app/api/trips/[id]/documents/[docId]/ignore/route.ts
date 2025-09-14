import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { documents, trips, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  try {
    // Get authenticated user
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;
    const docId = params.docId;
    const { ignored } = await request.json();

    if (typeof ignored !== 'boolean') {
      return NextResponse.json(
        { error: 'ignored field must be a boolean' },
        { status: 400 },
      );
    }

    // Get user and verify trip access
    const db = getDb();
    const userResult = await db
      .select({
        organizationId: memberships.organizationId,
      })
      .from(users)
      .leftJoin(memberships, eq(memberships.userId, users.id))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 },
      );
    }

    const { organizationId } = userResult[0];

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 400 },
      );
    }

    // Verify trip exists and user has access
    const tripResult = await db
      .select()
      .from(trips)
      .where(
        and(eq(trips.id, tripId), eq(trips.organizationId, organizationId)),
      )
      .limit(1);

    if (tripResult.length === 0) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 },
      );
    }

    // Verify document exists and belongs to this trip
    const documentResult = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.tripId, tripId)))
      .limit(1);

    if (documentResult.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Update document status
    const newStatus = ignored ? 'ignored' : 'uploaded';
    const [updatedDocument] = await db
      .update(documents)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docId))
      .returning();

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      message: ignored
        ? 'Document marked as ignored'
        : 'Document unmarked from ignored',
    });
  } catch (error) {
    console.error('Error updating document ignore status:', error);
    return NextResponse.json(
      {
        error: 'Failed to update document status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
