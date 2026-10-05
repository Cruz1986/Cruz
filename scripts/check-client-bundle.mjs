#!/usr/bin/env node
/**
 * Fails when browser files of the build (.next/static) mention a server-only secret: its variable name or,
 * when set in this environment, its value. Run after `pnpm build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SECRETS = ["SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "DATABASE_URL"];
const root = ".next/static";

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|json|html|txt|map)$/.test(name)) yield path;
  }
}

const needles = SECRETS.flatMap((name) => {
  const value = process.env[name];
  return [
    { label: name, text: name },
    ...(value && value.length >= 8 ? [{ label: `${name} (value)`, text: value }] : []),
  ];
});
const problems = [];
let count = 0;
for (const file of files(root)) {
  count += 1;
  const content = readFileSync(file, "utf8");
  for (const { label, text } of needles) if (content.includes(text)) problems.push(`${file}: ${label}`);
}
if (problems.length) {
  console.error(`Server secrets found in browser files:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Checked ${count} browser files: no server secrets.`);
