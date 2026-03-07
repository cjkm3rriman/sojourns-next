'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Edit, X, Trash2, PlusCircle, Eye, EyeOff, Mail, Phone, XOctagon } from 'react-feather';
import PhoneInput, { formatPhoneNumberIntl } from 'react-phone-number-input';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import SojournsHeader from '@/components/SojournsHeader';
import AddressFields from '@/components/AddressFields';
import { COUNTRIES, COUNTRY_FLAG_CODE } from '@/lib/address-data';
import { LOYALTY_PROGRAMS } from '@/lib/loyalty-programs';

function toDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function fromDate(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function toExpiryDate(str: string): Date | null {
  if (!str) return null;
  const [mm, yyyy] = str.split('/');
  if (!mm || !yyyy) return null;
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
  return isNaN(d.getTime()) ? null : d;
}

function fromExpiryDate(date: Date | null): string {
  if (!date) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

interface Client {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  weddingAnniversary: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  allergies: string | null;
  flightPreferences: string | null;
  otherPreferences: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientCard {
  id: string;
  clientId: string;
  last4: string;
  expiry: string;
  cardType: string | null;
  opItemId: string;
  createdAt: string;
}

interface ClientPassport {
  id: string;
  clientId: string;
  issuingCountry: string | null;
  expiryDate: string; // YYYY-MM-DD
  opItemId: string;
  createdAt: string;
}

const ISSUING_AUTHORITY_DISPLAY: Record<string, string> = {
  'united states department of state': 'US Passport',
};

function formatIssuingAuthority(authority: string | null | undefined): string {
  if (!authority) return 'Passport';
  return ISSUING_AUTHORITY_DISPLAY[authority.toLowerCase()] ?? authority;
}

interface ClientLoyalty {
  id: string;
  clientId: string;
  programName: string;
  memberNumber: string;
  expiryDate: string | null; // YYYY-MM-DD
  createdAt: string;
}

interface RevealedPassport {
  givenNames: string;
  surname: string;
  passportNumber: string;
  nationality: string;
  placeOfBirth: string;
  dateOfBirth: string;
  issueDate: string;
  expiryDate: string;
  issuingCountry: string;
}

interface RevealedCard {
  cardNumber: string;
  cvv: string;
  cardholderName: string;
  expiry: string;
  billingZip: string | null;
  billingAddress: string | null;
}

const REVEAL_SECONDS = 120;

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatDOB(dob: string | null | undefined): string {
  if (!dob) return '—';
  const [year, month, day] = dob.split('-').map(Number);
  if (!year || !month || !day) return dob;
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
  return `${monthName} ${ordinal(day)}, ${year}`;
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return '—';
  const [year, month, day] = dob.split('-').map(Number);
  if (!year || !month || !day) return '—';
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return String(age);
}

function formatUpdated(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'profile last updated just now';
  if (diffMins < 60) return `profile last updated ${diffMins}m ago`;
  if (diffHours < 24) return `profile last updated ${diffHours}h ago`;

  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `profile last updated ${day} ${month} ${ordinal(date.getDate())}, ${year}`;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

const CARD_LOGOS: Record<string, string> = {
  Visa: '/images/icons/creditcards/visa.svg',
  Mastercard: '/images/icons/creditcards/mastercard.svg',
  Amex: '/images/icons/creditcards/amex.svg',
  Discover: '/images/icons/creditcards/discover.svg',
  Diners: '/images/icons/creditcards/diners.svg',
  JCB: '/images/icons/creditcards/jcb.svg',
  UnionPay: '/images/icons/creditcards/unionpay.svg',
};

function passportExpiryStatus(expiryDate: string): 'expired' | 'soon' | 'ok' {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  if (expiry < now) return 'expired';
  if (expiry < sixMonths) return 'soon';
  return 'ok';
}

function formatPassportDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPhone(phone: string) {
  const intl = formatPhoneNumberIntl(phone);
  return intl || phone;
}

function formatCardNumber(num: string) {
  return num.replace(/(.{4})/g, '$1 ').trim();
}

// ─── Add Card modal ────────────────────────────────────────────────────────────

function AddCardModal({
  clientId,
  onClose,
  onAdded,
}: {
  clientId: string;
  onClose: () => void;
  onAdded: (card: ClientCard) => void;
}) {
  const [form, setForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    billingLine1: '',
    billingLine2: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add card.');
        return;
      }
      onAdded(data.card);
    } catch {
      setError('Failed to add card.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add Payment Card</h2>
          <button onClick={onClose} className="btn btn-cancel btn--xs">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-field">
              <label className="field-label field-label--required">
                Cardholder Name
              </label>
              <input
                type="text"
                value={form.cardholderName}
                onChange={(e) => field('cardholderName', e.target.value)}
                className="field-input"
                placeholder="Jane Smith"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label field-label--required">
                Card Number
              </label>
              <input
                type="text"
                value={form.cardNumber}
                onChange={(e) =>
                  field('cardNumber', e.target.value.replace(/\D/g, ''))
                }
                className="field-input"
                placeholder="4111111111111111"
                maxLength={19}
                required
              />
            </div>

            <div className="form-field-row">
              <div>
                <label className="field-label field-label--required">
                  Expiry
                </label>
                <DatePicker
                  selected={toExpiryDate(form.expiry)}
                  onChange={(d: Date | null) => field('expiry', fromExpiryDate(d))}
                  dateFormat="MM/yyyy"
                  showMonthYearPicker
                  placeholderText="MM/YYYY"
                  className="field-input"
                  wrapperClassName="datepicker-wrapper"
                />
              </div>
              <div>
                <label className="field-label field-label--required">CVV</label>
                <input
                  type="password"
                  value={form.cvv}
                  onChange={(e) =>
                    field('cvv', e.target.value.replace(/\D/g, ''))
                  }
                  className="field-input"
                  placeholder="•••"
                  maxLength={4}
                  required
                />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '0.25rem 0 1.25rem' }} />

            <div className="form-field">
              <label className="field-label">Billing Address Line 1</label>
              <input
                type="text"
                value={form.billingLine1}
                onChange={(e) => field('billingLine1', e.target.value)}
                className="field-input"
                placeholder="123 Main St"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Address Line 2</label>
              <input
                type="text"
                value={form.billingLine2}
                onChange={(e) => field('billingLine2', e.target.value)}
                className="field-input"
                placeholder="Apt 4B"
              />
            </div>

            <div className="form-field-row" style={{ gridTemplateColumns: '1fr 4rem 6rem' }}>
              <div>
                <label className="field-label">City</label>
                <input
                  type="text"
                  value={form.billingCity}
                  onChange={(e) => field('billingCity', e.target.value)}
                  className="field-input"
                  placeholder="New York"
                />
              </div>
              <div>
                <label className="field-label">State</label>
                <input
                  type="text"
                  value={form.billingState}
                  onChange={(e) => field('billingState', e.target.value)}
                  className="field-input"
                  placeholder="NY"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="field-label">ZIP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.billingZip}
                  onChange={(e) => field('billingZip', e.target.value)}
                  className="field-input"
                  placeholder="10001"
                  maxLength={10}
                />
              </div>
            </div>

            {error && (
              <p
                style={{
                  color: 'rgba(255,100,100,0.9)',
                  fontSize: '0.875rem',
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}
          </div>

          <div className="modal__footer" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.4, alignSelf: 'center', whiteSpace: 'nowrap' }}>
              Card details encrypted via 1Password.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} className="btn btn-cancel">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-green"
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                {saving ? 'Saving...' : 'Add Card'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Passport modal ────────────────────────────────────────────────────────

function AddPassportModal({
  clientId,
  onClose,
  onAdded,
}: {
  clientId: string;
  onClose: () => void;
  onAdded: (passport: ClientPassport) => void;
}) {
  const [form, setForm] = useState({
    givenNames: '',
    surname: '',
    passportNumber: '',
    nationality: '',
    issuingCountry: '',
    placeOfBirth: '',
    dateOfBirth: '',
    issueDate: '',
    expiryDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/passports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add passport.');
        return;
      }
      onAdded(data.passport);
    } catch {
      setError('Failed to add passport.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add Passport</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', opacity: 0.4 }}>All fields required</p>
          </div>
          <button onClick={onClose} className="btn btn-cancel btn--xs">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-field-row">
              <div>
                <label className="field-label field-label--required">Given Names</label>
                <input
                  type="text"
                  value={form.givenNames}
                  onChange={(e) => field('givenNames', e.target.value)}
                  className="field-input"
                  placeholder="Jane Anne"
                  required
                />
              </div>
              <div>
                <label className="field-label field-label--required">Surname</label>
                <input
                  type="text"
                  value={form.surname}
                  onChange={(e) => field('surname', e.target.value)}
                  className="field-input"
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="form-field-row">
              <div>
                <label className="field-label field-label--required">Passport Number</label>
                <input
                  type="text"
                  value={form.passportNumber}
                  onChange={(e) => field('passportNumber', e.target.value.toUpperCase())}
                  className="field-input"
                  placeholder="A12345678"
                  required
                />
              </div>
              <div>
                <label className="field-label field-label--required">Nationality</label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => field('nationality', e.target.value)}
                  className="field-input"
                  placeholder="American"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label className="field-label field-label--required">Issuing Country</label>
              <select
                value={form.issuingCountry}
                onChange={(e) => field('issuingCountry', e.target.value)}
                className="field-input"
                required
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-field-row">
              <div>
                <label className="field-label field-label--required">Issue Date</label>
                <DatePicker
                  selected={toDate(form.issueDate)}
                  onChange={(d: Date | null) => field('issueDate', fromDate(d))}
                  dateFormat="d MMM yyyy"
                  placeholderText="Select date"
                  className="field-input"
                  wrapperClassName="datepicker-wrapper"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
              <div>
                <label className="field-label field-label--required">Expiry Date</label>
                <DatePicker
                  selected={toDate(form.expiryDate)}
                  onChange={(d: Date | null) => field('expiryDate', fromDate(d))}
                  dateFormat="d MMM yyyy"
                  placeholderText="Select date"
                  className="field-input"
                  wrapperClassName="datepicker-wrapper"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
            </div>

            <div className="form-field-row">
              <div>
                <label className="field-label field-label--required">Place of Birth</label>
                <input
                  type="text"
                  value={form.placeOfBirth}
                  onChange={(e) => field('placeOfBirth', e.target.value)}
                  className="field-input"
                  placeholder="New York, USA"
                  required
                />
              </div>
              <div>
                <label className="field-label field-label--required">Date of Birth</label>
                <DatePicker
                  selected={toDate(form.dateOfBirth)}
                  onChange={(d: Date | null) => field('dateOfBirth', fromDate(d))}
                  dateFormat="d MMM yyyy"
                  placeholderText="Select date"
                  className="field-input"
                  wrapperClassName="datepicker-wrapper"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  maxDate={new Date()}
                />
              </div>
            </div>

            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', opacity: 0.4 }}>
              Passport details are encrypted and stored securely in 1Password.
            </p>

            {error && (
              <p style={{ color: 'rgba(255,100,100,0.9)', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
                {error}
              </p>
            )}
          </div>

          <div className="modal__footer">
            <button type="button" onClick={onClose} className="btn btn-cancel">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-green"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Saving...' : 'Add Passport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Loyalty modal ─────────────────────────────────────────────────────────────

function LoyaltyModal({
  clientId,
  entry,
  onClose,
  onSaved,
}: {
  clientId: string;
  entry: ClientLoyalty | null;
  onClose: () => void;
  onSaved: (entry: ClientLoyalty) => void;
}) {
  const [programName, setProgramName] = useState(entry?.programName ?? '');
  const [memberNumber, setMemberNumber] = useState(entry?.memberNumber ?? '');
  const [expiryDate, setExpiryDate] = useState<Date | null>(toDate(entry?.expiryDate ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { programName, memberNumber, expiryDate: fromDate(expiryDate) || null };
      const url = entry
        ? `/api/clients/${clientId}/loyalty/${entry.id}`
        : `/api/clients/${clientId}/loyalty`;
      const method = entry ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save.'); return; }
      onSaved(data.entry);
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{entry ? 'Edit Program' : 'Add Loyalty Program'}</h2>
          <button onClick={onClose} className="btn btn-cancel btn--xs"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-field">
              <label className="field-label field-label--required">Program Name</label>
              <select
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="field-input"
                required
              >
                <option value="">Select a program…</option>
                {LOYALTY_PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label field-label--required">Member Number</label>
              <input
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                className="field-input"
                placeholder="e.g. SZ12345678"
                required
              />
            </div>
            <div className="form-field">
              <label className="field-label">Expiry Date (optional)</label>
              <DatePicker
                selected={expiryDate}
                onChange={(d: Date | null) => setExpiryDate(d)}
                dateFormat="d MMM yyyy"
                placeholderText="Select date"
                className="field-input"
                wrapperClassName="datepicker-wrapper"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                isClearable
              />
            </div>
            {error && <p style={{ color: 'rgba(255,80,80,0.9)', margin: 0, fontSize: '0.875rem' }}>{error}</p>}
          </div>
          <div className="modal__footer">
            <button type="button" onClick={onClose} className="btn btn-cancel">Cancel</button>
            <button type="submit" className="btn btn-green" disabled={saving}>
              {saving ? 'Saving...' : entry ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  // Tab state — driven by ?tab= search param
  const VALID_TABS = ['profile', 'travellers', 'payment', 'portal', 'manage'] as const;
  type TabName = (typeof VALID_TABS)[number];
  const rawTab = searchParams.get('tab');
  const tab: TabName = VALID_TABS.includes(rawTab as TabName) ? (rawTab as TabName) : 'profile';
  const setTab = (t: TabName) => router.replace(`?tab=${t}`, { scroll: false });

  // Portal state
  interface PortalData { id: string; slug: string }
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalCreating, setPortalCreating] = useState(false);
  const [portalLinkSending, setPortalLinkSending] = useState<string | null>(null);
  const [portalLinkSent, setPortalLinkSent] = useState<string | null>(null);
  const [portalLinkError, setPortalLinkError] = useState<string | null>(null);

  // Card state
  const [cards, setCards] = useState<ClientCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Passport state
  const [passports, setPassports] = useState<ClientPassport[]>([]);
  const [passportsLoading, setPassportsLoading] = useState(true);
  const [showAddPassport, setShowAddPassport] = useState(false);
  const [deletingPassportId, setDeletingPassportId] = useState<string | null>(null);
  const [activePassportId, setActivePassportId] = useState<string | null>(null);
  const [revealedPassport, setRevealedPassport] = useState<RevealedPassport | null>(null);
  const [passportPinValue, setPassportPinValue] = useState('');
  const [passportPinError, setPassportPinError] = useState('');
  const [passportPinLoading, setPassportPinLoading] = useState(false);
  const passportPinRef = useRef<HTMLInputElement>(null);
  const [passportSecondsLeft, setPassportSecondsLeft] = useState(REVEAL_SECONDS);
  const passportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Loyalty state
  const [loyalty, setLoyalty] = useState<ClientLoyalty[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [showAddLoyalty, setShowAddLoyalty] = useState(false);
  const [editingLoyalty, setEditingLoyalty] = useState<ClientLoyalty | null>(null);
  const [deletingLoyaltyId, setDeletingLoyaltyId] = useState<string | null>(null);

  // Preferences modal state
  const [showEditPreferences, setShowEditPreferences] = useState(false);
  const [prefsForm, setPrefsForm] = useState({ allergies: '', flightPreferences: '', otherPreferences: '' });
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Notes modal state
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [notesForm, setNotesForm] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Reveal state
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [revealedData, setRevealedData] = useState<RevealedCard | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REVEAL_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (response.ok) {
          const data = await response.json();
          setClient(data.client);
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchClient();
  }, [clientId]);

  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch(`/api/clients/${clientId}/cards`);
        if (res.ok) {
          const data = await res.json();
          setCards(data.cards);
        }
      } catch (error) {
        console.error('Error fetching cards:', error);
      } finally {
        setCardsLoading(false);
      }
    }
    fetchCards();
  }, [clientId]);

  useEffect(() => {
    async function fetchPassports() {
      try {
        const res = await fetch(`/api/clients/${clientId}/passports`);
        if (res.ok) {
          const data = await res.json();
          setPassports(data.passports);
        }
      } catch (error) {
        console.error('Error fetching passports:', error);
      } finally {
        setPassportsLoading(false);
      }
    }
    fetchPassports();
  }, [clientId]);

  useEffect(() => {
    async function fetchPortal() {
      try {
        const res = await fetch(`/api/clients/${clientId}/portal`);
        if (res.ok) {
          const data = await res.json();
          setPortal(data.portal);
        }
      } catch {
        // ignore
      } finally {
        setPortalLoading(false);
      }
    }
    fetchPortal();
  }, [clientId]);

  useEffect(() => {
    async function fetchLoyalty() {
      try {
        const res = await fetch(`/api/clients/${clientId}/loyalty`);
        if (res.ok) {
          const data = await res.json();
          setLoyalty(data.loyalty);
        }
      } catch (error) {
        console.error('Error fetching loyalty programs:', error);
      } finally {
        setLoyaltyLoading(false);
      }
    }
    fetchLoyalty();
  }, [clientId]);

  // Auto-focus PIN input when entering PIN mode
  useEffect(() => {
    if (activeCardId && !revealedData) {
      setTimeout(() => pinInputRef.current?.focus(), 0);
    }
  }, [activeCardId, revealedData]);

  useEffect(() => {
    if (activePassportId && !revealedPassport) {
      setTimeout(() => passportPinRef.current?.focus(), 0);
    }
  }, [activePassportId, revealedPassport]);

  // Countdown timer when passport is revealed
  useEffect(() => {
    if (!revealedPassport) return;
    setPassportSecondsLeft(REVEAL_SECONDS);
    passportTimerRef.current = setInterval(() => {
      setPassportSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(passportTimerRef.current!);
          setRevealedPassport(null);
          setActivePassportId(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (passportTimerRef.current) clearInterval(passportTimerRef.current);
    };
  }, [revealedPassport]);

  // Countdown timer when card is revealed
  useEffect(() => {
    if (!revealedData) return;
    setSecondsLeft(REVEAL_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setRevealedData(null);
          setActiveCardId(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [revealedData]);

  const handleEyeClick = (cardId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeCardId === cardId) {
      // cancel PIN entry or mask revealed card
      setActiveCardId(null);
      setRevealedData(null);
      setPinValue('');
      setPinError('');
    } else {
      // start PIN entry for this card
      setActiveCardId(cardId);
      setRevealedData(null);
      setPinValue('');
      setPinError('');
    }
  };

  const handlePassportEyeClick = (passportId: string) => {
    if (passportTimerRef.current) clearInterval(passportTimerRef.current);
    if (activePassportId === passportId) {
      setActivePassportId(null);
      setRevealedPassport(null);
      setPassportPinValue('');
      setPassportPinError('');
    } else {
      setActivePassportId(passportId);
      setRevealedPassport(null);
      setPassportPinValue('');
      setPassportPinError('');
    }
  };

  const handlePassportRevealSubmit = async (passportId: string, pinToUse?: string) => {
    const pin = pinToUse ?? passportPinRef.current?.value ?? passportPinValue;
    setPassportPinError('');
    setPassportPinLoading(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/passports/${passportId}/reveal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 423) {
          const until = data.lockedUntil
            ? new Date(data.lockedUntil).toLocaleTimeString()
            : 'shortly';
          setPassportPinError(`Account locked. Try again after ${until}.`);
        } else if (data.pinNotSet) {
          setPassportPinError('No reveal PIN set. Go to Settings → Reveal PIN to set one.');
        } else if (data.attemptsRemaining !== undefined) {
          setPassportPinError(
            `Incorrect PIN. ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining.`,
          );
        } else {
          setPassportPinError(data.error || 'Failed to reveal passport.');
        }
        setPassportPinValue('');
        return;
      }
      setRevealedPassport(data);
      setPassportPinValue('');
    } catch {
      setPassportPinError('Failed to reveal passport.');
    } finally {
      setPassportPinLoading(false);
    }
  };

  const handleDeletePassport = async (passportId: string) => {
    if (!confirm('Delete this passport? It will be removed from 1Password too.')) return;
    setDeletingPassportId(passportId);
    if (activePassportId === passportId) {
      if (passportTimerRef.current) clearInterval(passportTimerRef.current);
      setActivePassportId(null);
      setRevealedPassport(null);
      setPassportPinValue('');
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/passports/${passportId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete passport');
      }
      setPassports((prev) => prev.filter((p) => p.id !== passportId));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete passport.');
    } finally {
      setDeletingPassportId(null);
    }
  };

  const handleRevealSubmit = async (cardId: string, pinToUse?: string) => {
    const pin = pinToUse ?? pinInputRef.current?.value ?? pinValue;
    setPinError('');
    setPinLoading(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/cards/${cardId}/reveal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 423) {
          const until = data.lockedUntil
            ? new Date(data.lockedUntil).toLocaleTimeString()
            : 'shortly';
          setPinError(`Account locked. Try again after ${until}.`);
        } else if (data.pinNotSet) {
          setPinError(
            'No reveal PIN set. Go to Settings → Reveal PIN to set one.',
          );
        } else if (data.attemptsRemaining !== undefined) {
          setPinError(
            `Incorrect PIN. ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining.`,
          );
        } else {
          setPinError(data.error || 'Failed to reveal card.');
        }
        setPinValue('');
        return;
      }
      setRevealedData(data);
      setPinValue('');
    } catch {
      setPinError('Failed to reveal card.');
    } finally {
      setPinLoading(false);
    }
  };

  const openInfoModal = () => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName,
      middleName: client.middleName || '',
      lastName: client.lastName,
      dateOfBirth: client.dateOfBirth || '',
      weddingAnniversary: client.weddingAnniversary || '',
      email: client.email || '',
      phone: client.phone || '',
      addressLine1: client.addressLine1 || '',
      addressLine2: client.addressLine2 || '',
      city: client.city || '',
      state: client.state || '',
      zip: client.zip || '',
      country: client.country || 'United States',
    });
    setShowEditInfo(true);
  };

  const handleSave = async () => {
    if (!client || !editForm.firstName?.trim() || !editForm.lastName?.trim())
      return;
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
      setShowEditInfo(false);
      setEditForm({});
    } catch (error) {
      console.error('Error saving client:', error);
      alert(error instanceof Error ? error.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const openPrefsModal = () => {
    if (!client) return;
    setPrefsForm({
      allergies: client.allergies || '',
      flightPreferences: client.flightPreferences || '',
      otherPreferences: client.otherPreferences || '',
    });
    setShowEditPreferences(true);
  };

  const savePrefs = async () => {
    setPrefsSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefsForm),
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setShowEditPreferences(false);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setPrefsSaving(false);
    }
  };

  const openNotesModal = () => {
    if (!client) return;
    setNotesForm(client.notes || '');
    setShowEditNotes(true);
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesForm }),
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setShowEditNotes(false);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCreatePortal = async () => {
    setPortalCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPortal(data.portal);
      }
    } catch {
      // ignore
    } finally {
      setPortalCreating(false);
    }
  };

  const handleSendPortalLink = async (flavour: 'general' | 'request_card' | 'request_passport') => {
    setPortalLinkSending(flavour);
    setPortalLinkSent(null);
    setPortalLinkError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal/send-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flavour }),
      });
      if (res.ok) {
        setPortalLinkSent(client?.email ?? 'client');
      } else {
        const data = await res.json();
        setPortalLinkError(data.error ?? 'Failed to send link');
      }
    } catch {
      setPortalLinkError('Failed to send link');
    } finally {
      setPortalLinkSending(null);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete ${client?.firstName} ${client?.lastName}? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      router.push('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to delete client.',
      );
      setDeleting(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Delete this card? It will be removed from 1Password too.'))
      return;
    setDeletingCardId(cardId);
    if (activeCardId === cardId) {
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveCardId(null);
      setRevealedData(null);
      setPinValue('');
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/cards/${cardId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete card');
      }
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete card.');
    } finally {
      setDeletingCardId(null);
    }
  };

  const fieldChange = (field: keyof Client, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const displayValue = (val: string | null | undefined, fallback = '—') =>
    val || fallback;

  const canSave =
    !saving && !!editForm.firstName?.trim() && !!editForm.lastName?.trim();

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
          <Link href="/clients" className="back-link">
            ← Back to Clients
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <SojournsHeader />
      <main className="page-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Link href="/clients" className="back-link" style={{ marginBottom: 0 }}>
            ← Back to Clients
          </Link>
          <span style={{ opacity: 0.3, fontSize: '0.8rem' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{formatUpdated(client.updatedAt)}</span>
        </div>

        <div className="client-detail-header">
          <div className="client-avatar client-avatar--lg">
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div className="client-detail-identity">
            <h1 className="client-detail-name">
              {client.firstName} {client.lastName}
            </h1>
            <div className="client-detail-meta">
              {client.email && <span><Mail size={14} /> {client.email}</span>}
              {client.phone && <span><Phone size={14} /> {formatPhone(client.phone)}</span>}
            </div>
          </div>
        </div>

        {/* Tabs — full width */}
        <div className="client-tabs">
          <button
            className={`client-tab${tab === 'profile' ? ' client-tab--active' : ''}`}
            onClick={() => setTab('profile')}
          >
            Client Profile
          </button>
          <button
            className={`client-tab${tab === 'travellers' ? ' client-tab--active' : ''}`}
            onClick={() => setTab('travellers')}
          >
            Traveller Profiles
          </button>
          <button
            className={`client-tab${tab === 'payment' ? ' client-tab--active' : ''}`}
            onClick={() => setTab('payment')}
          >
            Payment Details
          </button>
          <button
            className={`client-tab${tab === 'portal' ? ' client-tab--active' : ''}`}
            onClick={() => setTab('portal')}
          >
            Portal
          </button>
          <button
            className={`client-tab${tab === 'manage' ? ' client-tab--active' : ''}`}
            onClick={() => setTab('manage')}
          >
            Manage
          </button>
        </div>

        <div className={`client-layout${tab === 'profile' ? '' : ' client-layout--full'}`}>
        <div className="client-layout__main">

        {/* Main Profile tab */}
        {tab === 'profile' && (<>
        <div className="simple-card client-detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Basic Information</h2>
            <button onClick={openInfoModal} className="file-action-btn edit">
              <Edit size={15} /> Edit
            </button>
          </div>

          {/* Row 1: Name */}
          <div className="client-detail-card__row">
            <div>
              <div className="field-meta-label">First Name</div>
              <div className="field-value">{client.firstName}</div>
            </div>
            <div>
              <div className="field-meta-label">Middle Name</div>
              <div className="field-value">{displayValue(client.middleName)}</div>
            </div>
            <div>
              <div className="field-meta-label">Last Name</div>
              <div className="field-value">{client.lastName}</div>
            </div>
          </div>

          {/* Row 2: Email + Phone */}
          <div className="client-detail-card__row">
            <div>
              <div className="field-meta-label">Email</div>
              <div className="field-value">{displayValue(client.email)}</div>
            </div>
            <div>
              <div className="field-meta-label">Phone</div>
              <div className="field-value">{client.phone ? formatPhone(client.phone) : '—'}</div>
            </div>
          </div>

          {/* Row 3: Date of Birth + Age + Wedding Anniversary */}
          <div className="client-detail-card__row">
            <div>
              <div className="field-meta-label">Date of Birth</div>
              <div className="field-value">{formatDOB(client.dateOfBirth)}</div>
            </div>
            <div>
              <div className="field-meta-label">Age</div>
              <div className="field-value">{calcAge(client.dateOfBirth)}</div>
            </div>
            <div>
              <div className="field-meta-label">Wedding Anniversary</div>
              <div className="field-value">{formatDOB(client.weddingAnniversary)}</div>
            </div>
          </div>

          {/* Row 4: Address */}
          <div>
            <div className="field-meta-label">Address</div>
            <div className="field-value">
              {[
                client.addressLine1,
                client.addressLine2,
                client.city,
                client.state,
                client.zip,
                client.country,
              ].filter(Boolean).join(', ') || '—'}
            </div>
          </div>
        </div>

        {/* Preferences card */}
        <div className="simple-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Preferences</h2>
            <button onClick={openPrefsModal} className="file-action-btn edit">
              <Edit size={15} /> Edit
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div className="field-meta-label">Allergies & Dietary Restrictions</div>
              <div className="field-value">{displayValue(client.allergies)}</div>
            </div>
            <div>
              <div className="field-meta-label">Flight Preferences</div>
              <div className="field-value">{displayValue(client.flightPreferences)}</div>
            </div>
            <div>
              <div className="field-meta-label">Other Preferences</div>
              <div className="field-value">{displayValue(client.otherPreferences)}</div>
            </div>
          </div>
        </div>

        {/* Notes card */}
        <div className="simple-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Notes</h2>
            <button onClick={openNotesModal} className="file-action-btn edit">
              <Edit size={15} /> Edit
            </button>
          </div>
          <div className="field-value" style={{ whiteSpace: 'pre-wrap' }}>{displayValue(client.notes)}</div>
        </div>

        </>)}

        {/* Traveller Profiles tab */}
        {tab === 'travellers' && (
          <div className="simple-card" style={{ padding: '2rem' }}>
            <h2 className="section-title">Traveller Profiles</h2>
            <p style={{ opacity: 0.4, fontSize: '0.9rem', margin: 0 }}>Coming soon — spouse, children, and companion profiles.</p>
          </div>
        )}

        {/* Payment Info tab */}
        {tab === 'payment' && (
        <div className="payment-tab-grid">
        <div className="simple-card cards-section">
          <div className="cards-section__header">
            <h2 className="section-title" style={{ gridColumn: 'unset', margin: 0 }}>Credit Cards</h2>
            <button
              onClick={() => setShowAddCard(true)}
              className="file-action-btn edit"
            >
              <PlusCircle size={16} /> Add Card
            </button>
          </div>

          {cardsLoading ? (
            <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>Loading cards...</p>
          ) : cards.length === 0 ? (
            <div className="card-list">
              <div className="card-row">
                <span style={{ opacity: 0.4, fontSize: '0.875rem' }}>
                  No credit cards stored for this client yet.
                </span>
              </div>
            </div>
          ) : (
            <div className="card-list">
              {cards.map((card) => {
                const isActive = activeCardId === card.id;
                const isLoadingReveal = isActive && pinLoading;
                const isEntering = isActive && !revealedData && !pinLoading;
                const isRevealed = isActive && !!revealedData;
                const pct = (secondsLeft / REVEAL_SECONDS) * 100;

                return (
                  <div key={card.id} className="card-row">
                    <div className="card-row__info">
                      {card.cardType && CARD_LOGOS[card.cardType] ? (
                        <img
                          src={CARD_LOGOS[card.cardType]}
                          alt={card.cardType}
                          className="card-row__logo"
                        />
                      ) : (
                        <span className="card-row__label">
                          {card.cardType ?? 'Card'}
                        </span>
                      )}
                      <span className="card-row__label">{card.last4}</span>
                      <span className="card-row__expiry">· {card.expiry}</span>
                    </div>
                    <div className="card-row__actions">
                      {isEntering && (
                        <input
                          ref={pinInputRef}
                          type="password"
                          inputMode="numeric"
                          value={pinValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPinValue(val);
                            if (val.length === 4) {
                              handleRevealSubmit(card.id, val);
                            }
                          }}
                          onKeyDown={(e) =>
                            e.key === 'Escape' && handleEyeClick(card.id)
                          }
                          placeholder="PIN"
                          className="field-input--sm card-pin-input"
                          maxLength={4}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          disabled={pinLoading}
                        />
                      )}
                      <button
                        onClick={() => handleEyeClick(card.id)}
                        className="file-action-btn neutral"
                      >
                        {isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deletingCardId === card.id}
                        className="file-action-btn delete"
                        style={{
                          opacity: deletingCardId === card.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isEntering && pinError && (
                      <p className="card-pin-error">{pinError}</p>
                    )}
                    {isLoadingReveal && (
                      <div className="card-reveal">
                        <div className="reveal-fields">
                          {[
                            { label: 'Cardholder', value: 'Jane Smith', mono: false },
                            { label: 'Card Number', value: '1234 5678 9012 3456', mono: true },
                            { label: 'Expiry', value: '12/2028', mono: true },
                            { label: 'CVV', value: '123', mono: true },
                          ].map(({ label, value, mono }, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <span className="field-meta-label" style={{ opacity: 0 }}>{label}</span>
                              <span className="reveal-value" style={{ opacity: 0, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
                              <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                            </div>
                          ))}
                          {/* Billing Address + ZIP row */}
                          <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'row', gap: '1.5rem' }}>
                            {[
                              { label: 'Billing Address', value: '123 Main St, New York' },
                              { label: 'Billing ZIP', value: '10001' },
                            ].map(({ label, value }, i) => (
                              <div key={i} style={{ position: 'relative' }}>
                                <span className="field-meta-label" style={{ opacity: 0 }}>{label}</span>
                                <span className="reveal-value" style={{ opacity: 0, fontFamily: 'monospace' }}>{value}</span>
                                <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="reveal-timer" style={{ marginTop: '0.5rem' }}>
                          <div className="shimmer-bar reveal-timer__bar" style={{ width: '100%', transition: 'none' }} />
                        </div>
                      </div>
                    )}
                    {isRevealed && (
                      <div className="card-reveal">
                        <div className="reveal-fields">
                          <div>
                            <span className="field-meta-label">Cardholder</span>
                            <span className="reveal-value">
                              {revealedData!.cardholderName}
                            </span>
                          </div>
                          <div>
                            <span className="field-meta-label">Card Number</span>
                            <span
                              className="reveal-value"
                              style={{ fontFamily: 'monospace' }}
                            >
                              {formatCardNumber(revealedData!.cardNumber)}
                            </span>
                          </div>
                          <div>
                            <span className="field-meta-label">Expiry</span>
                            <span
                              className="reveal-value"
                              style={{ fontFamily: 'monospace' }}
                            >
                              {revealedData!.expiry}
                            </span>
                          </div>
                          <div>
                            <span className="field-meta-label">CVV</span>
                            <span
                              className="reveal-value"
                              style={{ fontFamily: 'monospace' }}
                            >
                              {revealedData!.cvv}
                            </span>
                          </div>
                          {(revealedData!.billingZip || revealedData!.billingAddress) && (
                            <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'row', gap: '1.5rem' }}>
                              {revealedData!.billingAddress && (
                                <div>
                                  <span className="field-meta-label">Billing Address</span>
                                  <span className="reveal-value">{revealedData!.billingAddress}</span>
                                </div>
                              )}
                              {revealedData!.billingZip && (
                                <div>
                                  <span className="field-meta-label">Billing ZIP</span>
                                  <span className="reveal-value" style={{ fontFamily: 'monospace' }}>
                                    {revealedData!.billingZip}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="reveal-timer" style={{ marginTop: '0.5rem' }}>
                          <div
                            className="reveal-timer__bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ margin: '1rem 0 0', fontSize: '0.78rem', opacity: 0.4 }}>
            Card details encrypted via 1Password.{' '}
            <Link
              href="/settings/pin"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              Manage PIN
            </Link>
          </p>

        </div>

        <div className="simple-card" style={{ padding: '2rem' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.5rem' }}>Request Credit Card</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.4 }}>Coming soon.</p>
        </div>

        </div>
        )}

        {/* Portal tab */}
        {tab === 'portal' && (
          <div className="simple-card" style={{ padding: '2rem' }}>
            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Client Portal</h2>

            {portalLoading ? (
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>Loading...</p>
            ) : !portal ? (
              <div>
                <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
                  No portal set up yet. Create one to send magic links to this client.
                </p>
                <button
                  className="btn btn-golden"
                  onClick={handleCreatePortal}
                  disabled={portalCreating}
                  style={{ opacity: portalCreating ? 0.5 : 1 }}
                >
                  {portalCreating ? 'Creating...' : 'Set Up Portal'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="field-meta-label" style={{ marginBottom: '0.25rem' }}>Portal URL</div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/${portal.slug}`}

                    style={{ fontSize: '0.85rem', fontFamily: 'monospace', opacity: 0.7, color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/{portal.slug}
                  </a>
                </div>

                <div className="field-meta-label" style={{ marginBottom: '0.75rem' }}>Send Portal Link</div>
                {!client?.email && (
                  <p style={{ color: 'rgba(255,180,50,0.9)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    No email address on file — add one to the client profile first.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxWidth: '320px' }}>
                  <button
                    className="btn btn-golden"
                    disabled={!client?.email || portalLinkSending !== null}
                    onClick={() => handleSendPortalLink('general')}
                    style={{ opacity: (!client?.email || portalLinkSending !== null) ? 0.4 : 1, justifyContent: 'flex-start' }}
                  >
                    {portalLinkSending === 'general' ? 'Sending...' : 'Send General Update Link'}
                  </button>
                  <button
                    className="btn btn-golden"
                    disabled={!client?.email || portalLinkSending !== null}
                    onClick={() => handleSendPortalLink('request_card')}
                    style={{ opacity: (!client?.email || portalLinkSending !== null) ? 0.4 : 1, justifyContent: 'flex-start' }}
                  >
                    {portalLinkSending === 'request_card' ? 'Sending...' : 'Request Credit Card'}
                  </button>
                  <button
                    className="btn btn-golden"
                    disabled={!client?.email || portalLinkSending !== null}
                    onClick={() => handleSendPortalLink('request_passport')}
                    style={{ opacity: (!client?.email || portalLinkSending !== null) ? 0.4 : 1, justifyContent: 'flex-start' }}
                  >
                    {portalLinkSending === 'request_passport' ? 'Sending...' : 'Request Passport'}
                  </button>
                </div>

                {portalLinkSent && (
                  <p style={{ marginTop: '1rem', color: 'rgba(100,220,100,0.9)', fontSize: '0.875rem' }}>
                    Link sent to {portalLinkSent}
                  </p>
                )}
                {portalLinkError && (
                  <p style={{ marginTop: '1rem', color: 'rgba(255,80,80,0.9)', fontSize: '0.875rem' }}>
                    {portalLinkError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage tab */}
        {tab === 'manage' && (
          <div className="simple-card" style={{ padding: '2rem' }}>
            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Manage Client</h2>
            <div>
              <div className="field-meta-label" style={{ marginBottom: '0.5rem' }}>Danger Zone</div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger"
                style={{ opacity: deleting ? 0.5 : 1 }}
              >
                <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Make Client Inactive'}
              </button>
            </div>
          </div>
        )}

        </div>{/* end client-layout__main */}

        {tab === 'profile' && (
          <div className="client-layout__sidebar">
            <div className="simple-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: passports.length > 0 ? '1rem' : 0 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Passports</h2>
                {!passportsLoading && (
                  <button onClick={() => setShowAddPassport(true)} className="file-action-btn edit">
                    <PlusCircle size={15} /> Add
                  </button>
                )}
              </div>
              {passportsLoading ? (
                <p style={{ opacity: 0.5, fontSize: '0.875rem', margin: 0 }}>Loading...</p>
              ) : passports.length === 0 ? (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', margin: 0 }}>No passports added.</p>
              ) : (
                <>
                <div className="passport-list">
                  {passports.map((passport) => {
                    const status = passportExpiryStatus(passport.expiryDate);
                    const isActive = activePassportId === passport.id;
                    const isLoadingReveal = isActive && passportPinLoading;
                    const isEntering = isActive && !revealedPassport && !passportPinLoading;
                    const isRevealed = isActive && !!revealedPassport;
                    const pct = (passportSecondsLeft / REVEAL_SECONDS) * 100;
                    const statusColor =
                      status === 'expired'
                        ? 'rgba(255,80,80,0.9)'
                        : status === 'soon'
                          ? 'rgba(255,180,50,0.9)'
                          : 'rgba(100,220,100,0.8)';

                    return (
                      <div key={passport.id} className="passport-row">
                        <div className="passport-row__info">
                          {passport.issuingCountry && COUNTRY_FLAG_CODE[passport.issuingCountry] && (
                            <span className={`fi fi-${COUNTRY_FLAG_CODE[passport.issuingCountry]} passport-row__flag`} />
                          )}
                          <div className="passport-row__text">
                            <span className="passport-row__nationality">{formatIssuingAuthority(passport.issuingCountry)}</span>
                            <span className="passport-row__expiry" style={status !== 'ok' ? { color: statusColor } : undefined}>
                              {formatPassportDate(passport.expiryDate)}
                            </span>
                          </div>
                        </div>
                        <div className="passport-row__actions">
                          {isEntering && (
                            <input
                              ref={passportPinRef}
                              type="password"
                              inputMode="numeric"
                              value={passportPinValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassportPinValue(val);
                                if (val.length === 4) {
                                  handlePassportRevealSubmit(passport.id, val);
                                }
                              }}
                              onKeyDown={(e) => e.key === 'Escape' && handlePassportEyeClick(passport.id)}
                              placeholder="PIN"
                              className="field-input--sm card-pin-input"
                              maxLength={4}
                              autoComplete="off"
                              data-1p-ignore
                              data-lpignore="true"
                              data-bwignore="true"
                              data-form-type="other"
                              disabled={passportPinLoading}
                            />
                          )}
                          <button
                            onClick={() => handlePassportEyeClick(passport.id)}
                            className="file-action-btn neutral"
                          >
                            {isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => handleDeletePassport(passport.id)}
                            disabled={deletingPassportId === passport.id}
                            className="file-action-btn delete"
                            style={{ opacity: deletingPassportId === passport.id ? 0.5 : 1 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {isEntering && passportPinError && (
                          <p className="card-pin-error">{passportPinError}</p>
                        )}
                        {isLoadingReveal && (
                          <div className="card-reveal">
                            <div className="reveal-fields">
                              {/* Row 1: Full Name */}
                              <div style={{ position: 'relative', width: '100%' }}>
                                <span className="field-meta-label" style={{ opacity: 0 }}>Full Name</span>
                                <span className="reveal-value" style={{ opacity: 0 }}>Callum Merriman</span>
                                <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                              </div>
                              {/* Row 2: Passport No. + Nationality */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                {[{ label: 'Passport No.', value: 'A12345678' }, { label: 'Nationality', value: 'American' }].map(({ label, value }, i) => (
                                  <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span className="field-meta-label" style={{ opacity: 0 }}>{label}</span>
                                    <span className="reveal-value" style={{ opacity: 0 }}>{value}</span>
                                    <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                                  </div>
                                ))}
                              </div>
                              {/* Row 3: Place of Birth + Date of Birth */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                {[{ label: 'Place of Birth', value: 'New York, USA' }, { label: 'Date of Birth', value: '1 Jan 1980' }].map(({ label, value }, i) => (
                                  <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span className="field-meta-label" style={{ opacity: 0 }}>{label}</span>
                                    <span className="reveal-value" style={{ opacity: 0 }}>{value}</span>
                                    <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                                  </div>
                                ))}
                              </div>
                              {/* Row 4: Issue Date + Expiry Date */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                {[{ label: 'Issue Date', value: '1 Jan 2020' }, { label: 'Expiry Date', value: '1 Jan 2030' }].map(({ label, value }, i) => (
                                  <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span className="field-meta-label" style={{ opacity: 0 }}>{label}</span>
                                    <span className="reveal-value" style={{ opacity: 0 }}>{value}</span>
                                    <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                                  </div>
                                ))}
                              </div>
                              {/* Row 5: Issuing Authority */}
                              <div style={{ position: 'relative', width: '100%' }}>
                                <span className="field-meta-label" style={{ opacity: 0 }}>Issuing Authority</span>
                                <span className="reveal-value" style={{ opacity: 0 }}>United States Department of State</span>
                                <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
                              </div>
                            </div>
                            <div className="reveal-timer" style={{ marginTop: '0.5rem' }}>
                              <div className="shimmer-bar reveal-timer__bar" style={{ width: '100%', transition: 'none' }} />
                            </div>
                          </div>
                        )}
                        {isRevealed && (
                          <div className="card-reveal">
                            <div className="reveal-fields">
                              {/* Row 1: Full Name */}
                              <div style={{ width: '100%' }}>
                                <span className="field-meta-label">Full Name</span>
                                <span className="reveal-value">{revealedPassport!.givenNames} {revealedPassport!.surname}</span>
                              </div>
                              {/* Row 2: Passport No. + Nationality */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Passport No.</span>
                                  <span className="reveal-value" style={{ fontFamily: 'monospace' }}>{revealedPassport!.passportNumber}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Nationality</span>
                                  <span className="reveal-value">{revealedPassport!.nationality}</span>
                                </div>
                              </div>
                              {/* Row 3: Place of Birth + Date of Birth */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Place of Birth</span>
                                  <span className="reveal-value">{revealedPassport!.placeOfBirth}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Date of Birth</span>
                                  <span className="reveal-value">{formatPassportDate(revealedPassport!.dateOfBirth)}</span>
                                </div>
                              </div>
                              {/* Row 4: Issue Date + Expiry Date */}
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Issue Date</span>
                                  <span className="reveal-value">{formatPassportDate(revealedPassport!.issueDate)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span className="field-meta-label">Expiry Date</span>
                                  <span className="reveal-value">{formatPassportDate(revealedPassport!.expiryDate)}</span>
                                </div>
                              </div>
                              {/* Row 5: Issuing Authority */}
                              <div style={{ width: '100%' }}>
                                <span className="field-meta-label">Issuing Country</span>
                                <span className="reveal-value">{revealedPassport!.issuingCountry}</span>
                              </div>
                            </div>
                            <div className="reveal-timer" style={{ marginTop: '0.5rem' }}>
                              <div className="reveal-timer__bar" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', opacity: 0.4 }}>
                  Passport details are encrypted via 1Password.{' '}
                  <Link href="/settings/pin" style={{ color: 'inherit', textDecoration: 'underline' }}>Manage PIN</Link>
                </p>
                </>
              )}
            </div>
            <div className="simple-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: loyalty.length > 0 ? '1rem' : 0 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Loyalty Programs</h2>
                {!loyaltyLoading && (
                  <button onClick={() => setShowAddLoyalty(true)} className="file-action-btn edit">
                    <PlusCircle size={15} /> Add
                  </button>
                )}
              </div>
              {loyaltyLoading ? (
                <p style={{ opacity: 0.5, fontSize: '0.875rem', margin: 0 }}>Loading...</p>
              ) : loyalty.length === 0 ? (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', margin: 0 }}>No programs added.</p>
              ) : (
                <div className="loyalty-list">
                  {loyalty.map((entry) => {
                    const status = entry.expiryDate ? passportExpiryStatus(entry.expiryDate) : null;
                    const statusColor =
                      status === 'expired'
                        ? 'rgba(255,80,80,0.9)'
                        : status === 'soon'
                          ? 'rgba(255,180,50,0.9)'
                          : 'rgba(100,220,100,0.8)';
                    return (
                      <div key={entry.id} className="loyalty-row">
                        <div className="loyalty-row__info">
                          <span className="loyalty-row__name">{entry.programName}</span>
                          <span className="loyalty-row__number">
                            {entry.memberNumber}
                            {entry.expiryDate && (
                              <span className="loyalty-row__expiry" style={status !== 'ok' ? { color: statusColor } : undefined}>
                                {formatPassportDate(entry.expiryDate)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="loyalty-row__actions">
                          <button
                            className="file-action-btn neutral"
                            onClick={() => setEditingLoyalty(entry)}
                            title="Edit"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            className="file-action-btn delete"
                            onClick={async () => {
                              if (deletingLoyaltyId === entry.id) {
                                try {
                                  const res = await fetch(`/api/clients/${clientId}/loyalty/${entry.id}`, { method: 'DELETE' });
                                  if (res.ok) setLoyalty((prev) => prev.filter((e) => e.id !== entry.id));
                                } finally {
                                  setDeletingLoyaltyId(null);
                                }
                              } else {
                                setDeletingLoyaltyId(entry.id);
                              }
                            }}
                            title={deletingLoyaltyId === entry.id ? 'Confirm delete' : 'Delete'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        </div>{/* end client-layout */}

        {showAddCard && (
          <AddCardModal
            clientId={clientId}
            onClose={() => setShowAddCard(false)}
            onAdded={(card) => {
              setCards((prev) => [...prev, card]);
              setShowAddCard(false);
            }}
          />
        )}
        {showAddPassport && (
          <AddPassportModal
            clientId={clientId}
            onClose={() => setShowAddPassport(false)}
            onAdded={(passport) => {
              setPassports((prev) => [...prev, passport]);
              setShowAddPassport(false);
            }}
          />
        )}
        {(showAddLoyalty || editingLoyalty) && (
          <LoyaltyModal
            clientId={clientId}
            entry={editingLoyalty}
            onClose={() => { setShowAddLoyalty(false); setEditingLoyalty(null); }}
            onSaved={(entry) => {
              if (editingLoyalty) {
                setLoyalty((prev) => prev.map((e) => e.id === entry.id ? entry : e));
              } else {
                setLoyalty((prev) => [...prev, entry]);
              }
              setShowAddLoyalty(false);
              setEditingLoyalty(null);
            }}
          />
        )}
        {showEditInfo && (
          <div className="modal-overlay" onClick={() => setShowEditInfo(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal__header">
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Basic Information</h2>
                <button onClick={() => setShowEditInfo(false)} className="btn btn-cancel btn--xs">
                  <X size={15} />
                </button>
              </div>
              <div className="modal__body">
                <div className="form-field">
                  <label className="field-label">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName || ''}
                    onChange={(e) => fieldChange('firstName', e.target.value)}
                    className="field-input"
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middleName || ''}
                    onChange={(e) => fieldChange('middleName', e.target.value)}
                    className="field-input"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName || ''}
                    onChange={(e) => fieldChange('lastName', e.target.value)}
                    className="field-input"
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Date of Birth</label>
                  <DatePicker
                    selected={toDate(editForm.dateOfBirth || '')}
                    onChange={(d: Date | null) => fieldChange('dateOfBirth', fromDate(d))}
                    dateFormat="yyyy-MM-dd"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    maxDate={new Date()}
                    placeholderText="YYYY-MM-DD"
                    className="field-input"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Wedding Anniversary</label>
                  <DatePicker
                    selected={toDate(editForm.weddingAnniversary || '')}
                    onChange={(d: Date | null) => fieldChange('weddingAnniversary', fromDate(d))}
                    dateFormat="yyyy-MM-dd"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    placeholderText="YYYY-MM-DD"
                    className="field-input"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => fieldChange('email', e.target.value)}
                    className="field-input"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Phone</label>
                  <div className="phone-input--sm">
                    <PhoneInput
                      value={editForm.phone || ''}
                      onChange={(v) => fieldChange('phone', v ?? '')}
                      defaultCountry="US"
                    />
                  </div>
                </div>
                <div className="form-field">
                  <AddressFields
                    value={{
                      addressLine1: editForm.addressLine1 || '',
                      addressLine2: editForm.addressLine2 || '',
                      city: editForm.city || '',
                      state: editForm.state || '',
                      zip: editForm.zip || '',
                      country: editForm.country || '',
                    }}
                    onChange={(field, value) => fieldChange(field, value)}
                    inputClassName="field-input"
                    selectClassName="field-input"
                  />
                </div>
              </div>
              <div className="modal__footer">
                <button onClick={() => setShowEditInfo(false)} className="btn btn-cancel">Cancel</button>
                <button onClick={handleSave} disabled={!canSave} className="btn btn-green">
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showEditPreferences && (
          <div className="modal-overlay" onClick={() => setShowEditPreferences(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal__header">
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Preferences</h2>
                <button onClick={() => setShowEditPreferences(false)} className="btn btn-cancel btn--xs">
                  <X size={15} />
                </button>
              </div>
              <div className="modal__body">
                <div className="form-field">
                  <label className="field-label">Allergies & Dietary Restrictions</label>
                  <textarea
                    className="field-textarea"
                    value={prefsForm.allergies}
                    onChange={(e) => setPrefsForm((p) => ({ ...p, allergies: e.target.value }))}
                    placeholder="e.g. Gluten-free, nut allergy, vegan..."
                    rows={3}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Flight Preferences</label>
                  <textarea
                    className="field-textarea"
                    value={prefsForm.flightPreferences}
                    onChange={(e) => setPrefsForm((p) => ({ ...p, flightPreferences: e.target.value }))}
                    placeholder="e.g. Window seat, business class, aisle preferred..."
                    rows={3}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Other Preferences</label>
                  <textarea
                    className="field-textarea"
                    value={prefsForm.otherPreferences}
                    onChange={(e) => setPrefsForm((p) => ({ ...p, otherPreferences: e.target.value }))}
                    placeholder="e.g. Boutique hotels, late check-out, twin beds..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal__footer">
                <button onClick={() => setShowEditPreferences(false)} className="btn btn-cancel">Cancel</button>
                <button onClick={savePrefs} disabled={prefsSaving} className="btn btn-green">
                  {prefsSaving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showEditNotes && (
          <div className="modal-overlay" onClick={() => setShowEditNotes(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal__header">
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Notes</h2>
                <button onClick={() => setShowEditNotes(false)} className="btn btn-cancel btn--xs">
                  <X size={15} />
                </button>
              </div>
              <div className="modal__body">
                <div className="form-field">
                  <label className="field-label">Internal Notes</label>
                  <textarea
                    className="field-textarea"
                    value={notesForm}
                    onChange={(e) => setNotesForm(e.target.value)}
                    placeholder="Internal notes about this client..."
                    rows={6}
                  />
                </div>
              </div>
              <div className="modal__footer">
                <button onClick={() => setShowEditNotes(false)} className="btn btn-cancel">Cancel</button>
                <button onClick={saveNotes} disabled={notesSaving} className="btn btn-green">
                  {notesSaving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
