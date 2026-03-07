import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { clients, clientPortals, portalSessions, organizations } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import PortalForm from './PortalForm';

export const dynamic = 'force-dynamic';

export default async function PortalPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('portal_session')?.value;

  let orgName = 'Your Travel Advisor';

  if (!sessionToken) {
    return <SessionExpiredPage orgName={orgName} />;
  }

  const db = getDb();
  const now = new Date();

  const result = await db
    .select({
      session: portalSessions,
      portal: clientPortals,
    })
    .from(portalSessions)
    .innerJoin(clientPortals, eq(portalSessions.portalId, clientPortals.id))
    .where(
      and(
        eq(portalSessions.sessionToken, sessionToken),
        eq(clientPortals.slug, slug),
        gt(portalSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (result.length === 0) {
    return <SessionExpiredPage orgName={orgName} />;
  }

  const { session, portal } = result[0];

  const clientResult = await db
    .select()
    .from(clients)
    .where(eq(clients.id, portal.clientId))
    .limit(1);

  if (clientResult.length === 0) {
    return <SessionExpiredPage orgName={orgName} />;
  }

  const client = clientResult[0];

  const orgResult = await db
    .select({ name: organizations.name, logoWordmarkUrl: organizations.logoWordmarkUrl })
    .from(organizations)
    .where(eq(organizations.id, client.organizationId))
    .limit(1);

  orgName = orgResult[0]?.name ?? orgName;
  const logoWordmarkUrl = orgResult[0]?.logoWordmarkUrl ?? null;
  const sections = JSON.parse(session.sections) as string[];

  return (
    <PortalForm
      slug={slug}
      client={{
        firstName: client.firstName,
        middleName: client.middleName ?? '',
        lastName: client.lastName,
        dateOfBirth: client.dateOfBirth ?? '',
        weddingAnniversary: client.weddingAnniversary ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        addressLine1: client.addressLine1 ?? '',
        addressLine2: client.addressLine2 ?? '',
        city: client.city ?? '',
        state: client.state ?? '',
        zip: client.zip ?? '',
        country: client.country ?? '',
        allergies: client.allergies ?? '',
        flightPreferences: client.flightPreferences ?? '',
        otherPreferences: client.otherPreferences ?? '',
      }}
      sections={sections}
      orgName={orgName}
      logoWordmarkUrl={logoWordmarkUrl}
    />
  );
}

function SessionExpiredPage({ orgName }: { orgName: string }) {
  return (
    <div className="portal-message">
      <div className="simple-card portal-message__card">
        <p className="portal-message__org">{orgName}</p>
        <h1 className="portal-message__title">Session Expired</h1>
        <p className="portal-message__body">
          Your session has expired. Please contact your advisor to receive a new link.
        </p>
      </div>
    </div>
  );
}
