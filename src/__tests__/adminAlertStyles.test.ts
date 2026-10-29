import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('ajuste de avisos administrativos', () => {
  it('envuelve nombres largos dentro de la tarjeta y conserva el espacio de iconos y acciones', () => {
    expect(styles).toContain('.admin-alert-host { position: fixed; inset: auto 24px 24px auto; z-index: 10000; width: min(480px, calc(100vw - 48px));');
    expect(styles).toContain('.admin-alert-content { min-width: 0; overflow-wrap: anywhere; }');
    expect(styles).toContain('.admin-alert-content .admin-alert-entity { color: var(--ink); font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }');
    expect(styles).toContain('.admin-alert-icon { width: 42px; height: 42px; flex: 0 0 42px;');
    expect(styles).toContain('.admin-alert-actions .button { min-width: 100px; flex: 0 0 auto; justify-content: center; white-space: nowrap; }');
    expect(styles).toMatch(/@media\s*\(max-width:\s*540px\)[\s\S]*?\.admin-alert-host\s*\{\s*inset:\s*auto 12px 12px;\s*width:\s*calc\(100vw - 24px\)/);
  });
});
