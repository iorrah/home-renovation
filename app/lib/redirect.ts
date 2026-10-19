/**
 * Where to go after logging in. Only same-site paths are accepted, so a crafted link such as
 * /login?next=https://evil.example cannot send users to another site.
 */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/jobs';
}
