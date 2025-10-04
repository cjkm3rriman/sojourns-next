#!/usr/bin/env tsx

import { config } from 'dotenv';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

async function addVectorStoreColumn() {
  console.log('Adding vector_store_id column to trips table...');
  const db = getDb();

  try {
    await db.execute(
      sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS vector_store_id text;`,
    );
    console.log('✅ Successfully added vector_store_id column');
  } catch (error) {
    console.error('❌ Failed to add column:', error);
    throw error;
  }
}

async function main() {
  try {
    await addVectorStoreColumn();
    console.log('✨ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
