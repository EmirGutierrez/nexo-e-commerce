import { describe, expect, it } from 'vitest';
import { formatQ } from '../data/mockData';

describe('formatQ', () => {
  it('formats integer amounts with two decimal places', () => {
    expect(formatQ(1200)).toBe('Q 1,200.00');
  });

  it('preserves cents and rounds to two decimal places', () => {
    expect(formatQ(15.678)).toBe('Q 15.68');
  });

  it('formats zero as a monetary amount', () => {
    expect(formatQ(0)).toBe('Q 0.00');
  });
});
