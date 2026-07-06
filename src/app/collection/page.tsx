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
        <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Library</h1>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] animate-pulse" />
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
      <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Library</h1>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-[rgba(255,214,170,0.06)]">
          <p className="text-sm text-[#6f6255]">Nothing in your collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl p-2 bg-[#211a14] border border-[rgba(255,214,170,0.09)]"
            >
              {entry.book.coverUrl ? (
                <Image
                  src={entry.book.coverUrl}
                  alt={entry.book.title}
                  width={120}
                  height={170}
                  className="rounded-lg object-cover w-full aspect-[2/3] mb-2"
                  unoptimized
                />
              ) : (
                <div className="rounded-lg bg-white/[0.05] w-full aspect-[2/3] mb-2" />
              )}
              <p className="font-display font-medium text-sm text-[#f4ede1] leading-snug line-clamp-2">
                {entry.book.title}
              </p>
              <p className="text-xs text-[#ab9c8a] truncate mt-0.5">
                {entry.book.authors.join(", ")}
              </p>
              {entry.dateRead && (
                <p className="text-xs text-[#e0984a] mt-1.5">Read {formatDateRead(entry.dateRead)}</p>
              )}
              {entry.review && (
                <p className="text-xs text-[#f4ede1]/80 italic leading-relaxed mt-2 line-clamp-3">
                  &ldquo;{entry.review}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
