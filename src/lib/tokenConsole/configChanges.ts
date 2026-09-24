/* Maker-checker for product configuration (/api/accounting/config/changes).
   =====================================================================
   A controlled write is staged as a change request; it takes effect only when
   a different person with a checker role approves it, and the engine then
   replays the stored payload through the same service method the direct
   endpoint uses. Rejections carry a note. Nothing here is ever deleted.

   Hand-written from ConfigChangeController / MakerCheckerService in
   baracel-dev/tokenization-project (merged 2026-09-24): UAT's /v3/api-docs
   did not carry these yet when this was written, so types.gen.ts has no
   ChangeView. Replace with the generated types once it does.
   ===================================================================== */

import type { CreateProductLimitRequest, CreateProductRequest, CreateTariffValueRequest } from "./types.gen";

export type ChangeType =
  | "PRODUCT_CREATE"
  | "PRODUCT_ACTIVATE"
  | "PRODUCT_DEACTIVATE"
  | "TARIFF_VALUE_CREATE"
  | "PRODUCT_LIMIT_CREATE";

/** Only PENDING moves; every other status is final. FAILED means the checker
 *  approved but the engine refused the replay (a stale payload): nothing applied. */
export type ChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "FAILED";

/** The payload each change type carries — the same body its direct endpoint takes. */
export type ChangePayload = {
  PRODUCT_CREATE: CreateProductRequest;
  PRODUCT_ACTIVATE: { productId: string };
  PRODUCT_DEACTIVATE: { productId: string };
  TARIFF_VALUE_CREATE: CreateTariffValueRequest;
  PRODUCT_LIMIT_CREATE: CreateProductLimitRequest;
};

/** ConfigChangeController.ChangeView. `targetId` is the product id (or null for
 *  a tariff value, whose id exists only once applied). */
export interface ConfigChange {
  requestId: string;
  changeType: ChangeType;
  targetId?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status: ChangeStatus;
  maker?: string | null;
  madeAt?: string | null;
  checker?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  appliedAt?: string | null;
  error?: string | null;
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  PRODUCT_CREATE: "New product",
  PRODUCT_ACTIVATE: "Activate product",
  PRODUCT_DEACTIVATE: "Deactivate product",
  TARIFF_VALUE_CREATE: "New rate",
  PRODUCT_LIMIT_CREATE: "Product limit",
};

/** `accounting.maker-checker.checker-roles` on the engine. The engine is the
 *  authority — this only decides whether to offer the buttons. */
export const CHECKER_ROLES = ["ADMIN", "ACCOUNTANT"] as const;

export function canCheck(roles: readonly string[] | undefined): boolean {
  return !!roles?.some((r) => (CHECKER_ROLES as readonly string[]).includes(r.toUpperCase()));
}

/** Emails are compared the way the engine compares them: case-insensitively. */
export function isMaker(change: Pick<ConfigChange, "maker">, email: string | undefined): boolean {
  return !!email && !!change.maker && change.maker.toLowerCase() === email.toLowerCase();
}

/** Pending requests aimed at one product, optionally of given types — so a
 *  screen can say "already awaiting approval" instead of staging a duplicate. */
export function pendingFor(changes: ConfigChange[] | null | undefined, productId: string, types?: ChangeType[]): ConfigChange[] {
  return (changes ?? []).filter(
    (c) => c.status === "PENDING" && c.targetId === productId && (!types || types.includes(c.changeType)),
  );
}
