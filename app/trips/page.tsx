'use client';
import NextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PlusCircle, Search, Shuffle, ChevronsDown } from 'react-feather';
import { useAutoSync } from '@/lib/hooks/useAutoSync';
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
  const [sortBy, setSortBy] = useState<'created' | 'startDate' | 'updated'>(
    'created',
  );
  const [tripItemCounts, setTripItemCounts] = useState<Record<string, number>>(
    {},
  );
  const [agentImages, setAgentImages] = useState<Record<string, string>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Available trip statuses
  const availableStatuses = ['draft', 'proposal', 'confirmed', 'cancelled'];

  // Close status filter when clicking outside
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showStatusFilter && !target.closest('[data-status-filter]')) {
        setShowStatusFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusFilter]);

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
      const matchesSearch =
        destination.includes(query) || clientName.includes(query);

      // If no statuses selected, show all trips
      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(trip.status);

      return matchesSearch && matchesStatus;
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
      <SojournsHeader />
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
            <div className="title-bar">
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <PageSwitcher />
                <Link
                  href="/trip/create"
                  className="btn btn-green"
                  style={{ textDecoration: 'none', width: 'fit-content' }}
                >
                  <PlusCircle size={16} /> New
                </Link>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: '300px',
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
                    setSortBy(
                      sortBy === 'created'
                        ? 'startDate'
                        : sortBy === 'startDate'
                          ? 'updated'
                          : 'created',
                    )
                  }
                  className="btn btn-golden input-rounded"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Currently sorting by ${sortBy === 'created' ? 'creation date' : sortBy === 'updated' ? 'last updated' : 'trip start date'}`}
                >
                  <Shuffle size={16} />
                  {sortBy === 'created'
                    ? 'Created'
                    : sortBy === 'updated'
                      ? 'Updated'
                      : 'Trip Date'}
                </button>
                <div style={{ position: 'relative' }} data-status-filter>
                  <button
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className="btn btn-golden input-rounded"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      whiteSpace: 'nowrap',
                    }}
                    title="Filter by status"
                  >
                    <ChevronsDown size={16} />
                    Status
                    {selectedStatuses.length > 0 && (
                      <span
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '10px',
                          padding: '0.1rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {selectedStatuses.length}
                      </span>
                    )}
                  </button>
                  {showStatusFilter && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.5rem)',
                        left: 0,
                        backgroundColor: 'rgba(20, 20, 20, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        minWidth: '200px',
                        zIndex: 1000,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        {availableStatuses.map((status) => (
                          <label
                            key={status}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes(status)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStatuses([
                                    ...selectedStatuses,
                                    status,
                                  ]);
                                } else {
                                  setSelectedStatuses(
                                    selectedStatuses.filter(
                                      (s) => s !== status,
                                    ),
                                  );
                                }
                              }}
                              style={{
                                cursor: 'pointer',
                                width: '18px',
                                height: '18px',
                                accentColor: '#d4af37',
                                borderRadius: '4px',
                              }}
                            />
                            <span style={{ textTransform: 'capitalize' }}>
                              {status}
                            </span>
                          </label>
                        ))}
                      </div>
                      {selectedStatuses.length > 0 && (
                        <button
                          onClick={() => setSelectedStatuses([])}
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem',
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              'rgba(255, 255, 255, 0.12)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              'rgba(255, 255, 255, 0.08)';
                          }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <UserAvatarMenu />
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

        </div>
      </main>
    </div>
  );
}
