export type DashboardCsvRow = { date: string; sales: number; orders: number };

const escapeCsvField = (value: string, delimiter: string) => {
  if (!/["\r\n]/.test(value) && !value.includes(delimiter)) return value;
  return `"${value.replaceAll('"', '""')}"`;
};

export function serializeDashboardCsv(rows: DashboardCsvRow[]): string {
  const delimiter = ';';
  const records = [
    ['Fecha', 'Ventas', 'Operaciones'],
    ...rows.map((row) => [row.date, String(row.sales), String(row.orders)]),
  ];
  return `\uFEFF${records.map((record) => record.map((field) => escapeCsvField(field, delimiter)).join(delimiter)).join('\r\n')}`;
}
