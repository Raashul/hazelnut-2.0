"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    login(data.token, data.username, data.userId);
    router.replace("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm md:max-w-md">
        <h1 className="font-display italic text-2xl font-medium text-[#f4ede1] mb-1">
          Hazelnut
        </h1>
        <p className="text-[#ab9c8a] text-sm mb-8">Create your library</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#ab9c8a] mb-1.5" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-[rgba(255,214,170,0.12)] bg-white/5 px-3 py-2 text-sm text-[#f4ede1] placeholder:text-[#6f6255] outline-none focus:border-[#e0984a]/50 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ab9c8a] mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[rgba(255,214,170,0.12)] bg-white/5 px-3 py-2 text-sm text-[#f4ede1] placeholder:text-[#6f6255] outline-none focus:border-[#e0984a]/50 transition"
            />
            <p className="mt-1 text-xs text-[#6f6255]">Minimum 8 characters</p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#e0984a] hover:bg-[#f0ac63] text-[#1a1208] py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#ab9c8a]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#e0984a] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
