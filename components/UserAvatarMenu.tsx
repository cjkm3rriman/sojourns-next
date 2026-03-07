'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useClerk, useUser } from '@clerk/nextjs';
import { Settings, LogOut } from 'react-feather';

interface UserDisplayData {
  name?: string;
  imageUrl?: string;
  organization?: { name?: string; imageUrl?: string };
}

export default function UserAvatarMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [userData, setUserData] = useState<UserDisplayData | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch('/api/user-display-data')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUserData(data))
      .catch(() => {
        setUserData({ imageUrl: user.imageUrl });
      });
  }, [user, isLoaded]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!userData) return null;

  const orgImg = userData.organization?.imageUrl;
  const userImg = userData.imageUrl;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          height: '42px',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: '42px',
          }}
        >
          {orgImg && (
            <Image
              src={orgImg}
              alt="Organization"
              width={36}
              height={36}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 2,
              }}
            />
          )}
          {userImg && (
            <Image
              src={userImg}
              alt="User"
              width={36}
              height={36}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 1,
                marginLeft: orgImg ? '-10px' : '0',
              }}
            />
          )}
        </div>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.4rem)',
            right: 0,
            backgroundColor: 'rgba(20, 20, 20, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '0.4rem',
            minWidth: '180px',
            zIndex: 1000,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              padding: '0.55rem 0.85rem 0.6rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '0.4rem',
            }}
          >
            {userData.name && (
              <div
                style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.2 }}
              >
                {userData.name}
              </div>
            )}
            {userData.organization?.name && (
              <div
                style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '2px' }}
              >
                {userData.organization.name}
              </div>
            )}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.55rem 0.85rem',
              background: 'transparent',
              borderRadius: '8px',
              color: 'inherit',
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Settings size={14} />
            Settings
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              textAlign: 'left',
              padding: '0.55rem 0.85rem',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: 'inherit',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
