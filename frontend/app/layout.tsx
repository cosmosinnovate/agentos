import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AgentOS — AI Agent Control Plane',
  description: 'Enterprise AI Agent Control Plane: build, deploy, observe, and scale AI agents across any cloud.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 text-gray-100 antialiased`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
