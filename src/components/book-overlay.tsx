"use client";

import { useEffect, useRef, useState } from "react";
import { Book, BookDetail } from "@/components/book-detail";

// Side panel (full-screen on mobile) that shows book details on top of the
// underlying page without navigating away. Switching books while open just
// swaps the content with a brief fade instead of closing/reopening.
// Clicking elsewhere on the page closes the panel (per design), but clicking
// another book card must swap the panel content instead — so the dimmed
// backdrop is visual only (pointer-events-none) and "click outside to close"
// is done via a document listener that explicitly ignores book-card clicks,
// rather than a click-catching div that would block them.
export function BookOverlay({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const [displayed, setDisplayed] = useState<Book | null>(book);
  const [fading, setFading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!book) {
      setDisplayed(null);
      return;
    }
    if (!displayed || displayed.volumeId === book.volumeId) {
      setDisplayed(book);
      return;
    }
    setFading(true);
    const timer = setTimeout(() => {
      setDisplayed(book);
      setFading(false);
    }, 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  useEffect(() => {
    if (!book) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-explore-book-card]")) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [book, onClose]);

  if (!book || !displayed) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 pointer-events-none" aria-hidden="true" />
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-[60] w-full md:w-[420px] bg-[#171009] border-l border-[rgba(255,214,170,0.09)] overflow-y-auto custom-scroll shadow-[-12px_0_36px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-[#171009]/95 backdrop-blur border-b border-[rgba(255,214,170,0.09)] z-10">
          <span className="text-xs uppercase tracking-wide text-[#6f6255]">Book details</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#ab9c8a] hover:text-[#f4ede1] hover:bg-white/5 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div
          key={displayed.volumeId}
          className={`p-5 transition-opacity duration-150 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          <BookDetail book={displayed} />
        </div>
      </div>
    </>
  );
}
