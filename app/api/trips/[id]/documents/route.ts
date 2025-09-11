import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { documents, trips, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check environment variables
    console.log('Checking R2 environment variables...');
    console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT ? 'Set' : 'Missing');
    console.log(
      'R2_ACCESS_KEY_ID:',
      process.env.R2_ACCESS_KEY_ID ? 'Set' : 'Missing',
    );
    console.log(
      'R2_SECRET_ACCESS_KEY:',
      process.env.R2_SECRET_ACCESS_KEY ? 'Set' : 'Missing',
    );
    console.log(
      'R2_BUCKET_NAME:',
      process.env.R2_BUCKET_NAME ? 'Set' : 'Missing',
    );
    console.log('R2_BUCKET value:', R2_BUCKET);

    if (
      !process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_BUCKET_NAME
    ) {
      console.error('Missing R2 environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing R2 credentials' },
        { status: 500 },
      );
    }

    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;

    // Get user and verify trip access
    const db = getDb();
    const userResult = await db
      .select({
        userId: users.id,
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

    const { userId: dbUserId, organizationId } = userResult[0];

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

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedDocuments = [];

    // Process each file
    for (const file of files) {
      if (!file || !file.name) continue;

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const uniqueFilename = `${nanoid()}.${fileExtension}`;
      const r2Key = `trips/${tripId}/documents/${uniqueFilename}`;

      // Upload to R2
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
        Body: fileBuffer,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          tripId: tripId,
          uploadedBy: dbUserId,
        },
      });

      await r2Client.send(uploadCommand);

      // Save document record to database
      const documentRecord = await db
        .insert(documents)
        .values({
          tripId,
          filename: uniqueFilename,
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          r2Key,
          status: 'uploaded',
          uploadedBy: dbUserId,
        })
        .returning();

      uploadedDocuments.push(documentRecord[0]);
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
      message: `Successfully uploaded ${uploadedDocuments.length} file(s)`,
    });
  } catch (error) {
    console.error('Error uploading documents:', error);

    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to upload documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = params.id;

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

    // Fetch documents for this trip
    const tripDocuments = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        originalName: documents.originalName,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.tripId, tripId))
      .orderBy(documents.createdAt);

    return NextResponse.json({
      documents: tripDocuments,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
