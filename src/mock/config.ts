/** Every mock fetch function in this folder respects VITE_USE_MOCK.
 *  Default is true (mock) so `npm run dev` works with zero setup.
 *  Set VITE_USE_MOCK=false once a real backend service exists for an app —
 *  the fetch functions below are the seam where a real `fetch(...)` call
 *  replaces the fixture lookup, one function at a time. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export function latency(min = 280, max = 700) {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn}: VITE_USE_MOCK=false but no real backend is wired yet.`);
    this.name = "NotImplementedError";
  }
}
