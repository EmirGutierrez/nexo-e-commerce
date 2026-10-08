import { redirect } from 'next/navigation';
import { AdminSection } from '../../../../modules/app/components/NexoPages';

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  if (section[0] === 'reports') redirect('/admin/dashboard');
  if (section[0] === 'roles-permissions') redirect('/admin/settings/roles-permissions');
  return <AdminSection section={section.join('/') || 'dashboard'} />;
}
