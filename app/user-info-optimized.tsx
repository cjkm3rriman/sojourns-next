'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';

interface UserDisplayData {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  };
}

export function UserInfoOptimized() {
  const { user, isLoaded } = useUser();
  const [userData, setUserData] = useState<UserDisplayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      if (!user?.id) return;

      try {
        // Try database first
        const response = await fetch('/api/user-display-data');

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          // Fallback to Clerk data
          const orgImageUrl =
            user.organizationMemberships?.[0]?.organization.imageUrl;

          setUserData({
            id: user.id,
            name: user.fullName || user.firstName || 'User',
            email: user.primaryEmailAddress?.emailAddress || '',
            imageUrl: user.imageUrl,
            organization: user.organizationMemberships?.[0]
              ? {
                  id: user.organizationMemberships[0].organization.id,
                  name: user.organizationMemberships[0].organization.name,
                  slug: user.organizationMemberships[0].organization.slug || '',
                  imageUrl: orgImageUrl,
                }
              : undefined,
          });
        }
      } catch (error) {
        console.error('Error fetching user display data:', error);
        // Fallback to Clerk data on error
        if (user) {
          setUserData({
            id: user.id,
            name: user.fullName || user.firstName || 'User',
            email: user.primaryEmailAddress?.emailAddress || '',
            imageUrl: user.imageUrl,
          });
        }
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded && user) {
      fetchUserData();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [user, isLoaded]);

  if (loading || !userData) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <div style={{ opacity: 0.6 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {(userData.organization?.imageUrl || userData.imageUrl) && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: '48px',
            marginRight: '12px',
          }}
        >
          {userData.organization?.imageUrl && (
            <Image
              src={userData.organization.imageUrl}
              alt="Organization"
              width={48}
              height={48}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 2,
              }}
            />
          )}
          {userData.imageUrl && (
            <Image
              src={userData.imageUrl}
              alt="User"
              width={48}
              height={48}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 1,
                marginLeft: userData.organization?.imageUrl ? '-12px' : '0',
              }}
            />
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          {userData.name}
        </div>
        {userData.organization && (
          <div
            style={{
              fontSize: '0.85rem',
              opacity: 0.7,
              marginTop: '2px',
            }}
          >
            {userData.organization.name}
          </div>
        )}
      </div>
    </div>
  );
}
