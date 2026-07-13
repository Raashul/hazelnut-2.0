"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Book, BookDetail } from "@/components/book-detail";
import { BookCover } from "@/components/book-cover";

type SearchState = "idle" | "loading" | "results" | "detail" | "empty" | "error";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openBook(book: Book) {
    setSelectedBook(book);
    setState("detail");
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setState("loading");
    setSelectedBook(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setState("error");
        return;
      }

      const books: Book[] = data.results ?? [];
      setTotal(data.total ?? books.length);

      if (books.length === 0) {
        setState("empty");
      } else if (books.length === 1 && (data.total ?? books.length) === 1) {
        setResults(books);
        openBook(books[0]);
      } else {
        setResults(books);
        setState("results");
      }
    } catch {
      setState("error");
    }
  }

  async function loadMoreResults() {
    if (!query.trim() || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&offset=${results.length}`
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setResults((prev) => [...prev, ...((data.results ?? []) as Book[])]);
        setTotal(data.total ?? results.length);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function resetToIdle() {
    setState("idle");
    setQuery("");
    setResults([]);
    setTotal(0);
    setSelectedBook(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => {
    window.addEventListener("hazelnut:reset-home", resetToIdle);
    return () => window.removeEventListener("hazelnut:reset-home", resetToIdle);
  }, []);

  // ── Hero states: idle, loading, empty, error ──────────────────────────
  if (state === "idle" || state === "loading" || state === "empty" || state === "error") {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 pb-16">
        <div className="w-full max-w-2xl">
          <h1 className="font-display italic text-4xl font-medium text-[#f4ede1] text-center leading-snug pb-1">
            Your digital Library
          </h1>
          <h4 className="font-display italic text-2xl font-medium text-[#f4ede1] text-center mb-10 leading-snug pb-1">
            Find your next read
          </h4>


          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-3 bg-[#211a14] border border-[rgba(255,214,170,0.09)] rounded-full px-5 py-3.5 focus-within:border-[rgba(255,214,170,0.25)] focus-within:shadow-lg focus-within:shadow-black/30 transition-all">
              <input
                ref={inputRef}
                type="search"
                autoFocus
                placeholder="Search by title, author, or ISBN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={state === "loading"}
                className="flex-1 bg-transparent border-none outline-none text-base text-[#f4ede1] placeholder:text-[#6f6255] disabled:opacity-60"
              />
              {state === "loading" ? (
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-[#e0984a] animate-spin" />
                </div>
              ) : query.trim() ? (
                <button
                  type="submit"
                  className="w-9 h-9 rounded-full bg-[#e0984a] hover:bg-[#f0ac63] flex items-center justify-center transition-all shrink-0"
                  aria-label="Search"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1a1208" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l7-7 7 7M12 3.5v17" />
                  </svg>
                </button>
              ) : null}
            </div>

            {state === "empty" && (
              <p className="text-center text-[#ab9c8a] text-sm mt-6">
                No books found for &ldquo;{query}&rdquo;
              </p>
            )}

            {/* Error state */}
            {state === "error" && (
              <p className="text-center text-red-400 text-sm mt-8">
                Something went wrong searching for &ldquo;{query}&rdquo;. Please try again.
              </p>
            )}
          </form>
        </div>
      </main>
    );
  }

  // ── Results / Detail: two-column layout ───────────────────────────────
  const showLeft = state !== "detail";
  const showRight = state === "detail";

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* Results header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={resetToIdle}
          className="w-8 h-8 -ml-1.5 rounded-full flex items-center justify-center text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/5 transition shrink-0"
          aria-label="New search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-sm text-[#ab9c8a]">
          <span className="font-semibold text-[#f4ede1]">{results.length}</span>
          {total > results.length && (
            <>
              {" "}of <span className="font-semibold text-[#f4ede1]">{total}</span>
            </>
          )}{" "}
          result{total !== 1 ? "s" : ""} for{" "}
          <span className="font-semibold text-[#f4ede1]">&ldquo;{query}&rdquo;</span>
        </p>
        <button
          onClick={resetToIdle}
          className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 text-[#ab9c8a] hover:text-[#f4ede1] transition"
        >
          New search
        </button>
      </div>

      {/* Two-column grid */}
      <div className="md:grid md:grid-cols-[360px_1fr] md:gap-8 md:items-start">

        {/* ── Left panel: results list (scrolls independently of the page/detail panel) ── */}
        <div className={showLeft ? "block" : "hidden md:block"}>
          <div className="custom-scroll space-y-2 md:max-h-[calc(100vh-160px)] md:overflow-y-auto md:pr-1">
            {results.map((book) => {
              const selected = selectedBook?.volumeId === book.volumeId;
              return (
                <button
                  key={book.volumeId}
                  onClick={() => openBook(book)}
                  className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected
                      ? "bg-[#e0984a]/[0.12] border-[#e0984a]/35"
                      : "bg-[#211a14] border-[rgba(255,214,170,0.09)] hover:bg-[#2a2119] hover:border-[rgba(255,214,170,0.18)]"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-[#e0984a]" />
                  )}
                  <BookCover
                    src={book.coverUrl}
                    alt={book.title}
                    width={44}
                    height={62}
                    className="w-11 h-[62px] rounded"
                  />
                  <div className="min-w-0">
                    <p className="font-display font-medium text-[15px] text-[#f4ede1] truncate">{book.title}</p>
                    <p className="text-xs text-[#ab9c8a] truncate mt-0.5">{book.authors.join(", ")}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {book.rating && (
                        <span className="inline-flex items-center gap-0.5 text-xs bg-[#e0984a]/[0.12] text-[#f0c894] rounded-full px-2 py-0.5 font-medium">
                          ★ {book.rating}
                        </span>
                      )}
                      {book.publishedYear && (
                        <span className="text-xs text-[#6f6255]">{book.publishedYear}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {total > results.length && (
            <button
              onClick={loadMoreResults}
              disabled={loadingMore}
              className="mt-3 w-full text-sm font-medium py-2.5 rounded-xl bg-white/5 text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/[0.08] transition disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "See more"}
            </button>
          )}
        </div>

        {/* ── Right panel: book detail ── */}
        <div className={showRight ? "block" : "hidden md:block"}>
          {/* Mobile back button */}
          {state === "detail" && results.length > 1 && (
            <button
              onClick={() => setState("results")}
              className="md:hidden flex items-center gap-1.5 text-sm text-[#ab9c8a] hover:text-[#f4ede1] mb-4 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to results
            </button>
          )}

          {/* Desktop placeholder when no book is selected yet */}
          {!selectedBook && (
            <div className="hidden md:flex items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-[rgba(255,214,170,0.06)]">
              <p className="text-sm text-[#6f6255]">Select a book to see details</p>
            </div>
          )}

          {/* Book detail */}
          {selectedBook && <BookDetail key={selectedBook.volumeId} book={selectedBook} />}
        </div>

      </div>
    </main>
  );
}
