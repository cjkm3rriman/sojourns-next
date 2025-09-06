import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { getDb } from '@/lib/db';
import { organizations, users, memberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

// Only enforce webhook secret in runtime, not during build
if (!webhookSecret && process.env.NODE_ENV !== 'production') {
  throw new Error('CLERK_WEBHOOK_SECRET is required');
}

// Clerk event types we want to handle
type ClerkEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | OrganizationCreatedEvent
  | OrganizationUpdatedEvent
  | OrganizationDeletedEvent
  | OrganizationMembershipCreatedEvent
  | OrganizationMembershipDeletedEvent
  | OrganizationMembershipUpdatedEvent;

interface UserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name: string | null;
    last_name: string | null;
  };
}

interface UserUpdatedEvent {
  type: 'user.updated';
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name: string | null;
    last_name: string | null;
  };
}

interface UserDeletedEvent {
  type: 'user.deleted';
  data: {
    id: string;
  };
}

interface OrganizationCreatedEvent {
  type: 'organization.created';
  data: {
    id: string;
    name: string;
    slug: string;
  };
}

interface OrganizationUpdatedEvent {
  type: 'organization.updated';
  data: {
    id: string;
    name: string;
    slug: string;
  };
}

interface OrganizationDeletedEvent {
  type: 'organization.deleted';
  data: {
    id: string;
  };
}

interface OrganizationMembershipCreatedEvent {
  type: 'organizationMembership.created';
  data: {
    id: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    public_user_data: {
      user_id: string;
    };
    role: string;
  };
}

interface OrganizationMembershipUpdatedEvent {
  type: 'organizationMembership.updated';
  data: {
    id: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    public_user_data: {
      user_id: string;
    };
    role: string;
  };
}

interface OrganizationMembershipDeletedEvent {
  type: 'organizationMembership.deleted';
  data: {
    id: string;
    organization: {
      id: string;
    };
    public_user_data: {
      user_id: string;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check if webhook secret is configured
    if (!webhookSecret) {
      return new Response('Webhook not configured', { status: 500 });
    }
    // Get headers
    const headerPayload = await headers();
    const svixId = headerPayload.get('svix-id');
    const svixTimestamp = headerPayload.get('svix-timestamp');
    const svixSignature = headerPayload.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 });
    }

    // Get the body
    const payload = await req.text();

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(webhookSecret!);

    let evt: ClerkEvent;

    try {
      evt = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return new Response('Error verifying webhook', { status: 400 });
    }

    // Handle the webhook
    console.log(`Processing webhook: ${evt.type}`);
    await handleWebhook(evt);

    return new Response('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleWebhook(evt: ClerkEvent) {
  switch (evt.type) {
    case 'user.created':
    case 'user.updated':
      await handleUserUpsert(evt.data);
      break;

    case 'user.deleted':
      await handleUserDelete(evt.data.id);
      break;

    case 'organization.created':
    case 'organization.updated':
      await handleOrganizationUpsert(evt.data);
      break;

    case 'organization.deleted':
      await handleOrganizationDelete(evt.data.id);
      break;

    case 'organizationMembership.created':
    case 'organizationMembership.updated':
      await handleMembershipUpsert(evt.data);
      break;

    case 'organizationMembership.deleted':
      await handleMembershipDelete(evt.data);
      break;

    default:
      console.log(`Unhandled webhook type: ${(evt as any).type}`);
  }
}

async function handleUserUpsert(userData: UserCreatedEvent['data']) {
  const db = getDb();
  const name =
    `${userData.first_name || ''} ${userData.last_name || ''}`.trim() ||
    'Unknown';
  const email = userData.email_addresses[0]?.email_address || '';

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, userData.id))
    .limit(1);

  if (existingUser.length === 0) {
    // Create new user
    await db.insert(users).values({
      clerkUserId: userData.id,
      email,
      name,
      role: 'agent', // Default role, can be updated later
    });
    console.log(`Created user: ${name} (${email})`);
  } else {
    // Update existing user
    await db
      .update(users)
      .set({
        email,
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, userData.id));
    console.log(`Updated user: ${name} (${email})`);
  }
}

async function handleUserDelete(clerkUserId: string) {
  const db = getDb();
  // Delete user and related memberships
  const user = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (user.length > 0) {
    const userId = user[0].id;

    // Delete memberships first (foreign key constraint)
    await db.delete(memberships).where(eq(memberships.userId, userId));

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    console.log(`Deleted user: ${clerkUserId}`);
  }
}

async function handleOrganizationUpsert(
  orgData: OrganizationCreatedEvent['data'],
) {
  const db = getDb();
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgData.id))
    .limit(1);

  if (existingOrg.length === 0) {
    // Create new organization
    await db.insert(organizations).values({
      clerkOrgId: orgData.id,
      name: orgData.name,
      slug: orgData.slug,
    });
    console.log(`Created organization: ${orgData.name}`);
  } else {
    // Update existing organization
    await db
      .update(organizations)
      .set({
        name: orgData.name,
        slug: orgData.slug,
        updatedAt: new Date(),
      })
      .where(eq(organizations.clerkOrgId, orgData.id));
    console.log(`Updated organization: ${orgData.name}`);
  }
}

async function handleOrganizationDelete(clerkOrgId: string) {
  const db = getDb();
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  if (org.length > 0) {
    const orgId = org[0].id;

    // Delete memberships first (foreign key constraint)
    await db.delete(memberships).where(eq(memberships.organizationId, orgId));

    // Delete organization
    await db.delete(organizations).where(eq(organizations.id, orgId));

    console.log(`Deleted organization: ${clerkOrgId}`);
  }
}

async function handleMembershipUpsert(
  membershipData: OrganizationMembershipCreatedEvent['data'],
) {
  const db = getDb();
  // First ensure the organization exists
  await handleOrganizationUpsert(membershipData.organization);

  // Get the database IDs
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, membershipData.public_user_data.user_id))
    .limit(1);

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, membershipData.organization.id))
    .limit(1);

  if (!user || !organization) {
    console.error(
      `Missing user or organization for membership: ${membershipData.id}`,
    );
    return;
  }

  // Map Clerk role to our role
  const role =
    membershipData.role === 'org:admin'
      ? ('admin' as const)
      : membershipData.role === 'org:member'
        ? ('member' as const)
        : ('member' as const);

  const existingMembership = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.organizationId, organization.id),
      ),
    )
    .limit(1);

  if (existingMembership.length === 0) {
    // Create new membership
    await db.insert(memberships).values({
      userId: user.id,
      organizationId: organization.id,
      role,
    });
    console.log(
      `Created membership: ${user.name} -> ${organization.name} (${role})`,
    );
  } else {
    // Update existing membership
    await db
      .update(memberships)
      .set({ role })
      .where(eq(memberships.id, existingMembership[0].id));
    console.log(
      `Updated membership: ${user.name} -> ${organization.name} (${role})`,
    );
  }
}

async function handleMembershipDelete(
  membershipData: OrganizationMembershipDeletedEvent['data'],
) {
  const db = getDb();
  // Get the database IDs
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, membershipData.public_user_data.user_id))
    .limit(1);

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, membershipData.organization.id))
    .limit(1);

  if (user && organization) {
    await db
      .delete(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.organizationId, organization.id),
        ),
      );
    console.log(`Deleted membership: ${user.name} -> ${organization.name}`);
  }
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
