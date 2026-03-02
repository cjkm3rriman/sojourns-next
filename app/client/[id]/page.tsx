'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Edit2, Save, X, Trash2 } from 'react-feather';
import SojournsHeader from '@/components/SojournsHeader';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  travelPreferences: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (response.ok) {
          const data = await response.json();
          setClient(data.client);
        } else {
          console.error('Client not found');
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchClient();
  }, [clientId]);

  const startEditing = () => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      travelPreferences: client.travelPreferences || '',
      notes: client.notes || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!client || !editForm.firstName?.trim() || !editForm.lastName?.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }

      const data = await response.json();
      setClient(data.client);
      setEditing(false);
      setEditForm({});
    } catch (error) {
      console.error('Error saving client:', error);
      alert(error instanceof Error ? error.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${client?.firstName} ${client?.lastName}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      router.push('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete client.');
      setDeleting(false);
    }
  };

  const fieldChange = (field: keyof Client, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const displayValue = (val: string | null | undefined, fallback = '—') => val || fallback;

  const canSave = !saving && !!editForm.firstName?.trim() && !!editForm.lastName?.trim();

  if (loading) {
    return (
      <div className="page-wrapper">
        <SojournsHeader />
        <main className="page-main">
          <p style={{ opacity: 0.7 }}>Loading...</p>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-wrapper">
        <SojournsHeader />
        <main className="page-main">
          <p>Client not found.</p>
          <Link href="/clients" className="back-link">← Back to Clients</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <SojournsHeader />
      <main className="page-main">
        <Link href="/clients" className="back-link">← Back to Clients</Link>

        <div className="client-detail-header">
          <div className="client-avatar client-avatar--lg">
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>
              {client.firstName} {client.lastName}
            </h1>
            <p className="client-detail-meta">
              Added {formatDate(client.createdAt)}
              {client.updatedAt !== client.createdAt && (
                <> · Updated {formatDate(client.updatedAt)}</>
              )}
            </p>
          </div>
          <div className="client-actions">
            {editing ? (
              <>
                <button onClick={cancelEditing} className="btn btn-cancel">
                  <X size={15} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="btn btn-golden"
                  style={{ opacity: canSave ? 1 : 0.5 }}
                >
                  <Save size={15} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={startEditing} className="btn btn-golden">
                  <Edit2 size={15} /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn btn-danger"
                  style={{ opacity: deleting ? 0.5 : 1 }}
                >
                  <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="simple-card client-detail-card">
          <div>
            <div className="field-meta-label">First Name</div>
            {editing ? (
              <input
                type="text"
                value={editForm.firstName || ''}
                onChange={(e) => fieldChange('firstName', e.target.value)}
                className="field-input--sm"
                required
              />
            ) : (
              <div className="field-value">{displayValue(client.firstName)}</div>
            )}
          </div>

          <div>
            <div className="field-meta-label">Last Name</div>
            {editing ? (
              <input
                type="text"
                value={editForm.lastName || ''}
                onChange={(e) => fieldChange('lastName', e.target.value)}
                className="field-input--sm"
                required
              />
            ) : (
              <div className="field-value">{displayValue(client.lastName)}</div>
            )}
          </div>

          <div>
            <div className="field-meta-label">Email</div>
            {editing ? (
              <input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => fieldChange('email', e.target.value)}
                className="field-input--sm"
              />
            ) : (
              <div className="field-value">{displayValue(client.email)}</div>
            )}
          </div>

          <div>
            <div className="field-meta-label">Phone</div>
            {editing ? (
              <input
                type="tel"
                value={editForm.phone || ''}
                onChange={(e) => fieldChange('phone', e.target.value)}
                className="field-input--sm"
              />
            ) : (
              <div className="field-value">{displayValue(client.phone)}</div>
            )}
          </div>

          <div>
            <div className="field-meta-label">Address</div>
            {editing ? (
              <input
                type="text"
                value={editForm.address || ''}
                onChange={(e) => fieldChange('address', e.target.value)}
                className="field-input--sm"
              />
            ) : (
              <div className="field-value">{displayValue(client.address)}</div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div className="field-meta-label">Travel Preferences</div>
            {editing ? (
              <textarea
                value={editForm.travelPreferences || ''}
                onChange={(e) => fieldChange('travelPreferences', e.target.value)}
                className="field-textarea"
                placeholder="e.g. Business class, no seafood, prefers boutique hotels..."
              />
            ) : (
              <div className="field-value">{displayValue(client.travelPreferences)}</div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div className="field-meta-label">Notes</div>
            {editing ? (
              <textarea
                value={editForm.notes || ''}
                onChange={(e) => fieldChange('notes', e.target.value)}
                className="field-textarea"
                placeholder="Internal notes..."
              />
            ) : (
              <div className="field-value">{displayValue(client.notes)}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
