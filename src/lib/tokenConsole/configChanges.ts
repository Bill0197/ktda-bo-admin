/* Maker-checker for configuration (/api/accounting/config/changes).
   =====================================================================
   A controlled write is staged as a change request; it takes effect only when
   a different person with a checker role approves it, and the engine then
   replays the stored payload through the same service method the direct
   endpoint uses. Rejections carry a note. Nothing here is ever deleted.

   Covers products (create, activate, deactivate, limits, coupon tariff),
   tariffs (domains, types, values), service packages and their items,
   schemes and their account templates, and an institution's default tariff
   domain. The direct endpoints for these answer 202 with the same change
   request, so the console always stages here instead.

   Hand-written from ConfigChangeController / MakerCheckerService in
   baracel-dev/tokenization-project; the type list matches UAT's
   /v3/api-docs StageRequest (2026-09-28). types.gen.ts is not regenerated
   for it, so ChangeView is typed here.
   ===================================================================== */

import type {
  AssignProductCouponTariffRequest, CreateAccountTemplateRequest, CreatePackageRequest, CreateProductLimitRequest,
  CreateProductRequest, CreateSchemeRequest, CreateServicePackageItemRequest, CreateTariffDomainRequest,
  CreateTariffTypeRequest, CreateTariffValueRequest,
} from "./types.gen";

export type ChangeType =
  | "PRODUCT_CREATE"
  | "PRODUCT_ACTIVATE"
  | "PRODUCT_DEACTIVATE"
  | "PRODUCT_LIMIT_CREATE"
  | "PRODUCT_COUPON_TARIFF_ASSIGN"
  | "TARIFF_DOMAIN_CREATE"
  | "TARIFF_TYPE_CREATE"
  | "TARIFF_VALUE_CREATE"
  | "SERVICE_PACKAGE_CREATE"
  | "SERVICE_PACKAGE_ITEM_CREATE"
  | "SCHEME_CREATE"
  | "ACCOUNT_TEMPLATE_CREATE"
  | "INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET"
  | "BOND_PRICE_SET";

/** Only PENDING moves; every other status is final. FAILED means the checker
 *  approved but the engine refused the replay (a stale payload): nothing applied. */
export type ChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "FAILED";

/** The payload each change type carries — the same body its direct endpoint takes. */
export type ChangePayload = {
  PRODUCT_CREATE: CreateProductRequest;
  PRODUCT_ACTIVATE: { productId: string };
  PRODUCT_DEACTIVATE: { productId: string };
  PRODUCT_LIMIT_CREATE: CreateProductLimitRequest;
  PRODUCT_COUPON_TARIFF_ASSIGN: AssignProductCouponTariffRequest;
  TARIFF_DOMAIN_CREATE: CreateTariffDomainRequest;
  TARIFF_TYPE_CREATE: CreateTariffTypeRequest;
  TARIFF_VALUE_CREATE: CreateTariffValueRequest;
  SERVICE_PACKAGE_CREATE: CreatePackageRequest;
  SERVICE_PACKAGE_ITEM_CREATE: CreateServicePackageItemRequest;
  SCHEME_CREATE: CreateSchemeRequest;
  ACCOUNT_TEMPLATE_CREATE: CreateAccountTemplateRequest;
  /** The direct endpoint takes the institution in its path; staged, it moves
   *  into the payload, as activate's productId does. */
  INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET: { institutionId: string; tariffDomainId: string };
  /** The desk's price for a bond: clean mid per unit, and the whole bid-offer width as a fraction of mid. */
  BOND_PRICE_SET: { productId: string; midPrice: number; quoteSpread: number };
};

/** ConfigChangeController.ChangeView. `targetId` is what the change is aimed
 *  at while pending; once applied the engine may replace it with the new
 *  record's id, so screens read the subject from the payload (subjectOf). */
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
  PRODUCT_LIMIT_CREATE: "Product limit",
  PRODUCT_COUPON_TARIFF_ASSIGN: "Coupon tariff",
  TARIFF_DOMAIN_CREATE: "New tariff domain",
  TARIFF_TYPE_CREATE: "New tariff type",
  TARIFF_VALUE_CREATE: "New rate",
  SERVICE_PACKAGE_CREATE: "New service package",
  SERVICE_PACKAGE_ITEM_CREATE: "New package item",
  SCHEME_CREATE: "New scheme",
  ACCOUNT_TEMPLATE_CREATE: "New account template",
  INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET: "Default tariff domain",
  BOND_PRICE_SET: "Bond price",
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

/** The payload field that names what each change is about: the product a
 *  limit is for, the package an item joins, the institution whose default
 *  domain changes. A rate is shown under its domain. */
const SUBJECT_KEY: Record<ChangeType, string> = {
  PRODUCT_CREATE: "productId",
  PRODUCT_ACTIVATE: "productId",
  PRODUCT_DEACTIVATE: "productId",
  PRODUCT_LIMIT_CREATE: "productId",
  PRODUCT_COUPON_TARIFF_ASSIGN: "productId",
  TARIFF_DOMAIN_CREATE: "tariffDomainId",
  TARIFF_TYPE_CREATE: "tariffTypeId",
  TARIFF_VALUE_CREATE: "tariffDomainId",
  SERVICE_PACKAGE_CREATE: "packageId",
  SERVICE_PACKAGE_ITEM_CREATE: "servicePackageId",
  SCHEME_CREATE: "schemeId",
  ACCOUNT_TEMPLATE_CREATE: "schemeId",
  INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET: "institutionId",
  BOND_PRICE_SET: "productId",
};

/** What a change is about, for display and matching. Read from the payload,
 *  because once applied the engine replaces `targetId` with the new record's
 *  id (a limit's or rate's UUID). A type this console doesn't know yet falls
 *  back to `targetId`. */
export function subjectOf(change: Pick<ConfigChange, "changeType" | "payload" | "targetId">): string | null {
  const key = SUBJECT_KEY[change.changeType] as string | undefined;
  const v = key ? change.payload?.[key] : undefined;
  return typeof v === "string" && v ? v : (change.targetId ?? null);
}

/** Pending requests aimed at one subject (a product, package, scheme or
 *  institution — see SUBJECT_KEY), optionally of given types — so a screen can
 *  say "already awaiting approval" instead of staging a duplicate. */
export function pendingFor(changes: ConfigChange[] | null | undefined, subjectId: string, types?: ChangeType[]): ConfigChange[] {
  return (changes ?? []).filter(
    (c) => c.status === "PENDING" && subjectOf(c) === subjectId && (!types || types.includes(c.changeType)),
  );
}

/** Pending requests of the given types, whatever they are about. */
export function pendingOf(changes: ConfigChange[] | null | undefined, types: ChangeType[]): ConfigChange[] {
  return (changes ?? []).filter((c) => c.status === "PENDING" && types.includes(c.changeType));
}
