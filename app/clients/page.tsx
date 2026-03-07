'use client';
import NextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Search, Shuffle, CreditCard, Book, Users, Mail, Phone, Calendar } from 'react-feather';
import PageSwitcher from '@/components/PageSwitcher';
import SojournsHeader from '@/components/SojournsHeader';

export const dynamic = 'force-dynamic';

const SignedIn = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedIn),
  { ssr: false },
);

const SignedOut = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedOut),
  { ssr: false },
);

const UserAvatarMenu = NextDynamic(
  () => import('@/components/UserAvatarMenu'),
  { ssr: false },
);

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
  passportCount: number;
}

function formatShortDOB(dob: string | null | undefined): string {
  if (!dob) return '';
  const [year, month, day] = dob.split('-').map(Number);
  if (!year || !month || !day) return '';
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
  return `${monthName} ${day}, ${year}`;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'updated'>(
    'created',
  );

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients);
        } else {
          setError(true);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const filteredClients = clients
    .filter((c) => {
      const q = searchQuery.toLowerCase();
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      return fullName.includes(q) || (c.email || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'created') {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (sortBy === 'updated') {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      } else {
        return (
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName)
        );
      }
    });

  return (
    <div className="page-wrapper">
      <SojournsHeader />
      <main className="page-main">
        <SignedIn>
          <div className="title-bar">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <PageSwitcher />
              <Link
                href="/client/create"
                className="btn btn-green"
                style={{ textDecoration: 'none', width: 'fit-content' }}
              >
                <PlusCircle size={16} /> New
              </Link>
              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input input-rounded"
                />
              </div>
              <button
                onClick={() =>
                  setSortBy(
                    sortBy === 'created'
                      ? 'name'
                      : sortBy === 'name'
                        ? 'updated'
                        : 'created',
                  )
                }
                className="btn btn-golden input-rounded"
                title={`Currently sorting by ${sortBy}`}
              >
                <Shuffle size={16} />
                {sortBy === 'created'
                  ? 'Created'
                  : sortBy === 'name'
                    ? 'Name'
                    : 'Updated'}
              </button>
            </div>
            <UserAvatarMenu />
          </div>

          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading clients...</p>
          ) : error ? (
            <p style={{ opacity: 0.7 }}>There was a problem retrieving your clients, please try again later.</p>
          ) : filteredClients.length > 0 ? (
            <div className="client-grid">
              {filteredClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/client/${client.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="simple-card client-card">
                    <div className="client-avatar client-avatar--sm">
                      {getInitials(client.firstName, client.lastName)}
                    </div>
                    <div className="client-card__names">
                      <div className="client-name">
                        {client.firstName} {client.lastName}
                      </div>
                      <div className="client-card__counts">
                        <span className="client-card__count">
                          <Users size={12} />
                          1
                        </span>
                        <span className="client-card__count">
                          <CreditCard size={12} />
                          {client.cardCount}
                        </span>
                        <span className="client-card__count">
                          <Book size={12} />
                          {client.passportCount}
                        </span>
                      </div>
                    </div>
                    {client.email && <span className="client-card__meta-cell"><Mail size={13} />{client.email}</span>}
                    {client.phone && <span className="client-card__meta-cell"><Phone size={13} />{client.phone}</span>}
                    {client.dateOfBirth && <span className="client-card__meta-cell"><Calendar size={13} />{formatShortDOB(client.dateOfBirth)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : clients.length > 0 ? (
            <p style={{ opacity: 0.7 }}>
              No clients match &quot;{searchQuery}&quot;.
            </p>
          ) : (
            <p>No clients yet. Add your first client to get started!</p>
          )}
        </SignedIn>
        <SignedOut>
          <p>Please sign in to access your clients.</p>
        </SignedOut>
      </main>
    </div>
  );
}
