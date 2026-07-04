"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Book, BookDetail } from "@/components/book-detail";

type LoadState = "loading" | "done" | "error" | "not-found";

export default function GenreDetailPage() {
  const params = useParams<{ genre: string }>();
  // Remount on genre change instead of manually resetting state in an
  // effect (see BookDetail's key usage for the same pattern).
  return <GenreDetail key={params.genre} genreSlug={params.genre} />;
}

function GenreDetail({ genreSlug }: { genreSlug: string }) {
  const [genreLabel, setGenreLabel] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/explore/${encodeURIComponent(genreSlug)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState("not-found");
          return;
        }
        const data = await res.json();
        setGenreLabel(data.genre?.label ?? genreSlug);
        setBooks(data.books ?? []);
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [genreSlug]);

  if (state === "loading") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (state === "not-found") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-[#ab9c8a]">Unknown genre.</p>
        <Link href="/explore" className="text-sm text-[#e0984a] hover:underline mt-2 inline-block">
          Back to Explore
        </Link>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-red-400">Couldn&rsquo;t load this genre. Please try again.</p>
      </main>
    );
  }

  const showGrid = !selectedBook;
  const showDetail = !!selectedBook;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/explore"
          className="w-8 h-8 -ml-1.5 rounded-full flex items-center justify-center text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/5 transition shrink-0"
          aria-label="Back to Explore"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-display italic text-2xl font-medium text-[#f4ede1]">{genreLabel}</h1>
      </div>

      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start">
        {/* ── Left panel: book grid ── */}
        <div className={showGrid ? "block" : "hidden md:block"}>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 custom-scroll md:max-h-[calc(100vh-160px)] md:overflow-y-auto md:pr-1">
            {books.map((book) => {
              const selected = selectedBook?.volumeId === book.volumeId;
              return (
                <button
                  key={book.volumeId}
                  onClick={() => setSelectedBook(book)}
                  className={`text-left rounded-xl border p-2 transition ${
                    selected
                      ? "bg-[#e0984a]/[0.12] border-[#e0984a]/35"
                      : "bg-[#211a14] border-[rgba(255,214,170,0.09)] hover:bg-[#2a2119] hover:border-[rgba(255,214,170,0.18)]"
                  }`}
                >
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={book.title}
                      width={120}
                      height={170}
                      className="rounded-lg object-cover w-full aspect-[2/3] mb-2"
                      unoptimized
                    />
                  ) : (
                    <div className="rounded-lg bg-white/[0.05] w-full aspect-[2/3] mb-2" />
                  )}
                  <p className="font-display font-medium text-sm text-[#f4ede1] truncate">{book.title}</p>
                  <p className="text-xs text-[#ab9c8a] truncate mt-0.5">{book.authors.join(", ")}</p>
                  {book.rating && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-[#f0c894] mt-1">
                      ★ {book.rating}
                    </span>
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
              Back to {genreLabel}
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
    </main>
  );
}
