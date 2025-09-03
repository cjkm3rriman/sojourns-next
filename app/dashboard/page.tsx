"use client";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

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
