import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ajaia Docs — AI-Native Collaborative Document Workspace',
  description:
    'Lightweight collaborative rich-text document editor with multi-mode file upload, role-based sharing, version history, and multi-provider AI assistance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-light">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-500/20 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
