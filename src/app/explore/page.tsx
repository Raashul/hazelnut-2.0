"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";

interface PreviewBook {
  volumeId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  rating: number | null;
}

interface GenreRow {
  slug: string;
  label: string;
  bookCount: number;
  books: PreviewBook[];
}

type LoadState = "loading" | "done" | "error";

export default function ExplorePage() {
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explore")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setGenres(data.genres ?? []);
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="max-w-[1280px] mx-auto px-4 py-8">
      <h1 className="font-display italic text-3xl font-medium text-[#f4ede1] mb-1">Explore</h1>
      <p className="text-sm text-[#ab9c8a] mb-8">New collection to browse every week!</p>

      {state === "loading" && <LoadingSkeleton />}
      {state === "error" && (
        <p className="text-sm text-red-400">Couldn&rsquo;t load genres. Please try again.</p>
      )}
      {state === "done" && genres.map((genre) => (
        <GenreSection key={genre.slug} genre={genre} />
      ))}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-5 w-32 rounded bg-[#211a14] animate-pulse mb-4" />
          <div className="flex gap-3">
            {Array.from({ length: 7 }).map((_, j) => (
              <div
                key={j}
                className="flex-none w-[130px] aspect-[2/3] rounded-xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GenreSection({ genre }: { genre: GenreRow }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-display text-[19px] font-medium text-[#f4ede1]">{genre.label}</h2>
        <span className="text-xs text-[#6f6255]">{genre.bookCount} book{genre.bookCount !== 1 ? "s" : ""}</span>
        <Link
          href={`/explore/${genre.slug}`}
          className="ml-auto text-xs text-[#e0984a] hover:text-[#f0c894] transition-colors shrink-0"
        >
          See all →
        </Link>
      </div>

      {/* scroll container — extra vertical padding so scaled cards aren't clipped */}
      <div className="flex gap-3 overflow-x-auto py-3 -my-3 scrollbar-none">

        {genre.books.map((book) => (
          <BookCard key={book.volumeId} book={book} genreSlug={genre.slug} />
        ))}

        {/* Show More card */}
        <Link
          href={`/explore/${genre.slug}`}
          className="
            flex-none w-[110px] self-stretch min-h-[195px]
            rounded-xl border border-[rgba(255,214,170,0.18)]
            bg-[rgba(255,214,170,0.03)]
            hover:bg-[rgba(255,214,170,0.07)] hover:border-[rgba(255,214,170,0.32)]
            flex flex-col items-center justify-center gap-2.5
            transition-all duration-200 group
          "
        >
          <div className="
            w-9 h-9 rounded-full border border-[#e0984a]
            flex items-center justify-center text-[#e0984a]
            group-hover:bg-[rgba(224,152,74,0.12)] transition-colors
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <span className="text-[11px] font-medium text-[#e0984a] text-center leading-tight">
            Show<br />More
          </span>
        </Link>
      </div>
    </section>
  );
}

function BookCard({ book, genreSlug }: { book: PreviewBook; genreSlug: string }) {
  return (
    <Link
      href={`/explore/${genreSlug}`}
      className="
        flex-none w-[130px] cursor-pointer rounded-xl p-2
        bg-[#211a14] border border-[rgba(255,214,170,0.09)]
        hover:bg-[#2a2119] hover:border-[rgba(255,214,170,0.25)]
        hover:scale-[1.09] hover:-translate-y-1
        hover:shadow-[0_12px_36px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,214,170,0.18)]
        transition-all duration-200 relative z-0 hover:z-10
      "
    >
      <BookCover
        src={book.coverUrl}
        alt={book.title}
        width={114}
        height={171}
        className="rounded-lg w-full aspect-[2/3] mb-2"
      />
      <p className="text-[12px] font-medium text-[#f4ede1] leading-snug line-clamp-2 mb-0.5">
        {book.title}
      </p>
      <p className="text-[11px] text-[#ab9c8a] truncate mb-1">
        {book.authors.join(", ")}
      </p>
      {book.rating && (
        <span className="text-[11px] text-[#f0c894]">★ {book.rating}</span>
      )}
    </Link>
  );
}
