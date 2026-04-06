import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGCC — Sistema de Gestión de Centros de Conciliación",
  description: "Plataforma integral para centros de conciliación y notarías",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
