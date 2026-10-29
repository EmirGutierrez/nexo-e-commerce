const MAX_MONEY_INTEGER_DIGITS = 12;

const mixedLabelCharacters = /^[\p{L}\p{M}\p{N}\s&.,'’()/+_#:%!?=~\[\]–—-]*$/u;
const personNameCharacters = /^[\p{L}\p{M}\s'’\-]*$/u;
const emailPattern = /^[A-Z0-9]+(?:[._%+-][A-Z0-9]+)*@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)*\.[A-Z]{2,}$/i;
const skuPattern = /^[A-Z0-9][A-Z0-9._/-]{0,79}$/;
const decimalPattern = /^\d+(?:\.\d{1,2})?$/;

export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, '');
}

export function sanitizeDecimalInput(value: string): string {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const separator = normalized.indexOf('.');
  const integer = (separator === -1 ? normalized : normalized.slice(0, separator)).slice(0, MAX_MONEY_INTEGER_DIGITS);
  if (separator === -1) return integer;
  const fraction = normalized.slice(separator + 1).replace(/\./g, '').slice(0, 2);
  return `${integer || '0'}.${fraction}`;
}

export function sanitizePersonNameInput(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}\p{M}\s'’\-]/gu, '');
}

export function sanitizeMixedLabelInput(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s&.,'’()/+_#:%!?=~\[\]–—-]/gu, '');
}

export function sanitizeFreeTextInput(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function sanitizeSkuInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9._/-]/g, '').slice(0, 80);
}

export function sanitizeNitInput(value: string): string {
  return value.toLocaleUpperCase('es-GT').replace(/[^A-Z0-9-]/g, '').slice(0, 20);
}

export function sanitizeDiscountCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

export function sanitizeEmailInput(value: string): string {
  let normalized = '';
  let hasAt = false;
  for (const character of value.replace(/\s/g, '')) {
    if (character === '@') {
      if (hasAt) continue;
      hasAt = true;
      normalized += character;
      continue;
    }
    if (/[A-Z0-9._%+-]/i.test(character)) normalized += character;
  }
  return normalized.slice(0, 254);
}

export function sanitizeContactInput(value: string): string {
  return /[A-Za-z@]/.test(value) ? sanitizeEmailInput(value) : sanitizePhoneInput(value);
}

export function sanitizePhoneInput(value: string): string {
  const hasLeadingPlus = /^\s*\+/.test(value);
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return `${hasLeadingPlus ? '+' : ''}${digits}`;
}

export function isValidEmailInput(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length > 254 || !emailPattern.test(normalized)) return false;
  const domain = normalized.slice(normalized.indexOf('@') + 1);
  return /[A-Z]/i.test(domain) && !domain.split('.').some((label) => label.length > 63);
}

export function isValidPhoneInput(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length > 40 || !/^[+]?\d[\d\s()-]*$/.test(normalized) || (normalized.match(/\+/g) || []).length > 1) return false;
  if (normalized.includes('+') && !normalized.startsWith('+')) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidContactInput(value: string): boolean {
  return isValidEmailInput(value) || isValidPhoneInput(value);
}

export function isValidMixedLabel(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 180 && mixedLabelCharacters.test(normalized) && /[\p{L}\p{N}]/u.test(normalized);
}

export function isValidSkuInput(value: string): boolean {
  return skuPattern.test(value.trim());
}

export function isValidMoneyDraft(value: string): boolean {
  return /^(?:[0-9]{0,12})(?:[.,][0-9]{0,2})?$/.test(value);
}

export function isValidMoneyInput(value: string, minimum = 0): boolean {
  if (!decimalPattern.test(value)) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= minimum && amount <= 999_999_999_999.99;
}

export function isValidIntegerInput(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount <= 2_147_483_647;
}

export function isValidPersonNameInput(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 2 && normalized.length <= 160 && personNameCharacters.test(normalized)
    && /\p{L}/u.test(normalized) && !/^['’\-]|['’\-]$|\s{2,}|['’\-]{2,}/u.test(normalized);
}
