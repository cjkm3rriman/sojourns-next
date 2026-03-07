#!/usr/bin/env tsx

/**
 * Script to delete all items and places from a specific trip
 * Usage: npx tsx scripts/delete-all-items.ts [--dry-run]
 */

import { config } from 'dotenv';
import { getDb } from '../lib/db';
import { items, places } from '../lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const TRIP_ID = '26367e82-5e4d-448f-87c6-0f066f0f5c56'; // Hardcoded trip ID

async function deleteAllItems() {
  console.log(`🔍 Finding all items for trip ${TRIP_ID}...`);
  const db = getDb();

  // Get all items for this trip
  const allItems = await db
    .select()
    .from(items)
    .where(eq(items.tripId, TRIP_ID));
  console.log(`Found ${allItems.length} items in trip ${TRIP_ID}`);

  if (allItems.length === 0) {
    console.log('No items to delete.');
    return { deletedItems: 0, placeIds: [] };
  }

  // Collect all place IDs used by these items
  const placeIds = new Set<string>();
  for (const item of allItems) {
    if (item.originPlaceId) placeIds.add(item.originPlaceId);
    if (item.destinationPlaceId) placeIds.add(item.destinationPlaceId);
  }

  console.log(`Found ${placeIds.size} unique places referenced by these items`);

  // Show breakdown by type
  const typeCounts = allItems.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('\nItems by type:');
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  - ${type}: ${count}`);
  }

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} all ${allItems.length} items from trip ${TRIP_ID}...`,
  );

  if (!DRY_RUN) {
    try {
      const result = await db.delete(items).where(eq(items.tripId, TRIP_ID));
      console.log(`✅ Successfully deleted all items from trip ${TRIP_ID}`);
    } catch (error) {
      console.error(`❌ Failed to delete items:`, error);
      throw error;
    }
  } else {
    // In dry run mode, show some examples of what would be deleted
    console.log('\nExample items that would be deleted:');
    const examples = allItems.slice(0, 10);
    for (const item of examples) {
      console.log(
        `  - ${item.type}: ${item.title} (${item.startDate ? new Date(item.startDate).toLocaleDateString() : 'No date'})`,
      );
    }
    if (allItems.length > 10) {
      console.log(`  ... and ${allItems.length - 10} more items`);
    }
  }

  return { deletedItems: allItems.length, placeIds: Array.from(placeIds) };
}

async function deleteOrphanedPlaces(placeIdsToCheck: string[]) {
  if (placeIdsToCheck.length === 0) {
    console.log('\nNo places to check for orphans.');
    return;
  }

  console.log(
    `\n🔍 Checking ${placeIdsToCheck.length} places for orphaned records...`,
  );
  const db = getDb();

  // For each place, check if it's still referenced by any items
  const orphanedPlaces: string[] = [];

  for (const placeId of placeIdsToCheck) {
    const referencingItems = await db
      .select({ id: items.id })
      .from(items)
      .where(
        sql`${items.originPlaceId} = ${placeId} OR ${items.destinationPlaceId} = ${placeId}`,
      )
      .limit(1);

    if (referencingItems.length === 0) {
      orphanedPlaces.push(placeId);
    }
  }

  console.log(`Found ${orphanedPlaces.length} orphaned places`);

  if (orphanedPlaces.length === 0) {
    console.log('No orphaned places to delete.');
    return;
  }

  // Get place details for logging
  const placesToDelete = await db
    .select()
    .from(places)
    .where(inArray(places.id, orphanedPlaces));

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} ${orphanedPlaces.length} orphaned places...`,
  );

  if (!DRY_RUN) {
    try {
      await db.delete(places).where(inArray(places.id, orphanedPlaces));
      console.log(
        `✅ Successfully deleted ${orphanedPlaces.length} orphaned places`,
      );
    } catch (error) {
      console.error(`❌ Failed to delete places:`, error);
      throw error;
    }
  } else {
    console.log('\nOrphaned places that would be deleted:');
    for (const place of placesToDelete) {
      console.log(
        `  - ${place.type}: ${place.name} (${place.city || 'No city'}, ${place.country || 'No country'})`,
      );
    }
  }
}

async function main() {
  console.log('🗑️  Starting trip cleanup...');
  console.log(`Trip ID: ${TRIP_ID}`);
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN - No actual deletion will occur' : 'LIVE DELETION - Items and places will be permanently deleted'}`,
  );
  console.log('');

  if (!DRY_RUN) {
    console.log(
      `⚠️  WARNING: This will permanently delete all items and orphaned places for trip ${TRIP_ID}!`,
    );
    console.log('⚠️  This action cannot be undone!');
    console.log('');
  }

  try {
    const { deletedItems, placeIds } = await deleteAllItems();
    await deleteOrphanedPlaces(placeIds);
    console.log('\n✨ Operation completed!');
    console.log(`Summary: Deleted ${deletedItems} items from trip ${TRIP_ID}`);
  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
