/** Where the API runs. NEXT_PUBLIC_ variables are inlined into the browser bundle at build time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
