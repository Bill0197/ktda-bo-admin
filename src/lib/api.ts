/* Barrel re-export — pages import from "../lib/api" uniformly, same as the
 * single "../mock" import they replace. The actual implementations live in
 * one file per domain (api.compliance.ts, api.crm.ts, api.admin.ts,
 * api.ledger.ts) so parallel wiring passes don't collide on one file. */
export * from "./api.compliance";
export * from "./api.crm";
export * from "./api.admin";
export * from "./api.ledger";
export * from "./api.investment";
export * from "./api.institutional";
export * from "./api.tokconduct";
export * from "./api.tokenConsole";
export { ApiError } from "./apiClient";
