'use client';
import NextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sunrise, Search } from 'react-feather';
import { useAutoSync } from '@/lib/hooks/useAutoSync';

export const dynamic = 'force-dynamic';

const SignedIn = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedIn),
  { ssr: false },
);

const SignedOut = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedOut),
  { ssr: false },
);

const SignOutButton = NextDynamic(
  () =>
    import('@clerk/nextjs').then((m) => {
      const { SignOutButton } = m;
      return {
        default: SignOutButton,
      };
    }),
  { ssr: false },
);

const UserInfo = NextDynamic(
  () =>
    import('../user-info-optimized').then((m) => ({
      default: m.UserInfoOptimized,
    })),
  { ssr: false },
);

interface UserDisplayData {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  };
}

interface Trip {
  id: string;
  clientName: string;
  destination?: string;
  tripSummary?: string;
  icon?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { syncing, synced, error } = useAutoSync();
  const [userData, setUserData] = useState<UserDisplayData | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/user-display-data');
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }

    async function fetchTrips() {
      try {
        const response = await fetch('/api/trips');
        if (response.ok) {
          const data = await response.json();
          setTrips(data.trips);
        }
      } catch (error) {
        console.error('Error fetching trips:', error);
      } finally {
        setTripsLoading(false);
      }
    }

    fetchUserData();
    fetchTrips();
  }, []);

  // Filter trips based on search query
  const filteredTrips = trips.filter((trip) => {
    const query = searchQuery.toLowerCase();
    const destination = (trip.destination || '').toLowerCase();
    const clientName = trip.clientName.toLowerCase();
    return destination.includes(query) || clientName.includes(query);
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '3rem 2rem 2rem 2rem',
          height: '100vh',
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, auto) 1fr',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <div
            className="simple-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              padding: '1.5rem',
              alignSelf: 'flex-start',
              width: 'fit-content',
              minWidth: '300px',
              minHeight: '400px',
            }}
          >
            <SignedIn>
              <div style={{ textAlign: 'left' }}>
                <UserInfo />

                <SignOutButton redirectUrl="/">
                  <span
                    style={{
                      marginTop: '1rem',
                      display: 'block',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '0.9rem',
                      opacity: 0.7,
                    }}
                  >
                    Sign Out
                  </span>
                </SignOutButton>
              </div>
            </SignedIn>
            <SignedOut>
              <p
                style={{ textAlign: 'left', fontSize: '0.9rem', opacity: 0.8 }}
              >
                Sign in required
              </p>
            </SignedOut>
          </div>

          <div>
            <h1 style={{ textAlign: 'left', marginBottom: '1rem' }}>Trips</h1>
            <SignedIn>
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: '250px',
                  }}
                >
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      opacity: 0.6,
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search trips..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'inherit',
                      fontSize: '0.9rem',
                      width: '100%',
                      height: '42px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <Link
                  href="/trip/create"
                  className="btn btn-golden"
                  style={{
                    textDecoration: 'none',
                    width: 'fit-content',
                  }}
                >
                  <Sunrise size={16} /> Create New Trip
                </Link>
              </div>
            </SignedIn>
            <SignedIn>
              {tripsLoading ? (
                <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Loading trips...
                </p>
              ) : filteredTrips.length > 0 ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {filteredTrips.map((trip) => (
                      <Link
                        key={trip.id}
                        href={`/trip/${trip.id}`}
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div className="trips-card">
                          {trip.icon && (
                            <Image
                              src={`/images/icons/trip/${trip.icon}.png`}
                              alt="Trip icon"
                              width={72}
                              height={72}
                              style={{ objectFit: 'contain', flexShrink: 0 }}
                            />
                          )}
                          <div className="trips-content">
                            <div className="trips-title">
                              <span>
                                {trip.destination || 'Somewhere Delightful'}
                              </span>
                              <span className="trips-client">
                                <span>•</span> {trip.clientName}
                              </span>
                            </div>
                            <div className="trips-date">
                              <span className="trips-status">
                                {trip.status}
                              </span>
                              <span>
                                {(() => {
                                  if (!trip.startDate)
                                    return 'Trip dates to be determined';

                                  const startDate = new Date(trip.startDate);
                                  const endDate = trip.endDate
                                    ? new Date(trip.endDate)
                                    : null;

                                  const formatDate = (
                                    date: Date,
                                    includeDay = false,
                                  ) => {
                                    const options: Intl.DateTimeFormatOptions =
                                      {
                                        month: 'long',
                                        day: 'numeric',
                                      };
                                    if (includeDay) {
                                      options.weekday = 'short';
                                    }

                                    const formatted = date.toLocaleDateString(
                                      'en-US',
                                      options,
                                    );
                                    // Add ordinal suffix to day
                                    return formatted.replace(
                                      /(\d+)/,
                                      (match, day) => {
                                        const dayNum = parseInt(day);
                                        const suffix =
                                          dayNum % 10 === 1 && dayNum !== 11
                                            ? 'st'
                                            : dayNum % 10 === 2 && dayNum !== 12
                                              ? 'nd'
                                              : dayNum % 10 === 3 &&
                                                  dayNum !== 13
                                                ? 'rd'
                                                : 'th';
                                        return `${day}${suffix}`;
                                      },
                                    );
                                  };

                                  const startFormatted = formatDate(
                                    startDate,
                                    false,
                                  );

                                  if (!endDate) return startFormatted;

                                  // If same month, just show day for end date
                                  const endFormatted =
                                    startDate.getMonth() === endDate.getMonth()
                                      ? formatDate(endDate).replace(/\w+ /, '') // Remove month
                                      : formatDate(endDate);

                                  return `${startFormatted} → ${endFormatted}`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : trips.length > 0 ? (
                <div>
                  <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                    No trips match your search &quot;{searchQuery}&quot;.
                  </p>
                </div>
              ) : (
                <div>
                  <p>
                    Welcome to your dashboard! This is where you&apos;ll plan
                    and manage your trips.
                  </p>
                  <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                    No trips yet. Create your first trip to get started!
                  </p>
                </div>
              )}

              {syncing && (
                <p
                  style={{
                    fontSize: '0.9rem',
                    opacity: 0.7,
                    marginTop: '1rem',
                  }}
                >
                  Setting up your account...
                </p>
              )}
              {error && (
                <p
                  style={{
                    fontSize: '0.9rem',
                    color: '#ff6b6b',
                    marginTop: '1rem',
                  }}
                >
                  Setup error: {error}
                </p>
              )}
            </SignedIn>
            <SignedOut>
              <p>Please sign in to access your dashboard.</p>
            </SignedOut>
          </div>
        </div>
      </main>
    </div>
  );
}
