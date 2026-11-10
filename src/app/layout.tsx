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
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-blue-500/30 selection:text-blue-100">
        {children}
      </body>
    </html>
  );
}
