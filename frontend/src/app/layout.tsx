import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Off the Grid - Decentralized Grid Trading',
  description: 'Learn and trade with automated grid strategies on the Ergo blockchain',
  keywords: 'grid trading, cryptocurrency, Ergo blockchain, decentralized trading, DeFi, education',
  authors: [{ name: 'Off the Grid Team' }],
  viewport: 'width=device-width, initial-scale=1',
  openGraph: {
    title: 'Off the Grid - Decentralized Grid Trading',
    description: 'Learn and trade with automated grid strategies on the Ergo blockchain',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WalletProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            <Navigation />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}