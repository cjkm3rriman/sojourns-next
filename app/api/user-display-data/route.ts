import { NextRequest, NextResponse } from 'next/server';
import { getUserDisplayData } from '@/lib/user-data';

export async function GET(request: NextRequest) {
  try {
    const userData = await getUserDisplayData(request);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching user display data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 },
    );
  }
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
