import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { organizations } from '@/lib/db/schema';

export async function GET() {
  try {
    console.log('Testing database connection...');
    const db = getDb();
    const result = await db.select().from(organizations).limit(5);

    return NextResponse.json({
      success: true,
      message: 'Database connected successfully!',
      organizations: result,
      count: result.length,
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
