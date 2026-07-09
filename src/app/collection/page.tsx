"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/api-client";
import { Book, BookDetail } from "@/components/book-detail";
import { BookCover } from "@/components/book-cover";

interface CollectionEntry {
  id: string;
  status: "READ" | "FUTURE_READ";
  dateRead: string | null;
  review: string | null;
  book: Book;
}

type LoadState = "loading" | "done" | "error";
type Tab = "READ" | "FUTURE_READ";

const TABS: { id: Tab; label: string; emptyText: string }[] = [
  { id: "READ", label: "My Read", emptyText: "No books read yet." },
  {
    id: "FUTURE_READ",
    label: "Future Read",
    emptyText: "Nothing saved for later yet — browse Explore to add some.",
  },
];

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
  const [tab, setTab] = useState<Tab>("READ");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

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

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedBook(null);
  }

  if (state === "loading") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Collection</h1>
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

  const activeTab = TABS.find((t) => t.id === tab)!;
  const visibleEntries = entries.filter((entry) => entry.status === tab);
  const showGrid = !selectedBook;
  const showDetail = !!selectedBook;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-5">My Collection</h1>

      <div className="flex gap-2 mb-5 border-b border-[rgba(255,214,170,0.09)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-[#e0984a] text-[#f4ede1]"
                : "border-transparent text-[#ab9c8a] hover:text-[#f4ede1]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visibleEntries.length === 0 ? (
        <div className="flex items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-[rgba(255,214,170,0.06)]">
          <p className="text-sm text-[#6f6255]">{activeTab.emptyText}</p>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start">
          {/* ── Left panel: book grid ── */}
          <div className={showGrid ? "block" : "hidden md:block"}>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 custom-scroll md:max-h-[calc(100vh-220px)] md:overflow-y-auto md:pr-1">
              {visibleEntries.map((entry) => {
                const selected = selectedBook?.volumeId === entry.book.volumeId;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedBook(entry.book)}
                    className={`text-left rounded-xl border p-2 transition ${
                      selected
                        ? "bg-[#e0984a]/[0.12] border-[#e0984a]/35"
                        : "bg-[#211a14] border-[rgba(255,214,170,0.09)] hover:bg-[#2a2119] hover:border-[rgba(255,214,170,0.18)]"
                    }`}
                  >
                    <BookCover
                      src={entry.book.coverUrl}
                      alt={entry.book.title}
                      width={120}
                      height={170}
                      className="rounded-lg w-full aspect-[2/3] mb-2"
                    />
                    <p className="font-display font-medium text-sm text-[#f4ede1] leading-snug line-clamp-2">
                      {entry.book.title}
                    </p>
                    <p className="text-xs text-[#ab9c8a] truncate mt-0.5">
                      {entry.book.authors.join(", ")}
                    </p>
                    {entry.dateRead && (
                      <p className="text-xs text-[#e0984a] mt-1.5">Read {formatDateRead(entry.dateRead)}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel: book detail ── */}
          <div className={showDetail ? "block" : "hidden md:block"}>
            {selectedBook && (
              <button
                onClick={() => setSelectedBook(null)}
                className="md:hidden flex items-center gap-1.5 text-sm text-[#ab9c8a] hover:text-[#f4ede1] mb-4 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to {activeTab.label}
              </button>
            )}

            {!selectedBook && (
              <div className="hidden md:flex items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-[rgba(255,214,170,0.06)]">
                <p className="text-sm text-[#6f6255]">Select a book to see details</p>
              </div>
            )}

            {selectedBook && <BookDetail key={selectedBook.volumeId} book={selectedBook} />}
          </div>
        </div>
      )}
    </main>
  );
}
