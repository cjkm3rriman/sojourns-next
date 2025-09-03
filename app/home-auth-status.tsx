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
    <div style={{ marginTop: 16 }}>
      <SignedIn>
        <span>Signed in</span>
        <div style={{ display: 'inline-block', marginLeft: 12 }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
      <SignedOut>
        <Link href="/sign-in">Sign in</Link> |{' '}
        <Link href="/sign-up">Sign up</Link>
      </SignedOut>
    </div>
  );
}
