import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ErrorBoundary from '../components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartWait - Virtual Queue Management',
  description: 'Eliminate waiting room crowding with virtual queue management',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}