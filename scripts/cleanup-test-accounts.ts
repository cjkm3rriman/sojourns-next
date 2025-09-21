#!/usr/bin/env tsx

/**
 * Script to clean up test users and organizations from Clerk
 * Usage: npx tsx scripts/cleanup-test-accounts.ts [--dry-run]
 */

import { clerkClient } from '@clerk/nextjs/server';

const DRY_RUN = process.argv.includes('--dry-run');

async function getClerk() {
  return await clerkClient();
}

// Patterns to identify test accounts
const TEST_EMAIL_PATTERNS = [
  /test.*@/i,
  /@test\./i,
  /example\.com$/i,
  /@gmail\.com$/i, // Be careful with this - maybe too broad
  /\+test@/i,
];

const TEST_ORG_PATTERNS = [/test/i, /demo/i, /example/i];

async function cleanupTestUsers() {
  console.log('🔍 Finding test users...');

  const users = await clerkClient.users.getUserList({ limit: 500 });
  const testUsers = users.data.filter((user) => {
    const email = user.emailAddresses[0]?.emailAddress || '';
    return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
  });

  console.log(`Found ${testUsers.length} test users`);

  for (const user of testUsers) {
    const email = user.emailAddresses[0]?.emailAddress || 'no-email';
    console.log(
      `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} user: ${email} (${user.id})`,
    );

    if (!DRY_RUN) {
      try {
        await clerkClient.users.deleteUser(user.id);
        console.log(`✅ Deleted user: ${email}`);
      } catch (error) {
        console.error(`❌ Failed to delete user ${email}:`, error);
      }
    }
  }
}

async function cleanupTestOrganizations() {
  console.log('🔍 Finding test organizations...');

  const organizations = await clerkClient.organizations.getOrganizationList({
    limit: 500,
  });
  const testOrgs = organizations.data.filter((org) => {
    return TEST_ORG_PATTERNS.some((pattern) => pattern.test(org.name));
  });

  console.log(`Found ${testOrgs.length} test organizations`);

  for (const org of testOrgs) {
    console.log(
      `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} organization: ${org.name} (${org.id})`,
    );

    if (!DRY_RUN) {
      try {
        await clerkClient.organizations.deleteOrganization(org.id);
        console.log(`✅ Deleted organization: ${org.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete organization ${org.name}:`, error);
      }
    }
  }
}

async function cleanupOldAccounts(daysOld: number = 7) {
  console.log(`🔍 Finding accounts older than ${daysOld} days...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const users = await clerkClient.users.getUserList({ limit: 500 });
  const oldUsers = users.data.filter((user) => {
    const createdAt = new Date(user.createdAt);
    return createdAt < cutoffDate;
  });

  console.log(`Found ${oldUsers.length} old accounts`);

  for (const user of oldUsers) {
    const email = user.emailAddresses[0]?.emailAddress || 'no-email';
    const createdAt = new Date(user.createdAt).toLocaleDateString();
    console.log(
      `${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'} old user: ${email} (created: ${createdAt})`,
    );

    if (!DRY_RUN) {
      try {
        await clerkClient.users.deleteUser(user.id);
        console.log(`✅ Deleted old user: ${email}`);
      } catch (error) {
        console.error(`❌ Failed to delete old user ${email}:`, error);
      }
    }
  }
}

async function main() {
  console.log('🧹 Starting Clerk test account cleanup...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE DELETION'}`);
  console.log('');

  try {
    await cleanupTestUsers();
    console.log('');
    await cleanupTestOrganizations();
    console.log('');
    // Uncomment to also clean up old accounts
    // await cleanupOldAccounts(7);

    console.log('✨ Cleanup completed!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
