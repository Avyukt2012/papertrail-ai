import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "PaperTrail AI",
  description: "Research assistant for your existing Notion notes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
        <audio autoPlay loop src="/Calm Instrumental Music.mp3" />
      </body>
    </html>
  );
}
