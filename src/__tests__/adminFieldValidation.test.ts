import { describe, expect, it } from 'vitest';
import {
  isValidContactInput,
  isValidEmailInput,
  isValidIntegerInput,
  isValidMixedLabel,
  isValidMoneyDraft,
  isValidMoneyInput,
  isValidPersonNameInput,
  isValidPhoneInput,
  isValidSkuInput,
  sanitizeContactInput,
  sanitizeDecimalInput,
  sanitizeDiscountCodeInput,
  sanitizeEmailInput,
  sanitizeFreeTextInput,
  sanitizeIntegerInput,
  sanitizeMixedLabelInput,
  sanitizeNitInput,
  sanitizePersonNameInput,
  sanitizeSkuInput,
} from '../shared/utils/adminFieldValidation';

describe('validaciones de campos administrativos', () => {
  it('conserva nombres internacionales y bloquea números y símbolos ajenos a nombres de personas', () => {
    expect(sanitizePersonNameInput('María O’Neill-García 123')).toBe('María O’Neill-García ');
    expect(isValidPersonNameInput('María O’Neill-García')).toBe(true);
    expect(isValidPersonNameInput('7777 García')).toBe(false);
    expect(isValidPersonNameInput('<script>')).toBe(false);
  });

  it('permite etiquetas mixtas habituales para productos, marcas, categorías y ubicaciones', () => {
    for (const value of ['3M Audio', 'USB-C 2.0', 'Hogar / Decoración', 'Oferta 50%']) {
      expect(isValidMixedLabel(value)).toBe(true);
      expect(sanitizeMixedLabelInput(value)).toBe(value);
    }
    expect(isValidMixedLabel('!!!')).toBe(false);
    expect(isValidMixedLabel('<img src=x>')).toBe(false);
  });

  it('valida números enteros, dinero y límites de precisión sin aceptar notación científica', () => {
    expect(sanitizeIntegerInput('12e3')).toBe('123');
    expect(isValidIntegerInput('12')).toBe(true);
    expect(isValidIntegerInput('1.5')).toBe(false);
    expect(isValidMoneyInput('1234.50', 0.01)).toBe(true);
    expect(isValidMoneyDraft('12,50')).toBe(true);
    expect(isValidMoneyDraft('12.500')).toBe(false);
    expect(isValidMoneyDraft('1e3')).toBe(false);
    expect(isValidMoneyInput('1.001')).toBe(false);
    expect(isValidMoneyInput('1e3')).toBe(false);
    expect(sanitizeDecimalInput('25,5')).toBe('25.5');
    expect(sanitizeDecimalInput('.5')).toBe('0.5');
  });

  it('restringe SKU y NIT a sus formatos mixtos definidos', () => {
    expect(sanitizeSkuInput(' jdo-sol 12# ')).toBe('JDO-SOL12');
    expect(isValidSkuInput('JDO-SOL-12')).toBe(true);
    expect(isValidSkuInput('SKU con espacios')).toBe(false);
    expect(sanitizeNitInput('cf-123 456')).toBe('CF-123456');
    expect(sanitizeDiscountCodeInput(' promo-20% ')).toBe('PROMO-20');
    expect(sanitizeDiscountCodeInput('a'.repeat(30))).toBe('A'.repeat(24));
    expect(sanitizeFreeTextInput('Texto\u0001 válido\n')).toBe('Texto válido\n');
  });

  it('distingue correos reales y teléfonos y rechaza correos con dominios numéricos', () => {
    expect(isValidEmailInput('compras+gt@empresa.gt')).toBe(true);
    expect(isValidEmailInput('7777@77777')).toBe(false);
    expect(isValidEmailInput('a..b@empresa.gt')).toBe(false);
    expect(isValidPhoneInput('+502 5555-1234')).toBe(true);
    expect(isValidPhoneInput('123456')).toBe(false);
    expect(isValidPhoneInput('502+5555-1234')).toBe(false);
    expect(isValidContactInput('contacto@empresa.gt')).toBe(true);
    expect(sanitizeContactInput('+502 5555-1234')).toBe('+50255551234');
    expect(sanitizeEmailInput('a@@b!.égt')).toBe('a@b.gt');
  });
});
