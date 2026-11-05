// One-time local setup: fills CLOUDFLARE_ACCOUNT_ID (looked up with the
// API token) and a SESSION_SECRET in .env.local and .dev.vars.
// Usage: node scripts/setup-local.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const FILES = [".env.local", ".dev.vars"];

function parse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function setVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
}

const base = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
const vars = parse(base);
const token = vars.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("CLOUDFLARE_API_TOKEN is missing in .dev.vars");
  process.exit(1);
}

let accountId = vars.CLOUDFLARE_ACCOUNT_ID;
if (!accountId) {
  const res = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success || !body.result?.length) {
    console.error("Could not read your Cloudflare account. Check the token.", body.errors ?? res.status);
    process.exit(1);
  }
  accountId = body.result[0].id;
  console.log(`Cloudflare account found: ${body.result[0].name}`);
}

const secret = vars.SESSION_SECRET || randomBytes(32).toString("hex");

for (const file of FILES) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : base;
  text = setVar(text, "CLOUDFLARE_ACCOUNT_ID", accountId);
  text = setVar(text, "CLOUDFLARE_API_TOKEN", token);
  if (!parse(text).SESSION_SECRET) text = setVar(text, "SESSION_SECRET", secret);
  writeFileSync(file, text, "utf8");
}
console.log("Environment files ready.");
