// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BrandsPage from '../modules/brands/components/BrandsPage';
import { brandService, productInventoryService } from '../services';
import { roleService } from '../services/roleService';

const app = vi.hoisted(() => ({ role: 'superadmin' }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));

const brands = [
  { id: 'brand-1', name: 'NEXO Labs', description: 'Equipos de prueba', contact: 'labs@example.com', website: '', status: 'Activa' as const },
  { id: 'brand-2', name: 'NEXO Home', description: 'Hogar', contact: 'home@example.com', website: '', status: 'Activa' as const },
];
const products = [{
  id: 'product-1', brandId: 'brand-1', name: 'Monitor', category: 'Pantallas', price: 100,
  image: '', description: 'Monitor', sku: 'MON-1', stock: 3, status: 'Activo' as const,
}];

beforeEach(() => {
  vi.spyOn(brandService, 'list').mockResolvedValue(brands);
  vi.spyOn(brandService, 'create').mockResolvedValue(brands[0]);
  vi.spyOn(brandService, 'delete').mockResolvedValue({ id: 'brand-1', reassignedProducts: 1 });
  vi.spyOn(productInventoryService, 'list').mockResolvedValue(products);
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('marcas', () => {
  it('acepta nombres mixtos y rechaza contactos que no son correo ni teléfono válidos', async () => {
    render(<BrandsPage />);
    await screen.findByText('NEXO Labs');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva marca' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre de la marca'), { target: { value: '3M Audio' } });
    fireEvent.change(screen.getByPlaceholderText('Productos o especialidad de la marca'), { target: { value: 'Audio 50%' } });
    fireEvent.change(screen.getByPlaceholderText('Correo o teléfono'), { target: { value: 'contacto@7777' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    expect((await screen.findByRole('alert')).textContent).toContain('correo válido');
    expect(brandService.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Correo o teléfono'), { target: { value: '+502 5555-1212' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    await waitFor(() => expect(brandService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '3M Audio', description: 'Audio 50%', contact: '+50255551212',
    })));
  });

  it('exige descripción y contacto, guarda valores normalizados y permite reasignar productos antes de eliminar', async () => {
    render(<BrandsPage />);
    await screen.findByText('NEXO Labs');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva marca' }));

    fireEvent.change(screen.getByPlaceholderText('Nombre de la marca'), { target: { value: '   ' } });
    fireEvent.change(screen.getByPlaceholderText('Productos o especialidad de la marca'), { target: { value: 'Equipos' } });
    fireEvent.change(screen.getByPlaceholderText('Correo o teléfono'), { target: { value: 'contacto@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    expect((await screen.findByRole('alert')).textContent).toContain('nombre, la descripción y el contacto');

    fireEvent.change(screen.getByPlaceholderText('Nombre de la marca'), { target: { value: '  NEXO Nuevo  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    await waitFor(() => expect(brandService.create).toHaveBeenCalledWith({
      name: 'NEXO Nuevo', description: 'Equipos', contact: 'contacto@example.com', website: '', status: 'Activa',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Ver marca NEXO Labs' }));
    expect((await screen.findByRole('dialog', { name: 'NEXO Labs' })).textContent).toContain('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar marca NEXO Labs' }));
    fireEvent.change(screen.getByLabelText('Reasignar a'), { target: { value: 'brand-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => expect(brandService.delete).toHaveBeenCalledWith('brand-1', 'brand-2'));
  });

  it('rechaza nombres sin letras ni números, valida URL y cierra al pulsar el fondo', async () => {
    render(<BrandsPage />);
    await screen.findByText('NEXO Labs');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva marca' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre de la marca'), { target: { value: '!!!' } });
    fireEvent.change(screen.getByPlaceholderText('Productos o especialidad de la marca'), { target: { value: 'Accesorios' } });
    fireEvent.change(screen.getByPlaceholderText('Correo o teléfono'), { target: { value: 'ventas@nexo.gt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    expect((await screen.findByRole('alert')).textContent).toContain('nombre de la marca');
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nombre de la marca'), { target: { value: 'NEXO Audio' } });
    fireEvent.change(screen.getByPlaceholderText('https://ejemplo.com'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
    expect((await screen.findByRole('alert')).textContent).toContain('http:// o https://');
    expect(brandService.create).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.querySelector('.modal-backdrop') as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
