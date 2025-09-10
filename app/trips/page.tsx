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

export default function DashboardPage() {
  const { syncing, synced, error } = useAutoSync();
  const [userData, setUserData] = useState<UserDisplayData | null>(null);

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

    fetchUserData();
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
          display: 'grid',
          gridTemplateColumns: '1fr minmax(300px, auto)',
          gap: '1.5rem',
          padding: '2rem',
          height: '100vh',
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'auto',
        }}
      >
        <div>
          <h1 style={{ textAlign: 'left' }}>Trips</h1>

          

          <SignedIn>
            <Link
              href="/trips/create"
              className="btn btn-golden btn-auto"
              style={{
                marginBottom: '1.5rem',
                textDecoration: 'none',
              }}
            >
              Create New Trip →
            </Link>

            <p>
              Welcome to your dashboard! This is where you&apos;ll plan and
              manage your trips.
            </p>
            {syncing && (
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                Setting up your account...
              </p>
            )}
            {error && (
              <p style={{ fontSize: '0.9rem', color: '#ff6b6b' }}>
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
            marginTop: '0.5rem',
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
      </main>
    </div>
  );
}
