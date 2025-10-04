'use client';
import NextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PlusCircle, Search, Shuffle } from 'react-feather';
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
  agentId?: string;
  agentName?: string;
  agentClerkUserId?: string;
  organizationName?: string;
}

export default function DashboardPage() {
  const { syncing, synced, error } = useAutoSync();
  const [userData, setUserData] = useState<UserDisplayData | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [iconExistsCache, setIconExistsCache] = useState<
    Record<string, boolean>
  >({});
  const [sortBy, setSortBy] = useState<'created' | 'startDate'>('created');
  const [tripItemCounts, setTripItemCounts] = useState<Record<string, number>>(
    {},
  );
  const [agentImages, setAgentImages] = useState<Record<string, string>>({});

  // Check if trip icons exist
  useEffect(() => {
    trips.forEach((trip) => {
      if (trip.icon && !iconExistsCache.hasOwnProperty(trip.icon)) {
        const img = document.createElement('img');
        img.onload = () => {
          setIconExistsCache((prev) => ({ ...prev, [trip.icon!]: true }));
        };
        img.onerror = () => {
          setIconExistsCache((prev) => ({ ...prev, [trip.icon!]: false }));
        };
        img.src = `/images/icons/trip/${trip.icon}.png?v=30`;
      }
    });
  }, [trips, iconExistsCache]);

  // Fetch item counts for each trip
  useEffect(() => {
    trips.forEach(async (trip) => {
      if (!tripItemCounts.hasOwnProperty(trip.id)) {
        try {
          const response = await fetch(`/api/trips/${trip.id}/items`);
          if (response.ok) {
            const data = await response.json();
            const itemCount = data.items ? data.items.length : 0;
            setTripItemCounts((prev) => ({ ...prev, [trip.id]: itemCount }));
          }
        } catch (error) {
          console.error('Error fetching trip items:', error);
        }
      }
    });
  }, [trips, tripItemCounts]);

  // Set agent images - for now use current user's image for all trips they created
  useEffect(() => {
    if (userData?.imageUrl) {
      const newAgentImages: Record<string, string> = {};
      trips.forEach((trip) => {
        if (trip.agentClerkUserId && userData.imageUrl) {
          newAgentImages[trip.agentClerkUserId] = userData.imageUrl;
        }
      });
      setAgentImages(newAgentImages);
    }
  }, [trips, userData]);

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

  // Date formatting function from detail page
  const formatDate = (date: Date, includeDay = false) => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
    };
    if (includeDay) {
      options.weekday = 'short';
    }

    const formatted = date.toLocaleDateString('en-US', options);
    // Add ordinal suffix to day
    return formatted.replace(/(\d+)/, (match, day) => {
      const dayNum = parseInt(day);
      const suffix =
        dayNum % 10 === 1 && dayNum !== 11
          ? 'st'
          : dayNum % 10 === 2 && dayNum !== 12
            ? 'nd'
            : dayNum % 10 === 3 && dayNum !== 13
              ? 'rd'
              : 'th';
      return `${day}${suffix}`;
    });
  };

  // Filter and sort trips
  const filteredTrips = trips
    .filter((trip) => {
      const query = searchQuery.toLowerCase();
      const destination = (trip.destination || '').toLowerCase();
      const clientName = trip.clientName.toLowerCase();
      return destination.includes(query) || clientName.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'created') {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        // Sort by start date - trips with no start date go to the end
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      }
    });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%) translateZ(0)',
          WebkitTransform: 'translateX(-50%) translateZ(0)',
          zIndex: 1000,
          display: 'inline-block',
          borderRadius: '40px',
          overflow: 'hidden',
        }}
      >
        {/* Light blur layer - covers full header */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        {/* Medium blur layer - fades from top to middle */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            mask: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 70%)',
            WebkitMask:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Heavy blur layer - strongest at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            mask: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0) 50%)',
            WebkitMask:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0) 50%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1
            style={{
              fontFamily: 'var(--font-sojourns), serif',
              fontWeight: 400,
              fontSize: '1.8rem',
              margin: 0,
              padding: '0.8rem 0.8rem 0.5rem 0.8rem',
              display: 'block',
              textTransform: 'uppercase',
              textShadow: [
                '0 2px 4px rgba(0, 0, 0, 0.3)',
                '0 0 10px rgba(255, 255, 255, 0.037)',
                '0 0 20px rgba(255, 255, 255, 0.025)',
                '0 0 30px rgba(255, 255, 255, 0.012)',
              ].join(', '),
            }}
          >
            Sojourns
          </h1>
        </div>
      </header>
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '5rem 2rem 2rem 2rem',
          minHeight: '100vh',
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        >
          <SignedIn>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1.5rem',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: '400px',
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
                    className="input-rounded"
                    style={{
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'inherit',
                      fontSize: '0.9rem',
                      width: '100%',
                      height: '42px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={() =>
                    setSortBy(sortBy === 'created' ? 'startDate' : 'created')
                  }
                  className="btn btn-golden input-rounded"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Currently sorting by ${sortBy === 'created' ? 'creation date' : 'trip start date'}`}
                >
                  <Shuffle size={16} />
                  {sortBy === 'created' ? 'Created' : 'Trip Date'}
                </button>
              </div>
              <Link
                href="/trip/create"
                className="btn btn-green"
                style={{
                  textDecoration: 'none',
                  width: 'fit-content',
                }}
              >
                <PlusCircle size={16} /> New Trip
              </Link>
            </div>
          </SignedIn>
          <SignedIn>
            {tripsLoading ? (
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                Loading trips...
              </p>
            ) : filteredTrips.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                }}
              >
                {filteredTrips.map((trip) => {
                  const iconExists = trip.icon
                    ? iconExistsCache[trip.icon]
                    : false;

                  return (
                    <Link
                      key={trip.id}
                      href={`/trip/${trip.id}`}
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div className="trips">
                        <div
                          className="title"
                          style={{
                            backgroundImage: `url('/images/places/${
                              trip?.destination
                                ?.toLowerCase()
                                .replace(/\s+/g, '-')
                                .replace(/[^a-z0-9-]/g, '') || 'default'
                            }.jpg')`,
                          }}
                        >
                          <div className="title-icon-badge">
                            <Image
                              className="title-icon"
                              src={
                                iconExists && trip?.icon
                                  ? `/images/icons/trip/${trip.icon}.png?v=30`
                                  : `/images/icons/trip/default.png?v=30`
                              }
                              alt="Trip icon"
                              width={40}
                              height={40}
                              style={{ objectFit: 'contain', flexShrink: 0 }}
                            />
                          </div>
                          <h1>{trip.destination || 'Somewhere'}</h1>
                          <div className="title-date">
                            {(() => {
                              if (!trip.startDate) return 'sooner → later';

                              const startDate = new Date(trip.startDate);
                              const endDate = trip.endDate
                                ? new Date(trip.endDate)
                                : null;

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
                          </div>
                          <div className="title-info">
                            <div
                              className={`title-status ${trip.status === 'confirmed' ? 'confirmed' : ''}`}
                            >
                              {trip.status}
                            </div>
                          </div>
                          <div className="title-content">
                            <h2>{trip.clientName || 'Client'}</h2>
                            <div className="title-bottom">
                              <p className="title-strap">
                                {tripItemCounts[trip.id] || 0} items
                              </p>
                              {trip.agentClerkUserId &&
                                agentImages[trip.agentClerkUserId] && (
                                  <Image
                                    className="title-agent"
                                    src={agentImages[trip.agentClerkUserId]}
                                    alt={trip.agentName || 'Agent'}
                                    width={28}
                                    height={28}
                                    style={{
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
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
                  Welcome to your dashboard! This is where you&apos;ll plan and
                  manage your trips.
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

          {/* User Info Section */}
          <div
            className="simple-card"
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              width: 'fit-content',
              minWidth: '250px',
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
        </div>
      </main>
    </div>
  );
}
