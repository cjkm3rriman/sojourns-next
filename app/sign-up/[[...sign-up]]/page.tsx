'use client';
import NextDynamic from 'next/dynamic';
export const dynamic = 'force-dynamic';
const SignUp = NextDynamic(
  () => import('@clerk/nextjs').then((m) => m.SignUp),
  {
    ssr: false,
  },
);

export default function SignUpPage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <SignUp />
    </main>
  );
}
