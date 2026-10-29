import { describe, expect, it } from 'vitest';
import { businessToday, isHistoricalBusinessDate, isValidBusinessDate } from '../shared/utils/businessDate';

describe('fechas del negocio', () => {
  it('valida fechas ISO del calendario y rechaza fechas inexistentes', () => {
    expect(isValidBusinessDate('2024-02-29')).toBe(true);
    expect(isValidBusinessDate('2026-02-29')).toBe(false);
    expect(isValidBusinessDate('2026-2-03')).toBe(false);
    expect(isValidBusinessDate('')).toBe(false);
  });

  it('considera solo fechas anteriores al día comercial como históricas', () => {
    const today = businessToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isHistoricalBusinessDate('2026-10-19', '2026-10-28')).toBe(true);
    expect(isHistoricalBusinessDate('2026-10-28', '2026-10-28')).toBe(false);
    expect(isHistoricalBusinessDate('2026-10-29', '2026-10-28')).toBe(false);
  });
});
