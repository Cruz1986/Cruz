import https from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

vi.mock("server-only", () => ({}));
const { logProvider, webPushProvider } = await import("@/lib/notifications/provider");

// A stand-in push service: answers with the status given in the path, and records requests.
// Real push services are HTTPS; this one uses a throwaway self-signed certificate.
let server: https.Server;
let base = "";
let agent: https.Agent;
const received: { path: string; headers: Record<string, string | string[] | undefined>; bytes: number }[] = [];
beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "push-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
      "-keyout",
      join(dir, "key.pem"),
      "-out",
      join(dir, "cert.pem"),
    ],
    { stdio: "ignore" },
  );
  const cert = readFileSync(join(dir, "cert.pem"));
  agent = new https.Agent({ ca: cert });
  server = https.createServer({ key: readFileSync(join(dir, "key.pem")), cert }, (req, res) => {
    let bytes = 0;
    req.on("data", (c: Buffer) => (bytes += c.length));
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, bytes });
      res.writeHead(Number(req.url?.split("/").pop()) || 201).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

function subscription(status: number) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `${base}/push/${status}`,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") },
  };
}
const payload = {
  title: "Saint Francis Xavier",
  body: "Gospel: Mark 16:15-20",
  url: "/en/today/2026-12-03",
  tag: "daily-2026-12-03",
};

describe("web push provider", () => {
  const vapid = webpush.generateVAPIDKeys();
  const provider = webPushProvider(
    { ...vapid, subject: "mailto:admin@example.com" },
    {
      get agent() {
        return agent;
      },
    },
  );

  it("sends an encrypted, VAPID-signed message", async () => {
    expect(await provider.send(subscription(201), payload)).toBe("sent");
    const request = received.at(-1)!;
    expect(request.headers.authorization).toMatch(/^vapid t=.+, k=/);
    expect(request.headers["content-encoding"]).toBe("aes128gcm");
    expect(request.bytes).toBeGreaterThan(100);
  });

  it("reports subscriptions the push service no longer knows", async () => {
    expect(await provider.send(subscription(410), payload)).toBe("gone");
    expect(await provider.send(subscription(404), payload)).toBe("gone");
  });

  it("reports other failures for a later retry", async () => {
    expect(await provider.send(subscription(500), payload)).toBe("failed");
  });
});

describe("log provider", () => {
  it("records instead of sending", async () => {
    const sink: Parameters<typeof logProvider>[0] = [];
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await logProvider(sink).send(subscription(201), payload)).toBe("sent");
    expect(sink).toHaveLength(1);
    spy.mockRestore();
  });
});
