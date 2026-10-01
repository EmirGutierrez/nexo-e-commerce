import { readFile } from 'node:fs/promises';

const email = process.env.DEMO_ADMIN_EMAIL;
const password = process.env.DEMO_ADMIN_PASSWORD;
const origin = process.env.DEMO_API_ORIGIN ?? 'http://127.0.0.1:8080';

if (!email || !password) {
  throw new Error('Configura DEMO_ADMIN_EMAIL y DEMO_ADMIN_PASSWORD en el entorno.');
}

const url = new URL(origin);
if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('DEMO_API_ORIGIN debe ser el origen local de Spring, sin ruta.');
}

const fixture = JSON.parse(await readFile(new URL('../demo/catalog.json', import.meta.url), 'utf8'));
let sessionCookie = '';

async function request(method, path, body, csrfToken) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
  if (sessionCookie) headers.Cookie = sessionCookie;

  const response = await fetch(new URL(path, url), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });

  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
  for (const cookie of setCookies) {
    const match = cookie.match(/(?:^|,)\s*(NEXOSESSION=[^;\s]*)/);
    if (match) sessionCookie = match[1];
  }

  const content = await response.text();
  const result = content ? JSON.parse(content) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${result?.message ?? response.statusText}`);
  }
  return result;
}

const csrf = await request('GET', '/api/auth/csrf');
const account = await request('POST', '/api/auth/login', { email, password }, csrf.token);
if (!account.permissions?.includes('products:create')) {
  throw new Error('La cuenta necesita permiso para crear productos.');
}
const token = (await request('GET', '/api/auth/csrf')).token;

const existingBrands = await request('GET', '/api/business/brands');
const brandIds = new Map();
let brandsCreated = 0;
for (const { key, ...brand } of fixture.brands) {
  const existing = existingBrands.find((record) =>
    (record.data.name ?? record.data.Nombre)?.toLowerCase() === brand.name.toLowerCase());
  if (existing) {
    brandIds.set(key, existing.id);
    continue;
  }
  const created = await request('POST', '/api/business/brands', brand, token);
  brandIds.set(key, created.id);
  brandsCreated++;
}

const existingProducts = await request('GET', '/api/business/products');
const skus = new Set(existingProducts.map((record) => (record.data.sku ?? record.data.SKU)?.toLowerCase()));
let productsCreated = 0;
for (const { brandKey, ...product } of fixture.products) {
  if (skus.has(product.sku.toLowerCase())) continue;
  await request('POST', '/api/business/products', {
    ...product,
    ...(brandKey ? { brandId: brandIds.get(brandKey) } : {}),
  }, token);
  productsCreated++;
}

console.log(`Marcas creadas: ${brandsCreated}; productos creados: ${productsCreated}.`);
