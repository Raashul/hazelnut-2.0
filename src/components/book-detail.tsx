"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/api-client";
import { BookCover } from "@/components/book-cover";

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

function formatDateRead(dateRead: string): string {
  return new Date(dateRead).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Metadata card + "What people say" enrichment section, driven by the same
// SSE endpoint used on Home (api/books/[id]/reviews). Callers should render
// this with `key={book.volumeId}` so switching books remounts a fresh
// instance instead of needing to manually reset state on prop change.
export function BookDetail({ book }: { book: Book }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsState, setReviewsState] = useState<"loading" | "done">("loading");
  const esRef = useRef<EventSource | null>(null);

  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"READ" | "FUTURE_READ" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateRead, setDateRead] = useState("");
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savingFutureRead, setSavingFutureRead] = useState(false);
  const [futureReadError, setFutureReadError] = useState("");

  const [noteDateRead, setNoteDateRead] = useState<string | null>(null);
  const [noteReview, setNoteReview] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState(false);
  const [editDateRead, setEditDateRead] = useState("");
  const [editReview, setEditReview] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;
    authFetch(`/api/collection/${encodeURIComponent(book.isbn13)}`, token)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStatus(data.status ?? null);
          setNoteDateRead(data.dateRead ?? null);
          setNoteReview(data.review ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [book.isbn13, user, token]);

  function openNoteEdit() {
    setEditDateRead(noteDateRead ? noteDateRead.slice(0, 10) : "");
    setEditReview(noteReview ?? "");
    setNoteError("");
    setNoteEditing(true);
  }

  async function handleSaveNote() {
    setNoteSaving(true);
    setNoteError("");
    try {
      const res = await authFetch(`/api/collection/${encodeURIComponent(book.isbn13)}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRead: editDateRead || null,
          review: editReview || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNoteError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const data = await res.json();
      setNoteDateRead(data.entry?.dateRead ?? null);
      setNoteReview(data.entry?.review ?? null);
      setNoteEditing(false);
    } catch {
      setNoteError("Something went wrong. Please try again.");
    } finally {
      setNoteSaving(false);
    }
  }

  function handleAddClick() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setModalOpen(true);
  }

  async function handleSaveToCollection() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await authFetch("/api/collection", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn13: book.isbn13,
          volumeId: book.volumeId,
          title: book.title,
          authors: book.authors,
          coverUrl: book.coverUrl,
          rating: book.rating,
          publishedYear: book.publishedYear,
          pageCount: book.pageCount,
          description: book.description,
          status: "READ",
          dateRead: dateRead || null,
          review: review || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const data = await res.json();
      setStatus("READ");
      setNoteDateRead(data.entry?.dateRead ?? null);
      setNoteReview(data.entry?.review ?? null);
      setModalOpen(false);
      setDateRead("");
      setReview("");
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToFutureRead() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setSavingFutureRead(true);
    setFutureReadError("");
    try {
      const res = await authFetch("/api/collection", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn13: book.isbn13,
          volumeId: book.volumeId,
          title: book.title,
          authors: book.authors,
          coverUrl: book.coverUrl,
          rating: book.rating,
          publishedYear: book.publishedYear,
          pageCount: book.pageCount,
          description: book.description,
          status: "FUTURE_READ",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFutureReadError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("FUTURE_READ");
    } catch {
      setFutureReadError("Something went wrong. Please try again.");
    } finally {
      setSavingFutureRead(false);
    }
  }

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
      <div className="bg-[#211a14] rounded-2xl border border-[rgba(255,214,170,0.09)] p-5 mb-6">
        <div className="flex justify-end mb-3">
          {status === "READ" && (
            <button
              aria-label="Already in your collection"
              title="Already in your collection"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[#e0984a]/[0.15] text-[#e0984a] cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
              </svg>
            </button>
          )}
          {status === "FUTURE_READ" && (
            <button
              aria-label="Saved for later — in your Future Read list"
              title="Saved for later — in your Future Read list"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.08] text-[#ab9c8a] cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
              </svg>
            </button>
          )}
          {status === null && (
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#ab9c8a] hover:text-[#f4ede1] text-xs font-medium pl-2.5 pr-3 py-2 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
              </svg>
              Add to my Library
            </button>
          )}
        </div>
        <div className="flex gap-5">
          <BookCover
            src={book.coverUrl}
            alt={book.title}
            width={96}
            height={136}
            className="w-24 h-[136px] rounded-lg shadow-sm"
          />
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
          </div>
        </div>

        {status === null && (
          <div className="mt-4 pt-4 border-t border-[rgba(255,214,170,0.09)]">
            <button
              onClick={handleAddToFutureRead}
              disabled={savingFutureRead}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#ab9c8a] hover:text-[#f4ede1] text-xs font-medium pl-2.5 pr-3 py-2 transition disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
              {savingFutureRead ? "Saving…" : "Add to my Future Read"}
            </button>
            {futureReadError && <p className="text-xs text-red-400 mt-2">{futureReadError}</p>}
          </div>
        )}
      </div>

      {/* What you thought of this book */}
      {status === "READ" && (
        <div className="bg-[#211a14] rounded-2xl border border-[#e0984a]/25 p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#f0c894] mb-3">What you thought of this book</h3>

          {!noteEditing && !noteReview && !noteDateRead && (
            <>
              <p className="text-sm text-[#6f6255] italic mb-3">You haven&rsquo;t added a note for this book yet.</p>
              <button
                onClick={openNoteEdit}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#e0984a] hover:bg-[#f0ac63] text-[#1a1208] text-xs font-medium pl-2.5 pr-3 py-2 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
                Add your thoughts
              </button>
            </>
          )}

          {!noteEditing && (noteReview || noteDateRead) && (
            <>
              <div className="flex items-start justify-between gap-3">
                {noteDateRead ? (
                  <p className="text-xs text-[#e0984a] font-medium mb-2">Read {formatDateRead(noteDateRead)}</p>
                ) : (
                  <span />
                )}
                <button
                  onClick={openNoteEdit}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-[#ab9c8a] hover:text-[#f4ede1] transition"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z" />
                  </svg>
                  Edit
                </button>
              </div>
              {noteReview && (
                <p className="text-sm text-[#f4ede1]/90 italic leading-relaxed">&ldquo;{noteReview}&rdquo;</p>
              )}
            </>
          )}

          {noteEditing && (
            <>
              <label className="block text-xs font-medium text-[#ab9c8a] mb-1.5" htmlFor="noteDateRead">
                Date read
              </label>
              <input
                id="noteDateRead"
                type="date"
                value={editDateRead}
                onChange={(e) => setEditDateRead(e.target.value)}
                className="w-full mb-4 rounded-lg bg-white/5 border border-[rgba(255,214,170,0.12)] px-3 py-2 text-sm text-[#f4ede1] outline-none focus:border-[#e0984a]/50 transition"
              />

              <label className="block text-xs font-medium text-[#ab9c8a] mb-1.5" htmlFor="noteReview">
                Your note
              </label>
              <textarea
                id="noteReview"
                rows={5}
                value={editReview}
                onChange={(e) => setEditReview(e.target.value)}
                placeholder="What did you think?"
                className="w-full mb-4 rounded-lg bg-white/5 border border-[rgba(255,214,170,0.12)] px-3 py-2 text-sm text-[#f4ede1] placeholder:text-[#6f6255] outline-none focus:border-[#e0984a]/50 transition resize-none"
              />

              {noteError && <p className="text-sm text-red-400 mb-3">{noteError}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setNoteEditing(false)}
                  disabled={noteSaving}
                  className="px-4 py-2 rounded-full text-sm text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/5 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-[#e0984a] hover:bg-[#f0ac63] text-[#1a1208] transition disabled:opacity-50"
                >
                  {noteSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* What people say */}
      {reviewsState === "loading" && (
        <>
          <h3 className="text-sm font-semibold text-[#ab9c8a] mb-3">What people have said</h3>
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
          <h3 className="text-sm font-semibold text-[#ab9c8a] mb-3">What people have said</h3>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#211a14] border border-[rgba(255,214,170,0.12)] rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display italic text-lg text-[#f4ede1] mb-1">Add to my Library</h3>
            <p className="text-xs text-[#ab9c8a] mb-4">{book.title} — both fields are optional.</p>

            <label className="block text-xs font-medium text-[#ab9c8a] mb-1.5" htmlFor="dateRead">
              Date read
            </label>
            <input
              id="dateRead"
              type="date"
              value={dateRead}
              onChange={(e) => setDateRead(e.target.value)}
              className="w-full mb-4 rounded-lg bg-white/5 border border-[rgba(255,214,170,0.12)] px-3 py-2 text-sm text-[#f4ede1] outline-none focus:border-[#e0984a]/50 transition"
            />

            <label className="block text-xs font-medium text-[#ab9c8a] mb-1.5" htmlFor="review">
              Your review
            </label>
            <textarea
              id="review"
              rows={3}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="What did you think?"
              className="w-full mb-4 rounded-lg bg-white/5 border border-[rgba(255,214,170,0.12)] px-3 py-2 text-sm text-[#f4ede1] placeholder:text-[#6f6255] outline-none focus:border-[#e0984a]/50 transition resize-none"
            />

            {saveError && <p className="text-sm text-red-400 mb-3">{saveError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-full text-sm text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToCollection}
                disabled={saving}
                className="px-4 py-2 rounded-full text-sm font-medium bg-[#e0984a] hover:bg-[#f0ac63] text-[#1a1208] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
