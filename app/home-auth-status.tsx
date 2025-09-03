'use client';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

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
