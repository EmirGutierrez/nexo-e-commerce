import { describe, expect, it } from 'vitest';
import { getDashboardGreeting } from '../modules/app/utils/dashboardGreeting';

describe('saludo del Dashboard en la zona horaria de Guatemala', () => {
  it.each([
    ['2026-10-28T09:59:00.000Z', 'Buenas noches'],
    ['2026-10-28T11:00:00.000Z', 'Buenos días'],
    ['2026-10-28T17:59:00.000Z', 'Buenos días'],
    ['2026-10-28T18:00:00.000Z', 'Buenas tardes'],
    ['2026-10-29T00:59:00.000Z', 'Buenas tardes'],
    ['2026-10-29T01:00:00.000Z', 'Buenas noches'],
  ] as const)('usa el saludo correspondiente a %s', (instant, expected) => {
    expect(getDashboardGreeting(new Date(instant))).toBe(expected);
  });
});
