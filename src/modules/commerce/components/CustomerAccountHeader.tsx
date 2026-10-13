import Link from 'next/link';
import PublicAccountControls from '../../app/components/PublicAccountControls';
import FloatingCartButton from '../../app/components/FloatingCartButton';
import CustomerNotificationBell from './CustomerNotificationBell';

export default function CustomerAccountHeader() {
  return <>
    <header className="public-header">
      <Link href="/" className="brand"><span className="brand-mark"><span /></span><span>NEXO</span></Link>
      <nav className="public-nav" aria-label="Navegación principal"><Link href="/store">Tienda</Link></nav>
      <div className="header-actions"><CustomerNotificationBell /><PublicAccountControls /><Link href="/cart" className="cart-button">Carrito</Link></div>
    </header>
    <FloatingCartButton />
  </>;
}
