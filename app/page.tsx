import Link from 'next/link';
import HomeAuthStatus from './home-auth-status';

export default function Page() {
  return (
    <main>
      <h1>🌎 Sojourns</h1>
      <p>Where every journey  becomes a story.</p>

      <HomeAuthStatus />

      <div style={{ marginTop: 16 }}>
        <Link href="/dashboard">Go to dashboard</Link>
      </div>
    </main>
  );
}