import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subgraph Dashboard",
  description: "Real-time indexing stats for a self-hosted graph-node subgraph",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
