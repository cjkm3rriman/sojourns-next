'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SojournsHeader from '@/components/SojournsHeader';

export default function PinSettingsPage() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    fetch('/api/settings/pin')
      .then((r) => r.json())
      .then((d) => setPinSet(d.pinSet))
      .catch(() => setPinSet(false))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { pin: newPin };
      if (pinSet) body.currentPin = currentPin;

      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save PIN.');
        return;
      }

      setSuccess(true);
      setPinSet(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setError('Failed to save PIN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <SojournsHeader />
      <main className="page-main">
        <Link href="/clients" className="back-link">
          ← Back to Clients
        </Link>

        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.6rem' }}>
          {loading ? '' : pinSet ? 'Change Reveal PIN' : 'Set Reveal PIN'}
        </h1>
        <p style={{ margin: '0 0 2rem', opacity: 0.6, fontSize: '0.9rem' }}>
          This PIN protects access to stored payment card details.
        </p>

        {!loading && (
          <div
            className="simple-card"
            style={{ maxWidth: 400, padding: '2rem' }}
          >
            <form onSubmit={handleSubmit}>
              {pinSet && (
                <div className="form-field">
                  <label className="field-label field-label--required">
                    Current PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="field-input"
                    placeholder="••••"
                    maxLength={4}
                    required
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div className="form-field">
                <label className="field-label field-label--required">
                  {pinSet ? 'New PIN' : 'PIN'} (4 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="field-input"
                  placeholder="••••"
                  maxLength={4}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-field">
                <label className="field-label field-label--required">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="field-input"
                  placeholder="••••"
                  maxLength={4}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p
                  style={{
                    color: 'rgba(255, 100, 100, 0.9)',
                    fontSize: '0.875rem',
                    margin: '0 0 1rem',
                  }}
                >
                  {error}
                </p>
              )}
              {success && (
                <p
                  style={{
                    color: '#d4af37',
                    fontSize: '0.875rem',
                    margin: '0 0 1rem',
                  }}
                >
                  PIN saved successfully.
                </p>
              )}

              <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-golden"
                  style={{ opacity: saving ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : pinSet ? 'Change PIN' : 'Set PIN'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
