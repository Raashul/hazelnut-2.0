"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/api-client";

interface CollectionBook {
  isbn13: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

interface CollectionEntry {
  id: string;
  dateRead: string | null;
  review: string | null;
  book: CollectionBook;
}

type LoadState = "loading" | "done" | "error";

function formatDateRead(dateRead: string): string {
  return new Date(dateRead).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CollectionPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    authFetch("/api/collection", token)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load collection");
        const data = await res.json();
        if (!cancelled) {
          setEntries(data.entries ?? []);
          setState("done");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Collection</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-red-400">Couldn&rsquo;t load your collection. Please try again.</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Collection</h1>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-[rgba(255,214,170,0.06)]">
          <p className="text-sm text-[#6f6255]">Nothing in your collection.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#211a14] rounded-xl border border-[rgba(255,214,170,0.09)] p-4 flex gap-4"
            >
              {entry.book.coverUrl ? (
                <Image
                  src={entry.book.coverUrl}
                  alt={entry.book.title}
                  width={64}
                  height={90}
                  className="rounded-lg object-cover shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-[90px] rounded-lg bg-white/[0.05] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display font-medium text-[15px] text-[#f4ede1] truncate">
                  {entry.book.title}
                </p>
                <p className="text-xs text-[#ab9c8a] truncate mt-0.5">
                  {entry.book.authors.join(", ")}
                </p>
                {entry.dateRead && (
                  <p className="text-xs text-[#e0984a] mt-1.5">Read {formatDateRead(entry.dateRead)}</p>
                )}
                {entry.review && (
                  <p className="text-sm text-[#f4ede1]/80 italic leading-relaxed mt-2">
                    &ldquo;{entry.review}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
