import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, memberships, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SLOTS = ['square', 'wordmark', 'header'] as const;
type Slot = (typeof VALID_SLOTS)[number];

const SLOT_COLUMN: Record<Slot, 'logoSquareUrl' | 'logoWordmarkUrl' | 'headerImageUrl'> = {
  square: 'logoSquareUrl',
  wordmark: 'logoWordmarkUrl',
  header: 'headerImageUrl',
};

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  try {
    const { slot } = await params;

    if (!VALID_SLOTS.includes(slot as Slot)) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
    }

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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Images only.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    if (!R2_PUBLIC_URL) {
      return NextResponse.json(
        { error: 'R2_PUBLIC_URL is not configured. Set it in your environment variables.' },
        { status: 500 },
      );
    }

    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1];
    const orgId = result[0].orgId;
    const key = `orgs/${orgId}/${slot}.${ext}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }),
    );

    const url = `${R2_PUBLIC_URL}/${key}`;

    const column = SLOT_COLUMN[slot as Slot];
    await db
      .update(organizations)
      .set({ [column]: url, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
