"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Image from "next/image";

interface Book {
  isbn13: string;
  volumeId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  rating: number | null;
  publishedYear: number | null;
  pageCount: number | null;
  description: string | null;
}

interface Review {
  quote_text: string;
  attributed_to: string;
  source_name: string;
  source_url?: string;
  source_date?: string;
  verification_status: "unverified" | "verified" | "fake";
}

type SearchState = "idle" | "loading" | "results" | "detail" | "empty" | "error";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsState, setReviewsState] = useState<"idle" | "loading" | "done">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  function triggerEnrichment(volumeId: string) {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/books/${encodeURIComponent(volumeId)}/reviews`);
    esRef.current = es;

    es.addEventListener("reviews", (e) => {
      const data = JSON.parse(e.data);
      setReviews(data.reviews ?? []);
      setReviewsState("done");
      es.close();
    });

    es.addEventListener("error", () => { setReviewsState("done"); es.close(); });
    es.onerror = () => { setReviewsState("done"); es.close(); };
  }

  function openBook(book: Book) {
    setSelectedBook(book);
    setReviews([]);
    setReviewsState("loading");
    setState("detail");
    triggerEnrichment(book.volumeId);
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setState("loading");
    setSelectedBook(null);
    setReviews([]);
    setReviewsState("idle");

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setState("error");
        return;
      }

      const books: Book[] = data.results ?? [];

      if (books.length === 0) {
        setState("empty");
      } else if (books.length === 1) {
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

  function resetToIdle() {
    setState("idle");
    setResults([]);
    setSelectedBook(null);
    setReviews([]);
    setReviewsState("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => () => esRef.current?.close(), []);

  // ── Hero states: idle, loading, empty, error ──────────────────────────
  if (state === "idle" || state === "loading" || state === "empty" || state === "error") {
    return (
      <main
        className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 pb-16"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 70%, rgba(30, 58, 138, 0.28) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 30% 30%, rgba(15, 30, 80, 0.4) 0%, transparent 60%),
            #0d1117
          `,
        }}
      >
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl font-light text-[#e8eaf0] text-center mb-10 tracking-tight leading-snug">
            Find your next great read
          </h1>

          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-3 bg-[#1e2433] border border-[#2a3040] rounded-full px-5 py-3.5 focus-within:border-white/20 focus-within:shadow-lg focus-within:shadow-black/30 transition-all">
              <input
                ref={inputRef}
                type="search"
                autoFocus
                placeholder="Search by title, author, or ISBN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={state === "loading"}
                className="flex-1 bg-transparent border-none outline-none text-base text-[#e8eaf0] placeholder:text-[#9ca3af] disabled:opacity-60"
              />
              {state === "loading" ? (
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#3b5bdb] animate-spin" />
                </div>
              ) : query.trim() ? (
                <button
                  type="submit"
                  className="w-9 h-9 rounded-full bg-[#3b5bdb] hover:bg-[#4c6ef5] flex items-center justify-center transition-all shrink-0"
                  aria-label="Search"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l7-7 7 7M12 3.5v17" />
                  </svg>
                </button>
              ) : null}
            </div>

            {state === "empty" && (
              <p className="text-center text-[#6b7280] text-sm mt-6">
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
          className="text-[#4b5563] hover:text-[#9ca3af] transition text-sm"
          aria-label="New search"
        >
          ←
        </button>
        <p className="text-sm text-[#6b7280]">
          <span className="font-medium text-[#e8eaf0]">{results.length}</span>{" "}
          result{results.length !== 1 ? "s" : ""} for{" "}
          <span className="font-medium text-[#e8eaf0]">&ldquo;{query}&rdquo;</span>
        </p>
        <button
          onClick={resetToIdle}
          className="ml-auto text-xs text-[#4b5563] hover:text-[#9ca3af] transition"
        >
          New search
        </button>
      </div>

      {/* Two-column grid */}
      <div className="md:grid md:grid-cols-[360px_1fr] md:gap-8 md:items-start">

        {/* ── Left panel: results list ── */}
        <div className={showLeft ? "block" : "hidden md:block"}>
          <div className="space-y-2">
            {results.map((book) => (
              <button
                key={book.volumeId}
                onClick={() => openBook(book)}
                className={`w-full flex items-center gap-3 bg-[#1e2433] rounded-xl border p-3 text-left transition shadow-sm ${
                  selectedBook?.volumeId === book.volumeId
                    ? "border-[#3b5bdb]/50 ring-1 ring-[#3b5bdb]/20"
                    : "border-white/[0.08] hover:border-white/15"
                }`}
              >
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    width={44}
                    height={62}
                    className="rounded object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-11 h-[62px] rounded bg-white/[0.06] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[#e8eaf0] truncate">{book.title}</p>
                  <p className="text-xs text-[#6b7280] truncate mt-0.5">{book.authors.join(", ")}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {book.rating && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-white/10 text-[#9ca3af] rounded-full px-2 py-0.5">
                        ★ {book.rating}
                      </span>
                    )}
                    {book.publishedYear && (
                      <span className="text-xs text-[#4b5563]">{book.publishedYear}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel: book detail ── */}
        <div className={showRight ? "block" : "hidden md:block"}>
          {/* Mobile back button */}
          {state === "detail" && results.length > 1 && (
            <button
              onClick={() => setState("results")}
              className="md:hidden text-sm text-[#6b7280] hover:text-[#e8eaf0] mb-4 transition"
            >
              ← Back to results
            </button>
          )}

          {/* Desktop placeholder when no book is selected yet */}
          {!selectedBook && (
            <div className="hidden md:flex items-center justify-center h-64 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <p className="text-sm text-[#374151]">Select a book to see details</p>
            </div>
          )}

          {/* Book detail */}
          {selectedBook && (
            <div>
              {/* Metadata card */}
              <div className="bg-[#1e2433] rounded-2xl border border-white/[0.08] shadow-sm p-5 flex gap-5 mb-6">
                {selectedBook.coverUrl ? (
                  <Image
                    src={selectedBook.coverUrl}
                    alt={selectedBook.title}
                    width={96}
                    height={136}
                    className="rounded-lg object-cover shrink-0 shadow-sm"
                    unoptimized
                  />
                ) : (
                  <div className="w-24 h-[136px] rounded-lg bg-white/[0.06] shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg text-[#e8eaf0] leading-snug mb-1">
                    {selectedBook.title}
                  </h2>
                  <p className="text-sm text-[#9ca3af] mb-3">
                    {selectedBook.authors.join(", ")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedBook.rating && (
                      <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-[#9ca3af] rounded-full px-2.5 py-1">
                        ★ {selectedBook.rating}
                      </span>
                    )}
                    {selectedBook.publishedYear && (
                      <span className="inline-flex items-center text-xs bg-white/10 text-[#9ca3af] rounded-full px-2.5 py-1">
                        {selectedBook.publishedYear}
                      </span>
                    )}
                    {selectedBook.pageCount && (
                      <span className="inline-flex items-center text-xs bg-white/10 text-[#9ca3af] rounded-full px-2.5 py-1">
                        {selectedBook.pageCount} pages
                      </span>
                    )}
                  </div>
                  {selectedBook.description && (
                    <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-4">
                      {selectedBook.description}
                    </p>
                  )}
                </div>
              </div>

              {/* What people say */}
              <h3 className="text-sm font-semibold text-[#6b7280] mb-3">What people say</h3>

              {reviewsState === "loading" && (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-[#1e2433] rounded-xl border border-white/[0.08] p-4 animate-pulse">
                      <div className="h-3 bg-white/[0.08] rounded w-3/4 mb-2" />
                      <div className="h-3 bg-white/[0.08] rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {reviewsState === "done" && reviews.length === 0 && (
                <p className="text-sm text-[#6b7280]">No notable reviews found yet.</p>
              )}

              {reviewsState === "done" && reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.map((r, i) => (
                    <div key={i} className="bg-[#1e2433] rounded-xl border border-white/[0.08] shadow-sm p-4">
                      <p className="text-sm text-[#d1d5db] italic leading-relaxed mb-3">
                        &ldquo;{r.quote_text}&rdquo;
                      </p>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-[#6b7280]">
                          <span className="font-medium text-[#9ca3af]">{r.attributed_to}</span>
                          {r.source_name && r.source_name !== r.attributed_to && (
                            <span>, {r.source_name}</span>
                          )}
                          {r.source_date && <span> · {r.source_date}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.source_url && (
                            <a
                              href={r.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#6b7280] hover:text-[#e8eaf0] underline transition"
                            >
                              Source
                            </a>
                          )}
                          <span className="text-xs text-[#6b7280] bg-white/5 border border-white/[0.08] rounded px-1.5 py-0.5 capitalize">
                            {r.verification_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
