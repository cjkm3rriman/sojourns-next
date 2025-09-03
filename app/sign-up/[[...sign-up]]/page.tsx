"use client";
import { SignUp } from "@clerk/nextjs";
import Providers from "@/app/providers";

export default function SignUpPage() {
  return (
    <Providers>
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <SignUp />
      </main>
    </Providers>
  );
}
