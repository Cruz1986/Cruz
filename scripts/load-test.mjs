#!/usr/bin/env node
/**
 * A simple load test: N concurrent visitors request a mix of pages for a while; prints throughput and
 * latency percentiles per path. Use it against a production build or a preview deployment, never production
 * traffic you do not own.
 *
 *   node scripts/load-test.mjs --url http://localhost:3000 --concurrency 50 --seconds 20
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    concurrency: { type: "string", default: "25" },
    seconds: { type: "string", default: "15" },
  },
});
const PATHS = [
  "/ta",
  "/en/today",
  "/ta/today",
  "/en/bible/en-drc/jhn/3",
  "/en/prayers",
  "/en/prayers/memorare",
  "/ta/rosary/joyful",
  "/en/saints",
  "/en/saints/thomas",
  "/en/calendar",
  "/api/today?lang=ta",
  "/api/saints/today",
];
const until = Date.now() + Number(values.seconds) * 1000;
const stats = new Map(PATHS.map((p) => [p, { times: [], errors: 0 }]));

async function visitor(seed) {
  for (let i = seed; Date.now() < until; i++) {
    const path = PATHS[i % PATHS.length];
    const start = performance.now();
    try {
      const response = await fetch(values.url + path, { headers: { "accept-encoding": "gzip" } });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(String(response.status));
      stats.get(path).times.push(performance.now() - start);
    } catch {
      stats.get(path).errors += 1;
    }
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: Number(values.concurrency) }, (_, i) => visitor(i)));
const elapsed = (performance.now() - started) / 1000;
const pct = (sorted, p) =>
  sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]) : 0;
const rows = [...stats].map(([path, { times, errors }]) => {
  const sorted = times.sort((a, b) => a - b);
  return {
    path,
    requests: times.length,
    errors,
    p50: pct(sorted, 0.5),
    p95: pct(sorted, 0.95),
    p99: pct(sorted, 0.99),
  };
});
console.table(rows);
const total = rows.reduce((n, r) => n + r.requests, 0);
const errors = rows.reduce((n, r) => n + r.errors, 0);
console.log(
  `${total} requests in ${elapsed.toFixed(1)} s = ${Math.round(total / elapsed)} req/s with ${values.concurrency} concurrent visitors; ${errors} errors`,
);
if (errors) process.exitCode = 1;
