import { describe, expect, it } from 'vitest';
import { serializeDashboardCsv } from '../modules/app/utils/dashboardCsv';

function parseSemicolonCsv(content: string): string[][] {
  const source = content.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ';') {
      record.push(field);
      field = '';
    } else if (!quoted && character === '\r' && source[index + 1] === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      index += 1;
    } else if (!quoted && character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (quoted && character === '\r' && source[index + 1] === '\n') {
      field += '\r\n';
      index += 1;
    } else {
      field += character;
    }
  }

  record.push(field);
  records.push(record);
  return records;
}

describe('serializeDashboardCsv', () => {
  it('exports the existing headers and keeps every row in three Spanish Excel columns', () => {
    const content = serializeDashboardCsv([
      { date: 'miércoles, 28 de octubre', sales: 1234.5, orders: 3 },
    ]);

    expect(content).toBe('\uFEFFFecha;Ventas;Operaciones\r\nmiércoles, 28 de octubre;1234.5;3');
    expect(content.replace('\uFEFF', '').split('\r\n').map((row) => row.split(';'))).toEqual([
      ['Fecha', 'Ventas', 'Operaciones'],
      ['miércoles, 28 de octubre', '1234.5', '3'],
    ]);
  });

  it('escapes quotes, separators, and line breaks without shifting fields', () => {
    const date = '28; "octubre",\n2026';
    const content = serializeDashboardCsv([
      { date, sales: 10, orders: 1 },
    ]);

    expect(content).toContain('"28; ""octubre"",\n2026";10;1');
    expect(parseSemicolonCsv(content)).toEqual([
      ['Fecha', 'Ventas', 'Operaciones'],
      [date, '10', '1'],
    ]);
  });

  it('exports headers for an empty period', () => {
    const content = serializeDashboardCsv([]);
    expect(content).toBe('\uFEFFFecha;Ventas;Operaciones');
    expect(parseSemicolonCsv(content)).toEqual([['Fecha', 'Ventas', 'Operaciones']]);
  });
});
