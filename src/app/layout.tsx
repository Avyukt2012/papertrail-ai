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
        <audio id="bg-music" loop src="/Calm Instrumental Music.mp3" />
        <script dangerouslySetInnerHTML={{__html: `
          document.addEventListener('click', function() {
            var audio = document.getElementById('bg-music');
            if (audio && audio.paused) audio.play();
          }, { once: true });
        `}} />
      </body>
    </html>
  );
}
