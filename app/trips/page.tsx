'use client';
import NextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
        <h1 style={{ textAlign: 'left', marginBottom: '1.5rem' }}>Trips</h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr minmax(300px, auto)',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <div>
            <SignedIn>
              <Link
                href="/trip/create"
                className="btn btn-golden btn-auto"
                style={{
                  marginBottom: '1.5rem',
                  textDecoration: 'none',
                }}
              >
                Create New Trip →
              </Link>

              {tripsLoading ? (
                <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Loading trips...
                </p>
              ) : trips.length > 0 ? (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>Recent Trips</h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {trips.map((trip) => (
                      <Link
                        key={trip.id}
                        href={`/trip/${trip.id}`}
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            {trip.icon && <span>{trip.icon}</span>}
                            <strong style={{ fontSize: '0.9rem' }}>
                              {trip.clientName}
                            </strong>
                          </div>
                          {trip.destination && (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                opacity: 0.7,
                                marginBottom: '0.25rem',
                              }}
                            >
                              {trip.destination}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                textTransform: 'capitalize',
                              }}
                            >
                              {trip.status}
                            </span>
                            <button className="btn btn-secondary btn-sm btn-auto">
                              View Trip
                            </button>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
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
            }}
          >
            <SignedIn>
              <div style={{ textAlign: 'left' }}>
                <UserInfo />

                <SignOutButton redirectUrl="/">
                  <button
                    className="btn btn-secondary btn-sm btn-auto"
                    style={{ marginTop: '1rem' }}
                  >
                    Sign Out
                  </button>
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
        </div>
      </main>
    </div>
  );
}
