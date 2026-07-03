"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/collection", label: "Collection" },
];

export function AppNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login" || pathname === "/register") return null;

  function collectionHref() {
    return !user ? "/login?next=/collection" : "/collection";
  }

  function tabHref(tab: (typeof tabs)[number]) {
    return tab.href === "/collection" ? collectionHref() : tab.href;
  }

  function isActive(tab: (typeof tabs)[number]) {
    return (
      pathname === tab.href ||
      (tab.href !== "/" && pathname.startsWith(tab.href))
    );
  }

  return (
    <>
      {/* ── Desktop: top nav ── */}
      <nav className="hidden md:flex fixed top-0 inset-x-0 h-14 bg-[#15110d]/85 backdrop-blur-md border-b border-white/[0.07] z-50 items-center px-6">
        <Link href="/" className="font-display italic text-lg text-[#f4ede1] mr-8 shrink-0">
          hazelnut
        </Link>
        <div className="flex items-center gap-1 flex-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tabHref(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(tab)
                  ? "bg-[#e0984a]/12 text-[#f0c894]"
                  : "text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/[0.06]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#ab9c8a]">{user.username}</span>
              <button
                onClick={logout}
                className="text-sm text-[#6f6255] hover:text-[#f4ede1] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-[#ab9c8a] hover:text-[#f4ede1] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* ── Mobile: bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#15110d]/90 backdrop-blur-md border-t border-white/[0.07] z-50">
        <div className="flex">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tabHref(tab)}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                isActive(tab)
                  ? "text-[#f0c894]"
                  : "text-[#6f6255] hover:text-[#ab9c8a]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
