'use client';
import Image from 'next/image';
import HomeAuthStatus from './home-auth-status';

export default function Page() {
  return (
    <div className="centered-container">
      <h1>Sojourns</h1>
      <main className="content-card">
        <HomeAuthStatus />
      </main>

      <div className="tagline-container">
        <div className="tagline-icon">
          <Image
            src="/images/sojourns-passport.png"
            alt="Journey icon"
            width={72}
            height={72}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <p className="tagline">
          where every journey
          <br />
          &nbsp;&nbsp;becomes a story.
        </p>
      </div>
    </div>
  );
}
