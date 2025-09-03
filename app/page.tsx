import Link from 'next/link';
import HomeAuthStatus from './home-auth-status';

export default function Page() {
  return (
    <main>
      <h1>Hello, world 👋</h1>
      <p>Welcome to the Sojourns Next.js scaffold.</p>

      <HomeAuthStatus />

      <div style={{ marginTop: 16 }}>
        <Link href="/dashboard">Go to dashboard</Link>
      </div>
    </main>
  );
}
