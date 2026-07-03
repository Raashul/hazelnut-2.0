import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { AppNav } from "@/components/nav";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Hazelnut — Your Personal Library",
  description: "Track what you've read and what you want to read.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-[#0d1117] text-[#e8eaf0] antialiased font-sans">
        <AuthProvider>
          {/* pb-14: space for mobile bottom nav. md:pt-14: space for desktop top nav */}
          <div className="pb-14 md:pb-0 md:pt-14">{children}</div>
          <AppNav />
        </AuthProvider>
      </body>
    </html>
  );
}
