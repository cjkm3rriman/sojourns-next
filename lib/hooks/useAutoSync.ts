'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface AutoSyncResult {
  syncing: boolean;
  synced: boolean;
  error: string | null;
}

/**
 * Hook to automatically sync authenticated users to database
 * Call this in components that need to ensure user exists in DB
 */
export function useAutoSync(): AutoSyncResult {
  const { isSignedIn, user } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || synced || syncing) {
      return;
    }

    const syncUser = async () => {
      setSyncing(true);
      setError(null);

      try {
        const response = await fetch('/api/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Sync failed');
        }

        setSynced(true);
        console.log('Auto-sync result:', result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Auto-sync failed:', err);
      } finally {
        setSyncing(false);
      }
    };

    // Small delay to ensure Clerk is fully loaded
    const timeoutId = setTimeout(syncUser, 100);
    return () => clearTimeout(timeoutId);
  }, [isSignedIn, user, synced, syncing]);

  return { syncing, synced, error };
}

/**
 * Hook for manual sync trigger (useful for admin pages)
 */
export function useManualSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncUser = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return { syncUser, syncing, error };
}
