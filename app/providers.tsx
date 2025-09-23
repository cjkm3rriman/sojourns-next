'use client';
import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';

export default function Providers({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Skip Clerk initialization during CI builds with dummy keys
  const isDummyKey = publishableKey?.includes('dummy') || publishableKey?.includes('Y2ktZHVtbXk');

  if (isDummyKey) {
    // Return children directly without Clerk provider during CI builds
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} dynamic>
      {children}
    </ClerkProvider>
  );
}
