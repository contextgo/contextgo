import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextGo - Manage Your Context, Empower Your AI",
  description: "Local context management for the AI era. Edit, manage, and serve context to LLMs via standard protocols.",
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
