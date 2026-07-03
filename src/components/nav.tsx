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
      <nav className="hidden md:flex fixed top-0 inset-x-0 h-14 bg-[#0d1117]/85 backdrop-blur-md border-b border-white/[0.07] z-50 items-center px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-[#e8eaf0] mr-8 shrink-0">
          Hazelnut
        </Link>
        <div className="flex items-center gap-1 flex-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tabHref(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(tab)
                  ? "bg-white/10 text-[#e8eaf0]"
                  : "text-[#6b7280] hover:text-[#e8eaf0] hover:bg-white/[0.06]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#6b7280]">{user.username}</span>
              <button
                onClick={logout}
                className="text-sm text-[#4b5563] hover:text-[#e8eaf0] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-[#9ca3af] hover:text-[#e8eaf0] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* ── Mobile: bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#0d1117]/90 backdrop-blur-md border-t border-white/[0.07] z-50">
        <div className="flex">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tabHref(tab)}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                isActive(tab)
                  ? "text-[#e8eaf0]"
                  : "text-[#4b5563] hover:text-[#9ca3af]"
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
