import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { documents, trips, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

export async function GET(
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

    // Get the document and verify it belongs to this trip
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

    const document = documentResult[0];

    // Get document from R2
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: document.r2Key,
    });

    const response = await r2Client.send(getObjectCommand);
    const documentContent = await response.Body?.transformToByteArray();

    if (!documentContent) {
      return NextResponse.json(
        { error: 'Failed to retrieve document content' },
        { status: 500 },
      );
    }

    // Return the document with appropriate headers
    return new NextResponse(Buffer.from(documentContent), {
      status: 200,
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `inline; filename="${document.originalName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { error: 'Failed to serve document' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
