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
        <div className="w-full max-w-xl">
          {/* Wordmark — hidden on desktop where nav shows it */}
          <h1 className="md:hidden text-2xl font-semibold tracking-tight text-stone-900 text-center mb-8">
            Hazelnut
          </h1>

          <p className="text-stone-400 text-sm text-center mb-6">
            Find reviews and details for any book
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2 w-full">
              <input
                ref={inputRef}
                type="search"
                autoFocus
                placeholder="Search by title, author, or ISBN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={state === "loading"}
                className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200/60 transition shadow-sm disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={state === "loading"}
                className="rounded-xl bg-stone-700 text-white px-5 py-3 text-sm font-medium hover:bg-stone-600 disabled:opacity-50 transition shrink-0 shadow-sm"
              >
                Search
              </button>
            </div>

            {/* Loading */}
            {state === "loading" && (
              <div className="flex justify-center mt-8">
                <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin" />
              </div>
            )}

            {/* Empty state */}
            {state === "empty" && (
              <p className="text-center text-stone-400 text-sm mt-8">
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
          className="text-stone-400 hover:text-stone-600 transition text-sm"
          aria-label="New search"
        >
          ←
        </button>
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-800">{results.length}</span>{" "}
          result{results.length !== 1 ? "s" : ""} for{" "}
          <span className="font-medium text-stone-800">&ldquo;{query}&rdquo;</span>
        </p>
        <button
          onClick={resetToIdle}
          className="ml-auto text-xs text-stone-400 hover:text-stone-600 transition"
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
                className={`w-full flex items-center gap-3 bg-stone-50 rounded-xl border p-3 text-left transition shadow-sm ${
                  selectedBook?.volumeId === book.volumeId
                    ? "border-stone-400 ring-1 ring-stone-200"
                    : "border-stone-200/70 hover:border-stone-300 hover:shadow"
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
                  <div className="w-11 h-[62px] rounded bg-stone-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm text-stone-900 truncate">{book.title}</p>
                  <p className="text-xs text-stone-400 truncate mt-0.5">{book.authors.join(", ")}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {book.rating && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">
                        ★ {book.rating}
                      </span>
                    )}
                    {book.publishedYear && (
                      <span className="text-xs text-stone-300">{book.publishedYear}</span>
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
              className="md:hidden text-sm text-stone-400 hover:text-stone-700 mb-4 transition"
            >
              ← Back to results
            </button>
          )}

          {/* Desktop placeholder when no book is selected yet */}
          {!selectedBook && (
            <div className="hidden md:flex items-center justify-center h-64 rounded-2xl bg-stone-50/60 border border-stone-200/40">
              <p className="text-sm text-stone-300">Select a book to see details</p>
            </div>
          )}

          {/* Book detail */}
          {selectedBook && (
            <div>
              {/* Metadata card */}
              <div className="bg-stone-50 rounded-2xl border border-stone-200/70 shadow-sm p-5 flex gap-5 mb-6">
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
                  <div className="w-24 h-[136px] rounded-lg bg-stone-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg text-stone-900 leading-snug mb-1">
                    {selectedBook.title}
                  </h2>
                  <p className="text-sm text-stone-500 mb-3">
                    {selectedBook.authors.join(", ")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedBook.rating && (
                      <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 rounded-full px-2.5 py-1">
                        ★ {selectedBook.rating}
                      </span>
                    )}
                    {selectedBook.publishedYear && (
                      <span className="inline-flex items-center text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1">
                        {selectedBook.publishedYear}
                      </span>
                    )}
                    {selectedBook.pageCount && (
                      <span className="inline-flex items-center text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1">
                        {selectedBook.pageCount} pages
                      </span>
                    )}
                  </div>
                  {selectedBook.description && (
                    <p className="text-xs text-stone-500 leading-relaxed line-clamp-4">
                      {selectedBook.description}
                    </p>
                  )}
                </div>
              </div>

              {/* What people say */}
              <h3 className="text-sm font-semibold text-stone-700 mb-3">What people say</h3>

              {reviewsState === "loading" && (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-stone-50 rounded-xl border border-stone-200/70 p-4 animate-pulse">
                      <div className="h-3 bg-stone-100 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {reviewsState === "done" && reviews.length === 0 && (
                <p className="text-sm text-stone-400">No notable reviews found yet.</p>
              )}

              {reviewsState === "done" && reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.map((r, i) => (
                    <div key={i} className="bg-stone-50 rounded-xl border border-stone-200/60 shadow-sm p-4">
                      <p className="text-sm text-stone-700 italic leading-relaxed mb-3">
                        &ldquo;{r.quote_text}&rdquo;
                      </p>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-stone-400">
                          <span className="font-medium text-stone-500">{r.attributed_to}</span>
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
                              className="text-xs text-stone-400 hover:text-stone-700 underline transition"
                            >
                              Source
                            </a>
                          )}
                          <span className="text-xs text-stone-300 bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5 capitalize">
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
