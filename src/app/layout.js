import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Reversi AI Platform',
  description: 'Deploy your AI algorithms to compete in Reversi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body suppressHydrationWarning>
        <nav>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
             <span style={{ color: 'var(--primary)' }}>⬡</span> Reversi AI
          </div>
          <div>
            <Link href="/">Home & Leaderboard</Link>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
