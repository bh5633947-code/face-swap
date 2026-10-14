import './globals.css';

export const metadata = { title: 'Face Swap em Vídeo' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
