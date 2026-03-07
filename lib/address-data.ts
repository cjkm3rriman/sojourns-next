export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'D.C.'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

export const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'France', 'Germany',
  'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'New Zealand', 'Japan',
  'South Korea', 'Singapore', 'Hong Kong', 'United Arab Emirates', 'Israel',
  'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
  'South Africa', 'Egypt', 'Morocco', 'Kenya', 'Nigeria',
  'India', 'China', 'Thailand', 'Indonesia', 'Malaysia', 'Philippines', 'Vietnam',
  'Greece', 'Turkey', 'Croatia', 'Czech Republic', 'Poland', 'Hungary',
  'Russia', 'Ukraine', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain',
] as const;

export const COUNTRY_FLAG_CODE: Record<string, string> = {
  'United States': 'us', 'United Kingdom': 'gb', 'Canada': 'ca', 'Australia': 'au',
  'France': 'fr', 'Germany': 'de', 'Italy': 'it', 'Spain': 'es', 'Portugal': 'pt',
  'Netherlands': 'nl', 'Belgium': 'be', 'Switzerland': 'ch', 'Austria': 'at',
  'Sweden': 'se', 'Norway': 'no', 'Denmark': 'dk', 'Finland': 'fi', 'Ireland': 'ie',
  'New Zealand': 'nz', 'Japan': 'jp', 'South Korea': 'kr', 'Singapore': 'sg',
  'Hong Kong': 'hk', 'United Arab Emirates': 'ae', 'Israel': 'il',
  'Mexico': 'mx', 'Brazil': 'br', 'Argentina': 'ar', 'Chile': 'cl',
  'Colombia': 'co', 'Peru': 'pe', 'South Africa': 'za', 'Egypt': 'eg',
  'Morocco': 'ma', 'Kenya': 'ke', 'Nigeria': 'ng', 'India': 'in', 'China': 'cn',
  'Thailand': 'th', 'Indonesia': 'id', 'Malaysia': 'my', 'Philippines': 'ph',
  'Vietnam': 'vn', 'Greece': 'gr', 'Turkey': 'tr', 'Croatia': 'hr',
  'Czech Republic': 'cz', 'Poland': 'pl', 'Hungary': 'hu', 'Russia': 'ru',
  'Ukraine': 'ua', 'Saudi Arabia': 'sa', 'Qatar': 'qa', 'Kuwait': 'kw', 'Bahrain': 'bh',
};
