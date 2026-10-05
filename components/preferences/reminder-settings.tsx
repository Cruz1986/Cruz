"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { BrowserClient } from "@/lib/db/browser";
import { hasSessionCookie } from "@/lib/personal/client";
import { getSupabaseConfig } from "@/lib/env";
import { sendTestNotification } from "@/lib/notifications/actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";

type Prefs = {
  enabled: boolean;
  daily_reading: boolean;
  saint_of_day: boolean;
  prayer: boolean;
  rosary: boolean;
  preferred_time: string;
  timezone: string;
};
type Device = "checking" | "unsupported" | "unavailable" | "blocked" | "on" | "off";
const PARTS = ["daily_reading", "saint_of_day", "rosary", "prayer"] as const;
const PART_LABEL = {
  daily_reading: "dailyReading",
  saint_of_day: "saintOfDay",
  rosary: "rosary",
  prayer: "prayer",
} as const;
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function timeZones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([current, "Asia/Kolkata", ...all])];
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Daily reminder settings (stored in the reader's account, since the reminder is sent from the server)
 * and this device's push subscription.
 */
export function ReminderSettings() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [db, setDb] = useState<BrowserClient | null>(null);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [device, setDevice] = useState<Device>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Signed-out readers get the sign-in prompt without loading the Supabase client.
      const client = hasSessionCookie() ? (await import("@/lib/db/browser")).getBrowserClient() : null;
      const id = client ? ((await client.auth.getSession()).data.session?.user.id ?? null) : null;
      let loaded: Prefs | null = null;
      if (client && id) {
        const { data: row } = await client
          .from("notification_preferences")
          .select("enabled, daily_reading, saint_of_day, prayer, rosary, preferred_time, timezone")
          .maybeSingle();
        loaded = row
          ? { ...(row as Prefs), preferred_time: String(row.preferred_time).slice(0, 5) }
          : {
              enabled: true,
              daily_reading: true,
              saint_of_day: true,
              prayer: false,
              rosary: false,
              preferred_time: "06:00",
              timezone: browserTimeZone(),
            };
      }
      let state: Device = "off";
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
        state = "unsupported";
      else if (!VAPID_KEY) state = "unavailable";
      else if (Notification.permission === "denied") state = "blocked";
      else state = (await currentSubscription()) ? "on" : "off";
      if (!cancelled) {
        setDb(client);
        setUserId(id);
        setPrefs(loaded);
        setDevice(state);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!getSupabaseConfig() || userId === undefined) return null;

  if (!userId || !prefs) {
    return (
      <Card>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-fg-muted mt-2">{t("signInFirst")}</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/${locale}/settings`)}`}
          className={buttonClasses({ size: "sm", className: "mt-3" })}
        >
          {t("signIn")}
        </Link>
      </Card>
    );
  }

  async function save(next: Prefs) {
    setBusy(true);
    const { error } = await db!.from("notification_preferences").upsert(
      {
        user_id: userId,
        enabled: next.enabled,
        daily_reading: next.daily_reading,
        saint_of_day: next.saint_of_day,
        prayer: next.prayer,
        rosary: next.rosary,
        preferred_time: next.preferred_time,
        timezone: next.timezone,
      },
      { onConflict: "user_id" },
    );
    // Reminders are written in the language the reader uses the app in.
    if (!error) await db!.from("profiles").update({ preferred_language: locale }).eq("id", userId);
    setMessage(error ? t("failed") : t("saved"));
    setBusy(false);
  }

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(VAPID_KEY),
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await db!
        .from("push_subscriptions")
        .upsert(
          { user_id: userId, endpoint: json.endpoint, keys: json.keys, user_agent: navigator.userAgent.slice(0, 200) },
          { onConflict: "endpoint" },
        );
      if (error) {
        setMessage(t("otherDevice"));
        return;
      }
      setDevice("on");
      await save({ ...prefs!, enabled: true });
      setPrefs((p) => (p ? { ...p, enabled: true } : p));
    } catch {
      setMessage(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const sub = await currentSubscription();
    if (sub) {
      await db!.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setDevice("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const result = await sendTestNotification(locale);
    setMessage(result === "sent" ? t("testSent") : result === "unavailable" ? t("unavailable") : t("failed"));
    setBusy(false);
  }

  const update = (patch: Partial<Prefs>) => setPrefs((p) => (p ? { ...p, ...patch } : p));
  const inputClass = "border-border bg-surface mt-1 block w-full rounded-xl border px-3 py-2";

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <p className="text-fg-muted mt-1 text-sm">{t("description")}</p>

      <section aria-label={t("device")} className="bg-surface-muted mt-4 space-y-2 rounded-xl p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          {device === "on" ? (
            <Bell aria-hidden className="text-accent size-4" />
          ) : (
            <BellOff aria-hidden className="size-4" />
          )}
          {device === "on"
            ? t("deviceOn")
            : device === "blocked"
              ? t("blocked")
              : device === "unsupported"
                ? t("unsupported")
                : device === "unavailable"
                  ? t("unavailable")
                  : t("deviceOff")}
        </p>
        <div className="flex flex-wrap gap-2">
          {device === "off" ? (
            <Button size="sm" onClick={turnOn} disabled={busy}>
              <Bell aria-hidden className="size-4" />
              {t("turnOn")}
            </Button>
          ) : null}
          {device === "on" ? (
            <>
              <Button size="sm" variant="secondary" onClick={test} disabled={busy}>
                <Send aria-hidden className="size-4" />
                {t("test")}
              </Button>
              <Button size="sm" variant="ghost" onClick={turnOff} disabled={busy}>
                {t("turnOff")}
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save(prefs);
        }}
      >
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="size-5"
            checked={prefs.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          {t("enabled")}
        </label>
        <fieldset disabled={!prefs.enabled} className="space-y-4 disabled:opacity-60">
          <legend className="text-sm font-medium">{t("parts")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PARTS.map((part) => (
              <label key={part} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={prefs[part]}
                  onChange={(e) => update({ [part]: e.target.checked })}
                />
                {t(PART_LABEL[part])}
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {t("time")}
              <input
                type="time"
                required
                value={prefs.preferred_time}
                onChange={(e) => update({ preferred_time: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("timezone")}
              <select
                value={prefs.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className={inputClass}
              >
                {timeZones(prefs.timezone).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {t("save")}
          </Button>
          <p role="status" className="text-sm">
            {message}
          </p>
        </div>
      </form>
    </Card>
  );
}
