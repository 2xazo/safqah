import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

test("required route files exist", () => {
  const routes = [
    "app/page.tsx",
    "app/login/page.tsx",
    "app/buyer/page.tsx",
    "app/buyer/requests/page.tsx",
    "app/buyer/requests/new/page.tsx",
    "app/buyer/offers/page.tsx",
    "app/supplier/page.tsx",
    "app/supplier/opportunities/page.tsx",
    "app/supplier/offers/page.tsx",
    "app/supplier/profile/page.tsx",
    "app/admin/page.tsx",
    "app/admin/audit-log/page.tsx",
    "db/schema.ts",
    "db/seed.ts",
    "drizzle/0000_init_safqah.sql",
  ];
  for (const route of routes) {
    assert.equal(existsSync(route), true, `missing ${route}`);
  }
});

test("landing uses buyer wording مشتري", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /ابدأ كمشتري/);
  assert.doesNotMatch(page, /ابدأ كمشتر[^ي]/);
});

test("migration covers sealed bid uniqueness", () => {
  const sql = readFileSync("drizzle/0000_init_safqah.sql", "utf8");
  assert.match(sql, /bids_competition_supplier_uidx/);
  assert.match(sql, /create table .+competitions/i);
});
