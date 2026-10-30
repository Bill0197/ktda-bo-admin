import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Baracel Unyt must read no sample data. A static walk of what every Unyt page
 * imports at runtime, from App.tsx's lazy imports outwards, failing on any path
 * into src/mock or the demo API (lib/api.demo.ts).
 *
 * Two shared modules do reach src/mock for other pages, so they are checked by
 * the names a Unyt module takes from them rather than walked:
 *   lib/api.ts   the barrel; Unyt may take only what api.tokenConsole.ts exports
 *                (and ApiError) — never one of the names it re-exports from api.demo;
 *   lib/auth.tsx the session; Unyt may not take the staff directory it re-exports
 *                from src/mock. */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const rel = (f: string) => path.relative(SRC, f);
const read = (f: string) => fs.readFileSync(f, "utf8");

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

type Edge = { names: string[] | "*"; spec: string };

/** The runtime imports (and re-exports) of one module; `import type` is erased and skipped. */
function edges(file: string): Edge[] {
  const out: Edge[] = [];
  const src = read(file);
  for (const m of src.matchAll(/(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s+["']([^"']+)["']/g)) {
    if (m[2]) continue;
    const clause = m[3];
    const braces = clause.match(/\{([\s\S]*)\}/);
    const names = braces
      ? braces[1].split(",").map((s) => s.trim()).filter((s) => s && !s.startsWith("type ")).map((s) => s.split(/\s+as\s+/)[0])
      : "*";
    if (Array.isArray(names) && names.length === 0 && !/^\s*\w/.test(clause.replace(/\{[\s\S]*\}/, ""))) continue; // only types
    out.push({ names, spec: m[4] });
  }
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.push({ names: "*", spec: m[1] });
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push({ names: "*", spec: m[1] });
  return out;
}

const BARREL = path.join(SRC, "lib/api.ts");
const AUTH = path.join(SRC, "lib/auth.tsx");
const MOCK = path.join(SRC, "mock") + path.sep;
const DEMO = path.join(SRC, "lib/api.demo.ts");

const tokenConsoleExports = new Set(
  [...read(path.join(SRC, "lib/api.tokenConsole.ts")).matchAll(/export\s+(?:const|function|type|interface)\s+(\w+)/g)].map((m) => m[1]),
);
const BARREL_OK = new Set([...tokenConsoleExports, "ApiError"]);
const authFromMock = (() => {
  const m = read(AUTH).match(/import\s*\{([^}]*)\}\s*from\s*["']\.\.\/mock["']/);
  return new Set((m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^type\s+/, "")).filter(Boolean));
})();

/** Every way `start` reaches sample data, as import chains. */
function mockPaths(start: string): string[] {
  const seen = new Map<string, string[]>([[start, [rel(start)]]]);
  const queue = [start];
  const found: string[] = [];
  while (queue.length) {
    const file = queue.shift()!;
    const chain = seen.get(file)!;
    for (const e of edges(file)) {
      const target = resolve(file, e.spec);
      if (!target) continue;
      const via = [...chain, rel(target)].join(" → ");
      if (target.startsWith(MOCK) || target === DEMO) {
        found.push(via);
        continue;
      }
      if (target === BARREL) {
        const bad = e.names === "*" ? ["* (the whole barrel)"] : e.names.filter((n) => !BARREL_OK.has(n));
        if (bad.length) found.push(`${via} {${bad.join(", ")}}`);
        continue;
      }
      if (target === AUTH) {
        const bad = e.names === "*" ? ["*"] : e.names.filter((n) => authFromMock.has(n));
        if (bad.length) found.push(`${via} {${bad.join(", ")}}`);
        continue;
      }
      if (!seen.has(target)) {
        seen.set(target, [...chain, rel(target)]);
        queue.push(target);
      }
    }
  }
  return found;
}

const unytPages = [...read(path.join(SRC, "App.tsx")).matchAll(/lazy\(\(\) => import\("\.\/(pages\/tokenconsole\/\w+)"\)\)/g)]
  .map((m) => resolve(path.join(SRC, "App.tsx"), `./${m[1]}`)!);

test("App.tsx lazy-loads every Unyt page", () => {
  expect(unytPages.length).toBeGreaterThanOrEqual(27);
  expect(unytPages.every(Boolean)).toBe(true);
  expect(tokenConsoleExports.has("tokenConsole")).toBe(true);
  expect(authFromMock.size).toBeGreaterThan(0);
});

test("no Unyt page reaches src/mock or the demo API", () => {
  const found = unytPages.flatMap((p) => mockPaths(p));
  expect(found).toEqual([]);
});

test("the walk does find mocks: a demo page reaches src/mock", () => {
  const clients = path.join(SRC, "pages/Clients.tsx");
  expect(fs.existsSync(clients)).toBe(true);
  expect(mockPaths(clients).length).toBeGreaterThan(0);
});
