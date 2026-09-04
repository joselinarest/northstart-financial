import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './refresh.css';
import './mobile-fix.css';
import './menu-polish.css';
import './sidebar-fix.css';
import './scenario-gallery.css';
import './buy-sell-guide.css';
import './state-polish.css';
import './notification-control.css';
import './sidebar-contrast.css';
import './chart-prediction-lab.css';
import './automatic-market-copilot.css';
import './paper-trading-simulator.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Northstar — Professional Trading Copilot',
  description: 'A powerful, risk-first and explainable investing and trading assistant for every experience level.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg?v=3', shortcut: '/favicon.svg?v=3', apple: '/favicon.svg?v=3' },
  themeColor: '#172a24',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Northstar' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
