import type { AdminRole } from "./admin";

/** System-management domain — departments, third-party integrations,
 * scheduled batch jobs and per-app maintenance mode. All BO-managed. */

export type Department = {
  id: string;
  name: string;
  head: string;
  description: string;
  /** BO Admin roles that belong to this department — users inherit their
   * department through their role. */
  roles: AdminRole[];
};

export type Integration = {
  id: string;
  name: string;
  purpose: string;
  environment: "sandbox" | "production";
  health: "healthy" | "degraded" | "down";
  lastCheckedAt: string;
  note?: string;
};

export type SystemJob = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun?: { at: string; status: "success" | "failed"; detail?: string };
};

export type MaintenanceTarget = {
  id: string;
  app: string;
  maintenance: boolean;
  note?: string;
};
