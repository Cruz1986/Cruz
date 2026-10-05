"use client";

import { getBrowserClient } from "@/lib/db/browser";

/** Stops this device's push subscription and removes it from the account (on sign-out). */
export async function stopPushOnDevice(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const sub = registration ? await registration.pushManager.getSubscription() : null;
    if (!sub) return;
    await getBrowserClient()?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // best effort: the server also drops subscriptions the push service reports as gone
  }
}
