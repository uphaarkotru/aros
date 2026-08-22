import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./admin.css";
import "./today/rsm/rsm.css";
import "./today/rsm/light.css";

export const metadata: Metadata = {
  title: "Morning Briefing | CogniVit AROS",
  description: "AI-first revenue intelligence and decision briefing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
