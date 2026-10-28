import { describe, expect, it } from 'vitest';
import { getDashboardGreeting } from '../modules/app/utils/dashboardGreeting';

describe('getDashboardGreeting', () => {
  it.each([
    [0, 'Buenas noches'],
    [4, 'Buenas noches'],
    [5, 'Buenos días'],
    [11, 'Buenos días'],
    [12, 'Buenas tardes'],
    [18, 'Buenas tardes'],
    [19, 'Buenas noches'],
    [23, 'Buenas noches'],
  ] as const)('returns the greeting for local hour %i', (hour, greeting) => {
    const localTime = new Date(2026, 0, 1, hour);

    expect(getDashboardGreeting(localTime)).toBe(greeting);
  });
});
