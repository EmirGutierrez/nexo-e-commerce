"use client";

import type { ReactNode } from 'react';
import { AppProvider } from '../contexts/AppContext';
import { AdminAlertHost } from '../modules/app/components/AdminAlertHost';

export default function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}<AdminAlertHost /></AppProvider>;
}
