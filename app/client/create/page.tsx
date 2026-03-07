'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-number-input';

export default function CreateClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create client');
      }

      const data = await response.json();
      router.push(`/client/${data.client.id}`);
    } catch (error) {
      console.error('Error creating client:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to create client. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    form.firstName.trim() && form.lastName.trim() && !isSubmitting;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <main className="page-main--form">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/clients" className="back-link">
            ← Back to Clients
          </Link>
          <h1 style={{ textAlign: 'left', marginBottom: 0 }}>New Client</h1>
        </div>

        <div className="form-layout">
          <div>
            <div className="simple-card" style={{ padding: '2rem' }}>
              <form onSubmit={handleSubmit}>
                <div className="form-field-row">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="field-label field-label--required"
                    >
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="Thomas"
                      required
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="field-label field-label--required"
                    >
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Cook"
                      required
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="email" className="field-label">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="thomas.cook@gmail.com"
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Phone</label>
                  <PhoneInput
                    value={form.phone}
                    onChange={(v) => setForm((prev) => ({ ...prev, phone: v ?? '' }))}
                    defaultCountry="US"
                    placeholder="+1 212 555 4444"
                  />
                </div>
              </form>
            </div>

            <div className="form-actions">
              <button
                onClick={handleSubmit}
                className="btn btn-golden btn-auto"
                disabled={!canSubmit}
                style={{
                  opacity: canSubmit ? 1 : 0.5,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {isSubmitting ? 'Creating...' : 'Create Client →'}
              </button>
            </div>
          </div>

          <div />
        </div>
      </main>
    </div>
  );
}
