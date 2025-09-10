'use client';

import { useState } from 'react';

export default function SyncPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sync-clerk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Failed to sync' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="centered-container">
      <h1>Sync Clerk Data</h1>
      <div className="content-card">
        <p>
          This will sync your current Clerk user and organizations to the
          database.
        </p>

        <button
          onClick={handleSync}
          disabled={loading}
          className="btn btn-golden btn-auto"
          style={{
            marginTop: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Syncing...' : 'Sync Clerk Data'}
        </button>

        {result && (
          <pre
            style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '400px',
              textAlign: 'left',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
