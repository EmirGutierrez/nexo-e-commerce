import CustomerAccountPage from '../../../modules/commerce/components/CustomerAccountPage';
import PublicAccountControls from '../../../modules/app/components/PublicAccountControls';
import Link from 'next/link';
import CustomerNotificationBell from '../../../modules/commerce/components/CustomerNotificationBell';

export default function AccountPage() {
  return <div className="public-app"><header className="public-header"><Link href="/" className="brand"><span className="brand-mark"><span /></span><span>NEXO</span></Link><nav className="public-nav" aria-label="Navegación principal"><Link href="/store">Tienda</Link></nav><div className="header-actions"><CustomerNotificationBell /><PublicAccountControls /><Link href="/cart" className="cart-button">Carrito</Link></div></header><CustomerAccountPage /></div>;
}
