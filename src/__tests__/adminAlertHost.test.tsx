// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { authService, paymentSettingsService } from '../services';
import { AdminAlertHost } from '../modules/app/components/AdminAlertHost';

const route = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: route.push }) }));

type InventoryProduct = { id: string; name: string; stock: number };
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
    const stock = [{ id: 'product-1', name: 'Monitor', stock: 0 }];
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
    const stock = [{ id: 'product-1', name: 'Monitor', stock: 3 }];
    const view = renderAlertScreen('Dashboard', stock);
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Descartar aviso' }));
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();

    view.rerender(<AppProvider><AlertScreen name="Inventario" products={stock} /><AdminAlertHost /></AppProvider>);
    expect(screen.queryByLabelText('Avisos administrativos')).toBeNull();
  });

  it('vuelve a notificar cuando cambia el estado de stock y conserva nombres largos completos', async () => {
    const longName = 'ProductoSinEspacios'.repeat(15);
    const firstStock = [{ id: 'product-1', name: 'Monitor', stock: 2 }];
    const view = renderAlertScreen('Dashboard', firstStock);
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar aviso' }));

    const updatedStock = [{ id: 'product-1', name: longName, stock: 1 }];
    view.rerender(<AppProvider><AlertScreen name="Inventario" products={updatedStock} /><AdminAlertHost /></AppProvider>);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain(longName);
    expect(notice.querySelector('.admin-alert-entity')?.classList.contains('admin-alert-entity')).toBe(true);
  });
});
