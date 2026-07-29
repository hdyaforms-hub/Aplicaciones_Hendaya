import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aplicaciones Hendaya",
  description: "Gestión de Aplicaciones Hendaya",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" translate="no">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
