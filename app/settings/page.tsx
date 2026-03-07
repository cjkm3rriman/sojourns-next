'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import SojournsHeader from '@/components/SojournsHeader';

interface OrgData {
  id: string;
  name: string;
  logoSquareUrl: string | null;
  logoWordmarkUrl: string | null;
  headerImageUrl: string | null;
}

interface SettingsData {
  pinSet: boolean;
  membershipRole: string;
  org: OrgData;
}

const SLOTS = [
  { key: 'square', label: 'Square Logo', hint: 'Square · PNG or SVG' },
  { key: 'wordmark', label: 'Wordmark Logo', hint: 'Wide · PNG or SVG' },
  { key: 'header', label: 'Header Image', hint: 'Wide banner · JPG or PNG' },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'];

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);

  // PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  // Org name state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  // Image upload state
  const [uploadingSlot, setUploadingSlot] = useState<SlotKey | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRefs = useRef<Record<SlotKey, HTMLInputElement | null>>({
    square: null,
    wordmark: null,
    header: null,
  });

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setData(d);
          setNameValue(d.org?.name ?? '');
        }
      })
      .catch(() => {});
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess(false);

    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and confirmation do not match.');
      return;
    }

    setPinSaving(true);
    try {
      const body: Record<string, string> = { pin: newPin };
      if (data?.pinSet) body.currentPin = currentPin;

      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        setPinError(d.error || 'Failed to save PIN.');
        return;
      }

      setPinSuccess(true);
      setData((prev) => prev && { ...prev, pinSet: true });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setPinError('Failed to save PIN.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleNameSave = async () => {
    setNameError('');
    if (!nameValue.trim()) return;
    setNameSaving(true);
    try {
      const res = await fetch('/api/settings/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue }),
      });
      if (!res.ok) {
        const d = await res.json();
        setNameError(d.error || 'Failed to save.');
        return;
      }
      setData((prev) =>
        prev ? { ...prev, org: { ...prev.org, name: nameValue.trim() } } : prev,
      );
      setEditingName(false);
    } catch {
      setNameError('Failed to save.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleImageUpload = async (slot: SlotKey, file: File) => {
    setUploadError('');
    setUploadingSlot(slot);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/settings/org/images/${slot}`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const d = await res.json();
        setUploadError(d.error || 'Upload failed.');
        return;
      }
      const { url } = await res.json();
      setData((prev) => {
        if (!prev) return prev;
        const colMap: Record<SlotKey, keyof OrgData> = {
          square: 'logoSquareUrl',
          wordmark: 'logoWordmarkUrl',
          header: 'headerImageUrl',
        };
        return { ...prev, org: { ...prev.org, [colMap[slot]]: url } };
      });
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const getSlotUrl = (slot: SlotKey): string | null => {
    if (!data?.org) return null;
    if (slot === 'square') return data.org.logoSquareUrl;
    if (slot === 'wordmark') return data.org.logoWordmarkUrl;
    return data.org.headerImageUrl;
  };

  const isAdmin = data?.membershipRole === 'admin';

  return (
    <div className="page-wrapper">
      <SojournsHeader />
      <main className="page-main">
        <h1 style={{ margin: '0 0 2rem', fontSize: '1.6rem' }}>Settings</h1>

        <div className={`settings-layout${isAdmin ? ' settings-layout--two-col' : ''}`}>
          {/* Personal column */}
          <div>
            <h2 className="section-title">Personal</h2>
            <div className="simple-card" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <span className="field-meta-label">Reveal PIN</span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', opacity: 0.6 }}>
                  {data === null
                    ? 'Loading…'
                    : data.pinSet
                      ? 'PIN is set. Change it below.'
                      : 'No PIN set. Add one to protect card reveals.'}
                </p>
              </div>

              {data !== null && (
                <form onSubmit={handlePinSubmit}>
                  {data.pinSet && (
                    <div className="form-field">
                      <label className="field-label field-label--required">Current PIN</label>
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
                      {data.pinSet ? 'New PIN' : 'PIN'} (4 digits)
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
                    <label className="field-label field-label--required">Confirm PIN</label>
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

                  {pinError && (
                    <p style={{ color: 'rgba(255,100,100,0.9)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                      {pinError}
                    </p>
                  )}
                  {pinSuccess && (
                    <p style={{ color: '#d4af37', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                      PIN saved successfully.
                    </p>
                  )}

                  <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                    <button type="submit" disabled={pinSaving} className="btn btn-golden" style={{ opacity: pinSaving ? 0.5 : 1 }}>
                      {pinSaving ? 'Saving…' : data.pinSet ? 'Change PIN' : 'Set PIN'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Org column — admin only */}
          {isAdmin && (
            <div>
              <h2 className="section-title">Organisation</h2>

              {/* Org name card */}
              <div className="simple-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                <div className="field-meta-label" style={{ marginBottom: '0.75rem' }}>Name</div>
                {editingName ? (
                  <div>
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="field-input"
                      style={{ marginBottom: '0.75rem' }}
                    />
                    {nameError && (
                      <p style={{ color: 'rgba(255,100,100,0.9)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                        {nameError}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-green"
                        onClick={handleNameSave}
                        disabled={nameSaving}
                        style={{ opacity: nameSaving ? 0.5 : 1 }}
                      >
                        {nameSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        className="btn btn-cancel"
                        onClick={() => {
                          setEditingName(false);
                          setNameValue(data?.org.name ?? '');
                          setNameError('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ fontSize: '1rem' }}>{data?.org.name}</span>
                    <button className="btn" onClick={() => setEditingName(true)} style={{ flexShrink: 0 }}>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Branding images card */}
              <div className="simple-card" style={{ padding: '1.5rem' }}>
                <div className="field-meta-label" style={{ marginBottom: '1rem' }}>Branding Images</div>

                {uploadError && (
                  <p style={{ color: 'rgba(255,100,100,0.9)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                    {uploadError}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {SLOTS.map((slotDef) => {
                    const url = getSlotUrl(slotDef.key);
                    const uploading = uploadingSlot === slotDef.key;
                    return (
                      <div key={slotDef.key} className="image-slot">
                        <div className={`image-slot__preview${url ? ' image-slot__preview--filled' : ''}`}>
                          {url ? (
                            <Image
                              src={url}
                              alt={slotDef.label}
                              fill
                              style={{ objectFit: 'contain' }}
                              unoptimized
                            />
                          ) : (
                            <span style={{ opacity: 0.3, fontSize: '0.8rem' }}>No image</span>
                          )}
                        </div>
                        <div className="image-slot__label">
                          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{slotDef.label}</span>
                          <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{slotDef.hint}</span>
                        </div>
                        <div className="image-slot__actions">
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            ref={(el) => { fileRefs.current[slotDef.key] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(slotDef.key, file);
                              e.target.value = '';
                            }}
                          />
                          <button
                            className="btn"
                            disabled={uploading}
                            onClick={() => fileRefs.current[slotDef.key]?.click()}
                            style={{ opacity: uploading ? 0.5 : 1 }}
                          >
                            {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
