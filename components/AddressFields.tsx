'use client';
import { US_STATES, COUNTRIES } from '@/lib/address-data';

export interface AddressData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Props {
  value: AddressData;
  onChange: (field: keyof AddressData, value: string) => void;
  inputClassName?: string;
  selectClassName?: string;
}

export default function AddressFields({ value, onChange, inputClassName = 'field-input', selectClassName = 'field-input' }: Props) {
  const isUS = value.country === 'United States' || value.country === '' || value.country === null;

  return (
    <>
      <div className="form-field">
        <label className="field-label">Address Line 1</label>
        <input
          className={inputClassName}
          value={value.addressLine1}
          onChange={(e) => onChange('addressLine1', e.target.value)}
          placeholder="123 Main St"
        />
      </div>

      <div className="form-field">
        <label className="field-label">Address Line 2</label>
        <input
          className={inputClassName}
          value={value.addressLine2}
          onChange={(e) => onChange('addressLine2', e.target.value)}
          placeholder="Apt, suite, unit (optional)"
        />
      </div>

      <div className="form-field-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div>
          <label className="field-label">City</label>
          <input
            className={inputClassName}
            value={value.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="City"
          />
        </div>
        <div>
          <label className="field-label">State / Province</label>
          {isUS ? (
            <select
              className={selectClassName}
              value={value.state}
              onChange={(e) => onChange('state', e.target.value)}
            >
              <option value="">Select state</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          ) : (
            <input
              className={inputClassName}
              value={value.state}
              onChange={(e) => onChange('state', e.target.value)}
              placeholder="State / Province / Region"
            />
          )}
        </div>
      </div>

      <div className="form-field-row">
        <div>
          <label className="field-label">ZIP / Postcode</label>
          <input
            className={inputClassName}
            value={value.zip}
            onChange={(e) => onChange('zip', e.target.value)}
            placeholder="10001"
          />
        </div>
        <div>
          <label className="field-label">Country</label>
          <select
            className={selectClassName}
            value={value.country || 'United States'}
            onChange={(e) => {
              onChange('country', e.target.value);
              // Clear state when switching away from US
              if (e.target.value !== 'United States') onChange('state', '');
            }}
          >
            <option value="United States">United States</option>
            {COUNTRIES.filter((c) => c !== 'United States').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
