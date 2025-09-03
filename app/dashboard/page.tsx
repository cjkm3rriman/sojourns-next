'use client';
import NextDynamic from 'next/dynamic';
export const dynamic = 'force-dynamic';
const SignedIn = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedIn),
  { ssr: false },
);
const SignedOut = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignedOut),
  { ssr: false },
);
const UserButton = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  { ssr: false },
);

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <SignedIn>
        <p>You are signed in. Welcome!</p>
        <div style={{ marginTop: 16 }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
      <SignedOut>
        <p>You are signed out. Please sign in.</p>
      </SignedOut>
    </main>
  );
}
