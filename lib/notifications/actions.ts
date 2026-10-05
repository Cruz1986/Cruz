"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/server";
import en from "@/messages/en.json";
import ta from "@/messages/ta.json";
import { configuredProvider } from "./provider";

export type TestResult = "sent" | "no_device" | "unavailable" | "failed";

/** Sends a test notification to the signed-in reader's own devices. */
export async function sendTestNotification(locale: string): Promise<TestResult> {
  const user = await getSessionUser();
  const db = await createSupabaseServerClient();
  const provider = configuredProvider();
  if (!user || !db) return "failed";
  if (!provider) return "unavailable";
  // Row level security returns only this reader's subscriptions.
  const { data } = await db.from("push_subscriptions").select("id, endpoint, keys");
  const subs = z
    .array(z.object({ id: z.string(), endpoint: z.string(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }))
    .catch([])
    .parse(data);
  if (!subs.length) return "no_device";
  const lang = locale === "en" ? "en" : "ta";
  const messages = lang === "en" ? en : ta;
  let sent = 0;
  for (const sub of subs) {
    const result = await provider.send(sub, {
      title: messages.notifications.testTitle,
      body: messages.notifications.testBody,
      url: `/${lang}/settings`,
      tag: "test",
    });
    if (result === "sent") sent += 1;
    if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return sent ? "sent" : "failed";
}
