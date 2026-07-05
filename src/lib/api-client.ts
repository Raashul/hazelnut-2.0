// Thin wrapper for calling authenticated API routes from client components.
// Pass the token from useAuth() — kept explicit rather than reading
// localStorage here so this stays testable and framework-agnostic.
export async function authFetch(
  input: string,
  token: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
