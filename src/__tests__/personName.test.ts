import { describe, expect, it } from 'vitest';
import { isValidPersonName } from '../shared/utils/personName';

describe('validación de nombres personales', () => {
  it.each(['María García', 'Ana-María O’Connor', "Jean-Luc D'Arcy", '李 小龍'])('acepta el nombre internacional %s', (name) => {
    expect(isValidPersonName(name)).toBe(true);
  });

  it.each(['', 'A', '7777', 'Ana 123', '<h1>Ana</h1>', '<img src=x onerror=alert(1)>', 'Ana@@Maria', 'Ana--María', '\u0301Ana'])('rechaza el contenido no válido %s', (name) => {
    expect(isValidPersonName(name)).toBe(false);
  });
});
