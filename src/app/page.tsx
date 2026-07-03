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
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 pb-16">
        <div className="w-full max-w-2xl">
          <h1 className="font-display italic text-4xl font-medium text-[#f4ede1] text-center mb-10 leading-snug pb-1">
            Find your next great read
          </h1>

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
          <span className="font-semibold text-[#f4ede1]">{results.length}</span>{" "}
          result{results.length !== 1 ? "s" : ""} for{" "}
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
                    <div className="w-11 h-[62px] rounded bg-white/[0.05] shrink-0" />
                  )}
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
          {selectedBook && (
            <div>
              {/* Metadata card */}
              <div className="bg-[#211a14] rounded-2xl border border-[rgba(255,214,170,0.09)] p-5 flex gap-5 mb-6">
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
                  <div className="w-24 h-[136px] rounded-lg bg-white/[0.05] shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-display italic font-medium text-xl text-[#f4ede1] leading-snug mb-1">
                    {selectedBook.title}
                  </h2>
                  <p className="text-sm text-[#ab9c8a] mb-3">
                    {selectedBook.authors.join(", ")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedBook.rating && (
                      <span className="inline-flex items-center gap-1 text-xs bg-[#e0984a]/[0.12] text-[#f0c894] rounded-full px-2.5 py-1 font-medium">
                        ★ {selectedBook.rating}
                      </span>
                    )}
                    {selectedBook.publishedYear && (
                      <span className="inline-flex items-center text-xs bg-white/5 text-[#ab9c8a] rounded-full px-2.5 py-1">
                        {selectedBook.publishedYear}
                      </span>
                    )}
                    {selectedBook.pageCount && (
                      <span className="inline-flex items-center text-xs bg-white/5 text-[#ab9c8a] rounded-full px-2.5 py-1">
                        {selectedBook.pageCount} pages
                      </span>
                    )}
                  </div>
                  {selectedBook.description && (
                    <p className="text-xs text-[#ab9c8a] leading-relaxed line-clamp-4">
                      {selectedBook.description}
                    </p>
                  )}
                </div>
              </div>

              {/* What people say — only shown once there's something to show */}
              {reviewsState === "loading" && (
                <>
                  <h3 className="text-sm font-semibold text-[#ab9c8a] mb-3">What people say</h3>
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-[#211a14] rounded-xl border border-[rgba(255,214,170,0.09)] p-4 animate-pulse">
                        <div className="h-3 bg-white/[0.06] rounded w-3/4 mb-2" />
                        <div className="h-3 bg-white/[0.06] rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {reviewsState === "done" && reviews.length === 0 && (
                <p className="text-sm text-[#6f6255]">No notable reviews found yet.</p>
              )}

              {reviewsState === "done" && reviews.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-[#ab9c8a] mb-3">What people say</h3>
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <div key={i} className="bg-[#211a14] rounded-xl border border-[rgba(255,214,170,0.09)] p-4">
                        <p className="text-sm text-[#f4ede1]/90 italic leading-relaxed mb-3">
                          &ldquo;{r.quote_text}&rdquo;
                        </p>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-[#ab9c8a]">
                            <span className="font-medium text-[#f4ede1]/80">{r.attributed_to}</span>
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
                                className="text-xs text-[#ab9c8a] hover:text-[#f4ede1] underline transition"
                              >
                                Source
                              </a>
                            )}
                            <span className="text-xs text-[#ab9c8a] bg-white/5 border border-[rgba(255,214,170,0.09)] rounded px-1.5 py-0.5 capitalize">
                              {r.verification_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
