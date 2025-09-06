import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncUserWithOrganizations, userExistsInDatabase } from '@/lib/db/sync';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user already exists in database
    const userExists = await userExistsInDatabase(userId);

    if (userExists) {
      return NextResponse.json({
        message: 'User already synced',
        action: 'skipped',
      });
    }

    // Sync user and their organizations
    await syncUserWithOrganizations(userId);

    return NextResponse.json({
      message: 'User synced successfully',
      action: 'synced',
      userId,
    });
  } catch (error) {
    console.error('Auto-sync error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'failed',
      },
      { status: 500 },
    );
  }
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
