'use client';
import { useState } from 'react';
import Image from 'next/image';
import PhoneInput from 'react-phone-number-input';
import AddressFields, { AddressData } from '@/components/AddressFields';

interface ClientData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  weddingAnniversary: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  allergies: string;
  flightPreferences: string;
  otherPreferences: string;
}

interface Props {
  slug: string;
  client: ClientData;
  sections: string[];
  orgName: string;
  logoWordmarkUrl: string | null;
}

export default function PortalForm({ slug, client, sections, orgName, logoWordmarkUrl }: Props) {
  const [form, setForm] = useState<ClientData>(client);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof ClientData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError('');
  }

  const addressValue: AddressData = {
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    state: form.state,
    zip: form.zip,
    country: form.country,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`/api/portal/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save');
      } else {
        setSuccess(true);
        return;
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const showProfile = sections.includes('profile');
  const showPreferences = sections.includes('preferences');
  const showCards = sections.includes('cards');
  const showPassports = sections.includes('passports');

  if (success) {
    return (
      <div className="portal-message">
        <div className="simple-card portal-message__card">
          <p className="portal-message__org">{orgName}</p>
          <h1 className="portal-message__title">All done!</h1>
          <p className="portal-message__body">Your travel profile has been updated. You can close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <main className="page-main page-main--portal">
        <div className="portal-header">
          {logoWordmarkUrl ? (
            <Image
              src={logoWordmarkUrl}
              alt={orgName}
              height={36}
              width={180}
              style={{ objectFit: 'contain', objectPosition: 'center', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }}
              unoptimized
            />
          ) : (
            <p className="portal-header__org">{orgName}</p>
          )}
          <h1 className="portal-header__title">Your Travel Profile</h1>
        </div>

        <form onSubmit={handleSubmit}>
          {showProfile && (
            <div className="simple-card portal-section">
              <h2 className="section-title">Personal Information</h2>

              <div className="form-field-row">
                <div>
                  <label className="field-label">First Name</label>
                  <input className="field-input" value={form.firstName} disabled placeholder="First name" />
                </div>
                <div>
                  <label className="field-label">Last Name</label>
                  <input className="field-input" value={form.lastName} disabled placeholder="Last name" />
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">Middle Name</label>
                <input
                  className="field-input"
                  value={form.middleName}
                  onChange={(e) => set('middleName', e.target.value)}
                  placeholder="Middle name"
                />
              </div>

              <div className="form-field">
                <label className="field-label">Date of Birth</label>
                <input
                  className="field-input"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="field-label">Wedding Anniversary</label>
                <input
                  className="field-input"
                  type="date"
                  value={form.weddingAnniversary}
                  onChange={(e) => set('weddingAnniversary', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="field-label">Email</label>
                <input className="field-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email address" />
              </div>

              <div className="form-field">
                <label className="field-label">Phone</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => set('phone', v ?? '')}
                  defaultCountry="US"
                  placeholder="Phone number"
                />
              </div>

              <AddressFields
                value={addressValue}
                onChange={(field, value) => set(field, value)}
              />
            </div>
          )}

          {showPreferences && (
            <div className="simple-card portal-section">
              <h2 className="section-title">Travel Preferences</h2>
              <div className="form-field">
                <label className="field-label">Allergies & Dietary Restrictions</label>
                <textarea
                  className="field-textarea"
                  value={form.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                  placeholder="E.g. gluten-free, nut allergy, vegan..."
                  rows={3}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Flight Preferences</label>
                <textarea
                  className="field-textarea"
                  value={form.flightPreferences}
                  onChange={(e) => set('flightPreferences', e.target.value)}
                  placeholder="E.g. window seat, business class, aisle preferred..."
                  rows={3}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="field-label">Other Preferences</label>
                <textarea
                  className="field-textarea"
                  value={form.otherPreferences}
                  onChange={(e) => set('otherPreferences', e.target.value)}
                  placeholder="E.g. boutique hotels, late check-out, twin beds..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {showCards && (
            <div className="simple-card portal-section">
              <h2 className="section-title">Payment Card</h2>
              <p className="portal-coming-soon">Card submission coming soon. Please contact your advisor.</p>
            </div>
          )}

          {showPassports && (
            <div className="simple-card portal-section">
              <h2 className="section-title">Passport</h2>
              <p className="portal-coming-soon">Passport submission coming soon. Please contact your advisor.</p>
            </div>
          )}

          {(showProfile || showPreferences) && (
            <div className="portal-actions">
              <button type="submit" className="btn btn-green" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {error && <span className="portal-error">{error}</span>}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
