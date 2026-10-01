import { AdminSection } from '../../../../modules/app/components/NexoPages';

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  return <AdminSection section={section.join('/') || 'dashboard'} />;
}
