import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { AppNav } from "@/components/nav";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Hazelnut — Your Personal Library",
  description: "Track what you've read and what you want to read.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full bg-[#15110d] text-[#f4ede1] antialiased font-sans">
        <AuthProvider>
          {/* pb-14: space for mobile bottom nav. md:pt-14: space for desktop top nav */}
          <div className="pb-14 md:pb-0 md:pt-14">{children}</div>
          <AppNav />
        </AuthProvider>
      </body>
    </html>
  );
}
