"use client";
import React from "react";
import dynamic from "next/dynamic";

const ClerkProviderDynamic = dynamic(
  () => import("@clerk/nextjs").then((m) => m.ClerkProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <ClerkProviderDynamic publishableKey={publishableKey}>
      {children}
    </ClerkProviderDynamic>
  );
}
