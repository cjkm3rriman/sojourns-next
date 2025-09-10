'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const SignedIn = dynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedIn),
  { ssr: false },
);
const SignedOut = dynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedOut),
  { ssr: false },
);
const UserButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  { ssr: false },
);

export default function HomeAuthStatus() {
  return (
    <div
      style={{
        margin: '24px 0',
        minHeight: '120px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <SignedIn>
        <Link
          href="/trips"
          className="btn btn-golden btn-auto"
          style={{ textDecoration: 'none' }}
        >
          Plan More Trips
        </Link>
      </SignedIn>
      <SignedOut>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link
            href="/sign-in"
            className="btn btn-golden btn-full"
            style={{ textDecoration: 'none' }}
          >
            Sign In
          </Link>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '0.9rem',
              lineHeight: '1.4',
            }}
          >
            Are you a travel agent looking for a beautiful itinerary app for
            your clients that also saves you time?{' '}
            <Link
              href="/sign-up"
              style={{ color: 'white', textDecoration: 'underline' }}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </SignedOut>
    </div>
  );
}
