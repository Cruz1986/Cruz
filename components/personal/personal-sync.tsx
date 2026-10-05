"use client";

import { useEffect } from "react";
import { startPersonalSync } from "@/lib/personal/client";

/** Starts syncing the reader's library with their account (no UI). */
export function PersonalSync() {
  useEffect(() => startPersonalSync(), []);
  return null;
}
