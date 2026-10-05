import "server-only";
import type { Agent } from "node:https";
import webpush from "web-push";
import type { PushPayload } from "./compose";

export type PushSubscriptionRow = { endpoint: string; keys: { p256dh: string; auth: string } };
/** sent; gone = the subscription no longer exists (remove it); failed = try again later. */
export type SendResult = "sent" | "gone" | "failed";

/** Delivery is abstracted so another service (e.g. a native app push service) can replace Web Push. */
export interface NotificationProvider {
  readonly name: string;
  send(subscription: PushSubscriptionRow, payload: PushPayload): Promise<SendResult>;
}

/** Web Push (VAPID), supported by Android, desktop browsers and installed iOS web apps. */
export function webPushProvider(
  vapid: { publicKey: string; privateKey: string; subject: string },
  /** Transport options, e.g. an HTTPS agent (tests use one that trusts a local push service). */
  transport: { agent?: Agent } = {},
): NotificationProvider {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return {
    name: "web-push",
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 6 * 60 * 60,
          urgency: "normal",
          timeout: 10_000,
          ...transport,
        });
        return "sent";
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? "gone" : "failed";
      }
    },
  };
}

/** Records messages instead of sending them (development and tests). */
export function logProvider(
  sink: { subscription: PushSubscriptionRow; payload: PushPayload }[] = [],
): NotificationProvider {
  return {
    name: "log",
    async send(subscription, payload) {
      sink.push({ subscription, payload });
      console.info(
        `[notifications] ${subscription.endpoint.slice(0, 48)}… ${payload.title} — ${payload.body.replace(/\n/g, " | ")}`,
      );
      return "sent";
    },
  };
}

/** The configured provider: NOTIFICATION_PROVIDER=log, or Web Push when the VAPID keys are set. */
export function configuredProvider(): NotificationProvider | null {
  if (process.env.NOTIFICATION_PROVIDER === "log") return logProvider();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? webPushProvider({ publicKey, privateKey, subject }) : null;
}
