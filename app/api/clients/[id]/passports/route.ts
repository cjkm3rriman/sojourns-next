import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { clients, clientPassports, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createPassportItem, getVaultId } from '@/lib/1password';

async function getOrgAndUser(clerkUserId: string) {
  const db = getDb();
  const result = await db
    .select({ userId: users.id, organizationId: memberships.organizationId })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
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
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getOrgAndUser(userId);
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);
    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const passports = await db
      .select()
      .from(clientPassports)
      .where(eq(clientPassports.clientId, clientId));

    return NextResponse.json({ passports });
  } catch (error) {
    console.error('Error fetching passports:', error);
    return NextResponse.json({ error: 'Failed to fetch passports' }, { status: 500 });
  }
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
    if (!user?.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const { id: clientId } = await params;
    const db = getDb();

    const clientResult = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, user.organizationId)))
      .limit(1);
    if (clientResult.length === 0) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const client = clientResult[0];
    const body = await request.json();
    const { givenNames, surname, passportNumber, nationality, placeOfBirth, dateOfBirth, issueDate, expiryDate, issuingCountry } = body;

    if (!givenNames || !surname || !passportNumber || !nationality || !placeOfBirth || !dateOfBirth || !issueDate || !expiryDate || !issuingCountry) {
      return NextResponse.json({ error: 'All required fields must be provided' }, { status: 400 });
    }

    const vaultId = getVaultId();
    const item = await createPassportItem(vaultId, {
      clientName: `${client.firstName} ${client.lastName}`,
      givenNames,
      surname,
      passportNumber,
      nationality,
      placeOfBirth,
      dateOfBirth,
      issueDate,
      expiryDate,
      issuingCountry,
    });

    const [passport] = await db
      .insert(clientPassports)
      .values({ clientId, issuingCountry, expiryDate, opItemId: item.id })
      .returning();

    return NextResponse.json({ passport }, { status: 201 });
  } catch (error) {
    console.error('Error adding passport:', error);
    return NextResponse.json({ error: 'Failed to add passport' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
