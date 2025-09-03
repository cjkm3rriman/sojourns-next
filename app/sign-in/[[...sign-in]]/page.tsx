'use client';
import NextDynamic from 'next/dynamic';
export const dynamic = 'force-dynamic';
const SignIn = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignIn),
  {
    ssr: false,
  },
);

export default function SignInPage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <SignIn />
    </main>
  );
}
