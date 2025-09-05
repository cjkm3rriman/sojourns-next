'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import HomeAuthStatus from './home-auth-status';

const cityImages = [
  '/images/newyork.png',
  '/images/london.png',
  '/images/beach.png',
  '/images/rome.png',
];

export default function Page() {
  const [randomImage, setRandomImage] = useState('/images/newyork.png'); // fallback

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * cityImages.length);
    setRandomImage(cityImages[randomIndex]);
  }, []);

  return (
    <div className="centered-container">
      <div className="logo-container">
        <Image
          src={randomImage}
          alt="Travel destination"
          width={72}
          height={72}
          style={{ objectFit: 'contain' }}
        />
      </div>
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
          where every journey
          <br />
          &nbsp;&nbsp;becomes a story.
        </p>
      </div>
    </div>
  );
}
