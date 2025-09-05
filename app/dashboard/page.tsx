'use client';
import NextDynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import Image from 'next/image';
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
    import('@clerk/nextjs').then((m) => {
      const { useUser } = m;
      return {
        default: function UserInfoComponent() {
          const { user } = useUser();

          if (!user) return null;

          const orgImageUrl =
            user.organizationMemberships &&
            user.organizationMemberships.length > 0
              ? user.organizationMemberships[0].organization.imageUrl
              : null;
          const userImageUrl = user.imageUrl;

          return (
            <div style={{ marginBottom: '1rem' }}>
              {(orgImageUrl || userImageUrl) && (
                <div
                  style={{
                    marginBottom: '0.75rem',
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '48px',
                  }}
                >
                  {orgImageUrl && (
                    <Image
                      src={orgImageUrl}
                      alt="Organization"
                      width={48}
                      height={48}
                      style={{
                        borderRadius: '50%',
                        objectFit: 'cover',
                        position: 'relative',
                        zIndex: 2,
                      }}
                    />
                  )}
                  {userImageUrl && (
                    <Image
                      src={userImageUrl}
                      alt="User"
                      width={48}
                      height={48}
                      style={{
                        borderRadius: '50%',
                        objectFit: 'cover',
                        position: 'relative',
                        zIndex: 1,
                        marginLeft: orgImageUrl ? '-12px' : '0',
                      }}
                    />
                  )}
                </div>
              )}
              <p
                style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                {user.fullName || user.firstName || 'User'}
              </p>
              {user.organizationMemberships &&
                user.organizationMemberships.length > 0 && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      opacity: 0.7,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {user.organizationMemberships[0].organization.name}
                  </p>
                )}
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          );
        },
      };
    }),
  { ssr: false },
);

export default function DashboardPage() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        minHeight: '100vh',
      }}
    >
      <main
        style={{
          display: 'grid',
          gridTemplateColumns: '2.5fr 1fr',
          gap: '2rem',
          padding: '2rem',
          minHeight: 'calc(100vh - 4rem)',
          maxWidth: '1200px',
          width: '100%',
        }}
      >
        <div>
          <h1 style={{ textAlign: 'left' }}>Dashboard</h1>
          <SignedIn>
            <p>
              Welcome to your dashboard! This is where you&apos;ll plan and
              manage your trips.
            </p>
          </SignedIn>
          <SignedOut>
            <p>Please sign in to access your dashboard.</p>
          </SignedOut>
        </div>

        <div
          className="dashboard-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '1.5rem',
            alignSelf: 'flex-start',
            width: 'fit-content',
            minWidth: '200px',
          }}
        >
          <SignedIn>
            <div style={{ textAlign: 'center' }}>
              <UserInfo />
              <SignOutButton redirectUrl="/">
                <button
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginTop: '1rem',
                  }}
                >
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <p
              style={{ textAlign: 'center', fontSize: '0.9rem', opacity: 0.8 }}
            >
              Sign in required
            </p>
          </SignedOut>
        </div>
      </main>
    </div>
  );
}
