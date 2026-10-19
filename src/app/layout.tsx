import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
import './visual-polish.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'NEXO COMMERCE · Gestión inteligente',
  description: 'Tienda en línea y plataforma de gestión comercial NEXO.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return <html lang="es"><body><Providers>{children}</Providers></body></html>;
}
