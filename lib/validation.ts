/**
 * Phone number validation utilities
 * Supports international phone numbers with country codes
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * Validates and formats a phone number to international format
 * @param phoneNumber - The phone number to validate
 * @param countryContext - Optional country code context for numbers without country codes
 * @returns Validation result with formatted number if valid
 */
export function validatePhoneNumber(
  phoneNumber: string,
  countryContext?: string,
): PhoneValidationResult {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      error: 'Phone number is required',
    };
  }

  // Remove all whitespace and non-digit characters except + and -
  const cleaned = phoneNumber.replace(/[^\d+\-]/g, '');

  // Check if already in international format (starts with +)
  if (cleaned.startsWith('+')) {
    const formatted = formatInternationalNumber(cleaned);
    return {
      isValid: validateInternationalFormat(formatted),
      formatted: formatted,
      error: validateInternationalFormat(formatted)
        ? undefined
        : 'Invalid international phone number format',
    };
  }

  // Try to add country code based on context
  if (countryContext) {
    const countryCode = getCountryCode(countryContext);
    if (countryCode) {
      const withCountryCode = `+${countryCode}${cleaned}`;
      const formatted = formatInternationalNumber(withCountryCode);
      return {
        isValid: validateInternationalFormat(formatted),
        formatted: formatted,
        error: validateInternationalFormat(formatted)
          ? undefined
          : 'Invalid phone number format with country code',
      };
    }
  }

  return {
    isValid: false,
    error:
      'Phone number must include international country code (e.g., +1, +44, +39)',
  };
}

/**
 * Formats a phone number to international format with consistent separators
 * Format: +[country code]-[area/city code]-[number]
 */
function formatInternationalNumber(phoneNumber: string): string {
  // Remove existing formatting
  const digits = phoneNumber.replace(/[^\d+]/g, '');

  if (!digits.startsWith('+')) {
    return phoneNumber;
  }

  // Extract country code (1-4 digits after +)
  const countryCodeMatch = digits.match(/^\+(\d{1,4})/);
  if (!countryCodeMatch) {
    return phoneNumber;
  }

  const countryCode = countryCodeMatch[1];
  const remaining = digits.slice(countryCode.length + 1);

  // Format based on common patterns
  if (countryCode === '1') {
    // North America: +1-XXX-XXX-XXXX
    if (remaining.length === 10) {
      return `+1-${remaining.slice(0, 3)}-${remaining.slice(3, 6)}-${remaining.slice(6)}`;
    }
  } else if (countryCode === '44') {
    // UK: +44-XX-XXXX-XXXX or +44-XXX-XXX-XXXX
    if (remaining.length >= 10) {
      if (remaining.startsWith('20') || remaining.startsWith('28')) {
        // London/Belfast: +44-XX-XXXX-XXXX
        return `+44-${remaining.slice(0, 2)}-${remaining.slice(2, 6)}-${remaining.slice(6)}`;
      } else {
        // Other UK: +44-XXX-XXX-XXXX
        return `+44-${remaining.slice(0, 3)}-${remaining.slice(3, 6)}-${remaining.slice(6)}`;
      }
    }
  } else if (countryCode === '39') {
    // Italy: +39-XX-XXXX-XXXX
    if (remaining.length >= 9) {
      return `+39-${remaining.slice(0, 2)}-${remaining.slice(2, 6)}-${remaining.slice(6)}`;
    }
  }

  // Default formatting: +CC-XXXXXXXXX (split remaining into reasonable chunks)
  if (remaining.length >= 6) {
    const mid = Math.ceil(remaining.length / 2);
    return `+${countryCode}-${remaining.slice(0, mid)}-${remaining.slice(mid)}`;
  }

  return `+${countryCode}-${remaining}`;
}

/**
 * Validates international phone number format
 */
function validateInternationalFormat(phoneNumber: string): boolean {
  // Must start with + followed by 1-4 digits for country code
  const pattern = /^\+\d{1,4}-\d{2,}-\d{2,}$/;
  const basicMatch = pattern.test(phoneNumber);

  if (!basicMatch) {
    return false;
  }

  // Extract total digit count (excluding + and -)
  const digitCount = phoneNumber.replace(/[^\d]/g, '').length;

  // Phone numbers should be between 7-15 digits total (ITU-T E.164 standard)
  return digitCount >= 7 && digitCount <= 15;
}

/**
 * Get country calling code from country name or code
 */
function getCountryCode(countryContext: string): string | null {
  const context = countryContext.toLowerCase();

  // Common country codes
  const countryCodes: Record<string, string> = {
    us: '1',
    usa: '1',
    'united states': '1',
    canada: '1',
    uk: '44',
    'united kingdom': '44',
    britain: '44',
    england: '44',
    italy: '39',
    italia: '39',
    france: '33',
    germany: '49',
    spain: '34',
    australia: '61',
    japan: '81',
    china: '86',
    india: '91',
    brazil: '55',
    russia: '7',
    mexico: '52',
    argentina: '54',
    netherlands: '31',
    sweden: '46',
    norway: '47',
    denmark: '45',
    finland: '358',
    switzerland: '41',
    austria: '43',
    belgium: '32',
    portugal: '351',
    greece: '30',
    turkey: '90',
    israel: '972',
    'south africa': '27',
    egypt: '20',
    uae: '971',
    emirates: '971',
    dubai: '971',
    'abu dhabi': '971',
    singapore: '65',
    thailand: '66',
    malaysia: '60',
    philippines: '63',
    'south korea': '82',
    korea: '82',
    taiwan: '886',
    'hong kong': '852',
    'new zealand': '64',
    ireland: '353',
    poland: '48',
    'czech republic': '420',
    hungary: '36',
    romania: '40',
    bulgaria: '359',
    croatia: '385',
    slovenia: '386',
    slovakia: '421',
    lithuania: '370',
    latvia: '371',
    estonia: '372',
  };

  return countryCodes[context] || null;
}
