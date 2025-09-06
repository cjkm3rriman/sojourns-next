#!/usr/bin/env tsx

/**
 * Script to clean up orphaned database records after Clerk account deletions
 * Usage: npx tsx scripts/cleanup-database.ts [--dry-run]
 */

import { getDb } from '../lib/db';
import { users, organizations, memberships } from '../lib/db/schema';
import { clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');

async function cleanupOrphanedUsers() {
  console.log('🔍 Finding orphaned users in database...');
  const db = getDb();
  const dbUsers = await db.select().from(users);
  const orphanedUsers = [];

  for (const dbUser of dbUsers) {
    try {
      // Try to fetch user from Clerk
      await clerkClient.users.getUser(dbUser.clerkUserId);
    } catch (error: any) {
      if (error.status === 404) {
        orphanedUsers.push(dbUser);
      } else {
        console.error(`Error checking user ${dbUser.clerkUserId}:`, error);
      }
    }
  }

  console.log(`Found ${orphanedUsers.length} orphaned users in database`);

  for (const user of orphanedUsers) {
    console.log(
      `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} orphaned user: ${user.name} (${user.email})`,
    );

    if (!DRY_RUN) {
      try {
        // Delete memberships first (foreign key constraint)
        await getDb()
          .delete(memberships)
          .where(eq(memberships.userId, user.id));

        // Delete user
        await getDb().delete(users).where(eq(users.id, user.id));

        console.log(`✅ Deleted orphaned user: ${user.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete user ${user.name}:`, error);
      }
    }
  }
}

async function cleanupOrphanedOrganizations() {
  console.log('🔍 Finding orphaned organizations in database...');
  const db2 = getDb();
  const dbOrgs = await db2.select().from(organizations);
  const orphanedOrgs = [];

  for (const dbOrg of dbOrgs) {
    try {
      // Try to fetch organization from Clerk
      await clerkClient.organizations.getOrganization({
        organizationId: dbOrg.clerkOrgId,
      });
    } catch (error: any) {
      if (error.status === 404) {
        orphanedOrgs.push(dbOrg);
      } else {
        console.error(
          `Error checking organization ${dbOrg.clerkOrgId}:`,
          error,
        );
      }
    }
  }

  console.log(
    `Found ${orphanedOrgs.length} orphaned organizations in database`,
  );

  for (const org of orphanedOrgs) {
    console.log(
      `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} orphaned organization: ${org.name}`,
    );

    if (!DRY_RUN) {
      try {
        // Delete memberships first (foreign key constraint)
        await getDb()
          .delete(memberships)
          .where(eq(memberships.organizationId, org.id));

        // Delete organization
        await getDb().delete(organizations).where(eq(organizations.id, org.id));

        console.log(`✅ Deleted orphaned organization: ${org.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete organization ${org.name}:`, error);
      }
    }
  }
}

async function main() {
  console.log('🧹 Starting database cleanup...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE DELETION'}`);
  console.log('');

  try {
    await cleanupOrphanedUsers();
    console.log('');
    await cleanupOrphanedOrganizations();

    console.log('✨ Database cleanup completed!');
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
