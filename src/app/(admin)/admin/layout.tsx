import type { ReactNode } from 'react';
import { AdminWorkspace } from '../../../modules/app/components/NexoPages';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
