// Build-time version stamp, injected by vite.config.ts via `define`. It lets
// anyone tell at a glance which commit is deployed and when it went out — the
// whole point of showing it in the UI.
declare const __APP_VERSION__: {
  /** Short commit SHA of the build (or "dev" when built outside a checkout). */
  readonly commit: string;
  /** Branch or tag the build came from, when known. */
  readonly ref: string;
  /** ISO 8601 timestamp of the commit itself. */
  readonly commitTime: string;
  /** ISO 8601 timestamp of when this build was produced (i.e. deployed). */
  readonly builtAt: string;
};

export const APP_VERSION = __APP_VERSION__;

/** `2026-10-13 14:30` from an ISO string; "" when absent. */
function stamp(iso: string): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

/** Short, human-readable label, e.g. `a1b2c3d · deployed 2026-10-13 14:30`. */
export function versionLabel(): string {
  const deployed = stamp(APP_VERSION.builtAt);
  return deployed ? `${APP_VERSION.commit} · deployed ${deployed}` : APP_VERSION.commit;
}

/** Fuller detail for a tooltip. */
export function versionTitle(): string {
  return [
    `commit ${APP_VERSION.commit}`,
    APP_VERSION.ref,
    APP_VERSION.commitTime && `committed ${stamp(APP_VERSION.commitTime)}`,
    APP_VERSION.builtAt && `deployed ${stamp(APP_VERSION.builtAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
