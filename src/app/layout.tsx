import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pundit — Daily Football Guessing Game",
  description:
    "Guess the football player from their career path. A new puzzle every day.",
  openGraph: {
    title: "Pundit — Daily Football Guessing Game",
    description: "Guess the football player from their career path.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
