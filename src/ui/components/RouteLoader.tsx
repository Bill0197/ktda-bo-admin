/** Suspense fallback for lazy-loaded routes — a lightweight centered spinner
 * rather than a blank white flash between route chunks. */
export function RouteLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary-600 animate-spin" />
    </div>
  );
}
