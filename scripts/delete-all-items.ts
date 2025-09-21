#!/usr/bin/env tsx

/**
 * Script to delete all items from the items table
 * Usage: npx tsx scripts/delete-all-items.ts [--dry-run]
 */

import { config } from 'dotenv';
import { getDb } from '../lib/db';
import { items } from '../lib/db/schema';

// Load environment variables
config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

async function deleteAllItems() {
  console.log('🔍 Finding all items in database...');
  const db = getDb();

  // Get count of items first
  const allItems = await db.select().from(items);
  console.log(`Found ${allItems.length} items in database`);

  if (allItems.length === 0) {
    console.log('No items to delete.');
    return;
  }

  console.log(
    `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} all ${allItems.length} items...`,
  );

  if (!DRY_RUN) {
    try {
      const result = await db.delete(items);
      console.log(`✅ Successfully deleted all items from database`);
    } catch (error) {
      console.error(`❌ Failed to delete items:`, error);
      throw error;
    }
  } else {
    // In dry run mode, show some examples of what would be deleted
    console.log('\nExample items that would be deleted:');
    const examples = allItems.slice(0, 5);
    for (const item of examples) {
      console.log(`  - ${item.type}: ${item.title} (Trip: ${item.tripId})`);
    }
    if (allItems.length > 5) {
      console.log(`  ... and ${allItems.length - 5} more items`);
    }
  }
}

async function main() {
  console.log('🗑️  Starting items deletion...');
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN - No actual deletion will occur' : 'LIVE DELETION - Items will be permanently deleted'}`,
  );
  console.log('');

  if (!DRY_RUN) {
    console.log(
      '⚠️  WARNING: This will permanently delete ALL items from the database!',
    );
    console.log('⚠️  This action cannot be undone!');
    console.log('');
  }

  try {
    await deleteAllItems();
    console.log('✨ Operation completed!');
  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
