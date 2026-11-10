import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentMesh',
  description: 'Open, self-hostable agent operating platform. Run LangGraph agents as services, watch them live, keep humans in the loop.',
};

// Runs before React hydrates so the right theme is applied on first paint.
const themeScript = `
(function(){try{var t=localStorage.getItem('agentmesh-theme');
if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
