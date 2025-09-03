"use client";
import { SignIn } from "@clerk/nextjs";
import Providers from "@/app/providers";

export default function SignInPage() {
  return (
    <Providers>
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <SignIn />
      </main>
    </Providers>
  );
}
