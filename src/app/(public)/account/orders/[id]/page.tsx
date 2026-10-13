import CustomerAccountHeader from '../../../../../modules/commerce/components/CustomerAccountHeader';
import CustomerOrderDetailPage from '../../../../../modules/commerce/components/CustomerOrderDetailPage';

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="public-app"><CustomerAccountHeader /><CustomerOrderDetailPage orderId={id} /></div>;
}
