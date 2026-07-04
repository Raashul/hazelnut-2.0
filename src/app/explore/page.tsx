"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Genre {
  slug: string;
  label: string;
  bookCount: number;
}

type LoadState = "loading" | "done" | "error";

export default function ExplorePage() {
  const [genres, setGenres] = useState<Genre[]>([]);
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

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display italic text-3xl font-medium text-[#f4ede1] mb-2">Explore</h1>
      <p className="text-sm text-[#ab9c8a] mb-8">Browse the best books by genre.</p>

      {state === "loading" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] animate-pulse"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="text-sm text-red-400">Couldn&rsquo;t load genres. Please try again.</p>
      )}

      {state === "done" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {genres.map((genre) => (
            <Link
              key={genre.slug}
              href={`/explore/${genre.slug}`}
              className="group h-28 rounded-2xl bg-[#211a14] border border-[rgba(255,214,170,0.09)] hover:border-[rgba(255,214,170,0.25)] hover:bg-[#2a2119] transition-all p-4 flex flex-col justify-between"
            >
              <span className="font-display font-medium text-lg text-[#f4ede1] group-hover:text-[#f0c894] transition-colors">
                {genre.label}
              </span>
              <span className="text-xs text-[#6f6255]">
                {genre.bookCount} book{genre.bookCount !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
