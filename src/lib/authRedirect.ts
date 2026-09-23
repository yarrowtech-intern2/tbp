const isSafeNextPath = (path: string | null | undefined): path is string => {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.startsWith('/login') || path.startsWith('/signup')) return false;
  return true;
};

/**
 * Builds a /login path carrying `next` so the auth flow can return the user
 * to whatever page/action triggered the login requirement.
 */
export const buildLoginPath = (target?: string): string => {
  const candidate = target ?? (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '');
  if (!isSafeNextPath(candidate)) return '/login';
  return `/login?next=${encodeURIComponent(candidate)}`;
};

/** Reads and validates the `next` param off a /login (or /signup) location.search. */
export const getSafeNextPath = (search: string, fallback: string): string => {
  const next = new URLSearchParams(search).get('next');
  return isSafeNextPath(next) ? next : fallback;
};
