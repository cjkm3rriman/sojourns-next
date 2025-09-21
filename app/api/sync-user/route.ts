import { NextRequest, NextResponse } from 'next/server';
import { syncUserWithOrganizations, userExistsInDatabase } from '@/lib/db/sync';

export async function POST(request: NextRequest) {
  try {
    const { getAuth } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(request);

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
