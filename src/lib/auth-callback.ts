import { sanitizeNextPath } from "./auth";

export function getLandingAuthCallbackDestination({ pathname, search, hash }: { pathname: string; search: string; hash: string }): string | null {
  if (pathname !== "/") return null;
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const hasCallback = Boolean(query.get("code")) || Boolean(fragment.get("access_token") && fragment.get("refresh_token"));
  if (!hasCallback) return null;
  const destination = sanitizeNextPath(query.get("next"));
  if (fragment.get("type") === "recovery") return `/login?next=${encodeURIComponent(destination)}&mode=update-password`;
  return destination;
}
