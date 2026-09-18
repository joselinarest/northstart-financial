import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './property-account-manager.css';
import './refresh.css';
import './mobile-fix.css';
import './menu-polish.css';
import './sidebar-fix.css';
import './scenario-gallery.css';
import './buy-sell-guide.css';
import './state-polish.css';
import './notification-control.css';
import './auth-loading.css';
import './sidebar-contrast.css';
import './execution-board.css';
import './chart-prediction-lab.css';
import './professional-prediction-overlay.css';
import './action-guidance.css';
import './investment-command-center.css';
import './account-scope-dashboard.css';
import './ai-analysis-evidence.css';
import './automatic-market-copilot.css';
import './paper-trading-simulator.css';
import './selected-account-plan.css';
import './responsive-mobile.css';
import './design-system.css';
import './market-discovery.css';
import './market-discovery-controls.css';
import './integrated-research-chart.css';
import './flow-intelligence.css';
import './daily-close-review.css';
import './tactical-rebuy-panel.css';
import './mobile-primary.css';
import './layout-system.css';
import { ConfirmProvider } from './confirmation-modal';
import PwaManager from './pwa-manager';
import MobileOverflowDebug from './mobile-overflow-debug';

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
  manifest: '/manifest.webmanifest',
  icons: { icon: [{url:'/icons/northstar-192.png',sizes:'192x192',type:'image/png'},{url:'/favicon.svg',type:'image/svg+xml'}], shortcut: '/favicon.svg', apple: [{url:'/icons/apple-touch-icon.png',sizes:'180x180',type:'image/png'}] },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Northstar' },
  formatDetection:{telephone:false},
};

export const viewport={themeColor:'#0b3d30',width:'device-width',initialScale:1,viewportFit:'cover'};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Northstar" />
        <meta name="application-name" content="Northstar" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConfirmProvider><PwaManager/><MobileOverflowDebug/>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
