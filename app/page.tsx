import Link from 'next/link';
import Image from 'next/image';
import HomeAuthStatus from './home-auth-status';

export default function Page() {
  return (
    <div className="centered-container">
      <main className="content-card">
        <h1>Sojourns</h1>

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
          Where every journey
          <br />
          &nbsp;&nbsp;becomes a story.
        </p>
      </div>
    </div>
  );
}
