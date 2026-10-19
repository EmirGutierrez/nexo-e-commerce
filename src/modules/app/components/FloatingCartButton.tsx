'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';

export default function FloatingCartButton() {
  const { cartCount } = useApp();
  const pathname = usePathname();

  if (!cartCount || ['/cart', '/checkout', '/confirmation'].includes(pathname)) return null;

  return <Link
    href="/cart"
    className="floating-cart-button"
    aria-label={`Abrir carrito, ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}`}
    title="Ir al carrito"
  >
    <ShoppingCart size={21} aria-hidden="true" />
    <span key={cartCount} className="floating-cart-count" aria-hidden="true">{cartCount}</span>
  </Link>;
}
