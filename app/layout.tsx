import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transportes Moçambique - Localização em Tempo Real",
  description: "Encontre e acompanhe transportes públicos em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
