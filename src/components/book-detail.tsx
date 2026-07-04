"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export interface Book {
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

export interface Review {
  quote_text: string;
  attributed_to: string;
  source_name: string;
  source_url?: string;
  source_date?: string;
  verification_status: "unverified" | "verified" | "fake";
}

// Metadata card + "What people say" enrichment section, driven by the same
// SSE endpoint used on Home (api/books/[id]/reviews). Callers should render
// this with `key={book.volumeId}` so switching books remounts a fresh
// instance instead of needing to manually reset state on prop change.
export function BookDetail({ book }: { book: Book }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsState, setReviewsState] = useState<"loading" | "done">("loading");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      title: book.title,
      authors: book.authors.join(","),
      ...(book.isbn13 ? { isbn13: book.isbn13 } : {}),
    });
    const es = new EventSource(
      `/api/books/${encodeURIComponent(book.volumeId)}/reviews?${params.toString()}`
    );
    esRef.current = es;

    es.addEventListener("reviews", (e) => {
      const data = JSON.parse(e.data);
      setReviews(data.reviews ?? []);
      setReviewsState("done");
      es.close();
    });
    es.addEventListener("error", () => {
      setReviewsState("done");
      es.close();
    });
    es.onerror = () => {
      setReviewsState("done");
      es.close();
    };

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.volumeId]);

  return (
    <div>
      {/* Metadata card */}
      <div className="bg-[#211a14] rounded-2xl border border-[rgba(255,214,170,0.09)] p-5 flex gap-5 mb-6">
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt={book.title}
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
            {book.title}
          </h2>
          <p className="text-sm text-[#ab9c8a] mb-3">{book.authors.join(", ")}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {book.rating && (
              <span className="inline-flex items-center gap-1 text-xs bg-[#e0984a]/[0.12] text-[#f0c894] rounded-full px-2.5 py-1 font-medium">
                ★ {book.rating}
              </span>
            )}
            {book.publishedYear && (
              <span className="inline-flex items-center text-xs bg-white/5 text-[#ab9c8a] rounded-full px-2.5 py-1">
                {book.publishedYear}
              </span>
            )}
            {book.pageCount && (
              <span className="inline-flex items-center text-xs bg-white/5 text-[#ab9c8a] rounded-full px-2.5 py-1">
                {book.pageCount} pages
              </span>
            )}
          </div>
          {book.description && (
            <p className="text-xs text-[#ab9c8a] leading-relaxed line-clamp-4">{book.description}</p>
          )}
        </div>
      </div>

      {/* What people say */}
      {reviewsState === "loading" && (
        <>
          <h3 className="text-sm font-semibold text-[#ab9c8a] mb-3">What people say</h3>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-[#211a14] rounded-xl border border-[rgba(255,214,170,0.09)] p-4 animate-pulse"
              >
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
                    {r.source_name && r.source_name !== r.attributed_to && <span>, {r.source_name}</span>}
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
  );
}
