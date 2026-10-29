import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('layout responsive del Dashboard', () => {
  it('mantiene columnas flexibles y reorganiza métricas y paneles en los breakpoints del panel', () => {
    expect(styles).toContain('.dashboard .metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
    expect(styles).toContain('.dashboard .dashboard-grid { grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); }');
    expect(styles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.dashboard \.metric-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.dashboard \.dashboard-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*370px\)[\s\S]*?\.dashboard \.metric-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toContain('.dashboard .metric-card, .dashboard .metric-content, .dashboard .sales-panel, .dashboard .inventory-panel, .dashboard .activity-panel { min-width: 0; }');
    expect(styles).toContain('.dashboard .sales-chart svg { display: block; width: 100%; max-width: 100%; }');
  });

  it.each([320, 375, 768, 1024, 1280])('define una regla de layout para %i px', (width) => {
    const expectedRule = width <= 370
      ? /@media\s*\(max-width:\s*370px\)[\s\S]*?\.dashboard \.metric-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/
      : width <= 1100
        ? /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.dashboard \.metric-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
        : /\.dashboard \.metric-grid\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/;
    expect(styles).toMatch(expectedRule);
  });
});
