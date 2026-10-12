import { CountryCode, isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js';

function fullName({ fullName, firstName, lastName }: { fullName?: string; firstName?: string; lastName?: string }): string | undefined {
  const joined = fullName?.trim() ? fullName : [firstName, lastName].filter((part) => part?.trim()).join(' ');
  const cleaned = joined?.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function email(value?: string): string | undefined {
  const cleaned = value?.trim().toLowerCase();
  return cleaned || undefined;
}

function phone({ value, defaultCountry }: { value?: string; defaultCountry?: string }): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }
  const upperCountry = defaultCountry?.trim().toUpperCase();
  const country: CountryCode | undefined = upperCountry && isSupportedCountry(upperCountry) ? upperCountry : undefined;
  const parsed = parsePhoneNumberFromString(raw.startsWith('00') ? `+${raw.slice(2)}` : raw, country);
  return parsed?.isValid() ? parsed.number : raw;
}

function text(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

export const leadNormalizer = { fullName, email, phone, text };
