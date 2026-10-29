// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { authService, paymentSettingsService } from '../services';
import { AdminAlertHost } from '../modules/app/components/AdminAlertHost';

const route = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: route.push }) }));

type InventoryProduct = { id: string; name: string; stock: number; status: 'Activo' | 'Bajo stock' | 'Agotado' | 'Inactivo' };
const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'superadmin' as const, initials: 'AD', status: 'Activo' as const, permissions: ['*'] };

function AlertScreen({ name, products }: { name: string; products: InventoryProduct[] }) {
  const { reportLowStock } = useApp();
  useEffect(() => { reportLowStock(products); }, [name, products, reportLowStock]);
  return <p>{name}</p>;
}

function renderAlertScreen(name: string, products: InventoryProduct[]) {
  return render(<AppProvider><AlertScreen name={name} products={products} /><AdminAlertHost /></AppProvider>);
}

describe('avisos administrativos de inventario', () => {
  beforeEach(() => {
    vi.spyOn(authService, 'currentUser').mockResolvedValue(admin);
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    route.push.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('no bloquea la pantalla ni duplica el mismo aviso al navegar entre Dashboard e Inventario', async () => {
    const stock = [{ id: 'product-1', name: 'Monitor', stock: 0, status: 'Agotado' as const }];
    const view = renderAlertScreen('Dashboard', stock);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Monitor (0)');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeTruthy();

    view.rerender(<AppProvider><AlertScreen name="Inventario" products={stock} /><AdminAlertHost /></AppProvider>);
    expect(screen.getByText('Inventario')).toBeTruthy();
    expect(screen.getAllByRole('status').length).toBe(1);
    expect(screen.getByRole('status').textContent).toContain('Monitor (0)');
  });

  it('permite descartar un aviso sin reabrirlo durante la misma navegación', async () => {
    const stock = [{ id: 'product-1', name: 'Monitor', stock: 3, status: 'Bajo stock' as const }];
    const view = renderAlertScreen('Dashboard', stock);
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Descartar aviso' }));
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();

    view.rerender(<AppProvider><AlertScreen name="Inventario" products={stock} /><AdminAlertHost /></AppProvider>);
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();
  });

  it('reemplaza los productos obsoletos y limpia el aviso cuando dejan de requerir atención', async () => {
    const firstStock = [{ id: 'deleted-product', name: 'Producto eliminado', stock: 0, status: 'Agotado' as const }];
    const view = renderAlertScreen('Dashboard', firstStock);
    const firstNotice = await screen.findByRole('status');
    expect(firstNotice.textContent).toContain('Producto eliminado (0)');

    const updatedStock = [{ id: 'current-product', name: 'Producto vigente', stock: 1, status: 'Bajo stock' as const }];
    view.rerender(<AppProvider><AlertScreen name="Inventario" products={updatedStock} /><AdminAlertHost /></AppProvider>);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Producto vigente (1)');
    expect(notice.textContent).not.toContain('Producto eliminado');
    expect(screen.getAllByRole('status')).toHaveLength(1);

    view.rerender(<AppProvider><AlertScreen name="Inventario" products={[]} /><AdminAlertHost /></AppProvider>);
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();

    const newStock = [{ id: 'new-product', name: 'Producto nuevo', stock: 0, status: 'Agotado' as const }];
    view.rerender(<AppProvider><AlertScreen name="Inventario" products={newStock} /><AdminAlertHost /></AppProvider>);
    expect((await screen.findByRole('status')).textContent).toContain('Producto nuevo (0)');
  });

  it('ignora productos inactivos y limita el detalle a 180 caracteres', async () => {
    const inactive = [{ id: 'inactive', name: 'Ya no disponible', stock: 0, status: 'Inactivo' as const }];
    const view = renderAlertScreen('Inventario', inactive);
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();

    const manyLongNames = Array.from({ length: 6 }, (_, index) => ({
      id: `product-${index}`,
      name: 'ProductoSinEspacios'.repeat(15),
      stock: index,
      status: (index === 0 ? 'Agotado' : 'Bajo stock') as InventoryProduct['status'],
    }));
    view.rerender(<AppProvider><AlertScreen name="Inventario" products={manyLongNames} /><AdminAlertHost /></AppProvider>);

    const notice = await screen.findByRole('status');
    const entity = notice.querySelector('.admin-alert-entity')?.textContent ?? '';
    expect(entity.length).toBeLessThanOrEqual(180);
    expect(entity).toContain('y 3 más');
    expect(entity).toContain('…');
    expect(entity).not.toContain('ProductoSinEspacios'.repeat(15));
  });
});
