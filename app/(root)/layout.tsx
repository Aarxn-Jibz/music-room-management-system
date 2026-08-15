// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import Providers from "../providers";
import ForcePasswordChange from "@/components/ui/ForcePasswordChange";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SWO Kengeri",
  description: "Student Welfare Office Kengeri Campus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <ForcePasswordChange />
        </Providers>
      </body>
    </html>
  );
}
