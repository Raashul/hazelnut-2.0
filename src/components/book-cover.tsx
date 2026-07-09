"use client";

import { useState } from "react";
import Image from "next/image";

interface BookCoverProps {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export function BookCover({ src, alt, width, height, className = "" }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-white/[0.05] shrink-0 ${className}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-1/3 h-1/3 text-[#ab9c8a]/50"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z"
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`object-cover shrink-0 ${className}`}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
