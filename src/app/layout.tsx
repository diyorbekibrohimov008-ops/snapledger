import type { Metadata, Viewport } from 'next';
import { DM_Mono, Outfit } from 'next/font/google';
import './globals.css';
import { PwaRegistrar } from '@/components/PwaRegistrar';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: 'SnapLedger — Unlimited Receipt Capture & Two-Way Plaid Reconciliation',
  description:
    'Flat $15–$19/mo month-to-month bookkeeping for freelancers and SMBs. Unlimited scans, 3-second mobile camera PWA auto-crop, and two-way Plaid bank matching.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SnapLedger',
  },
  icons: {
    icon: ['/favicon.svg', '/icon-192.svg'],
    apple: '/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${outfit.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-[#070b14] text-slate-100 antialiased">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
