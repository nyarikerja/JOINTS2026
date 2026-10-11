/**
 * utils/locationWatch.ts - Pemantauan lokasi warga.
 * Lokasi yang dipilih di tab Protokol & AI disimpan di localStorage ("watchLocation").
 * Selama aplikasi terbuka, ringkasan /advice/nearby diperiksa tiap 15 menit; bila skenario berubah
 * menjadi ancaman abu atau asap, browser menampilkan notifikasi.
 */

import { useEffect } from "react";
import { api } from "../services/api";

export interface WatchedLocation { lat: number; lon: number; name: string; lastScenario?: string }

const KEY = "watchLocation";
const INTERVAL_MS = 15 * 60 * 1000;
const THREATS = ["ash_threat", "smoke_threat"];

export function getWatchedLocation(): WatchedLocation | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function setWatchedLocation(loc: WatchedLocation | null) {
  try {
    if (loc) localStorage.setItem(KEY, JSON.stringify(loc)); else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("watchlocation:change"));
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

async function checkOnce() {
  const loc = getWatchedLocation();
  if (!loc) return;
  try {
    const res = await api.getNearbyAdvice(loc.lat, loc.lon, "id");
    const sc: string = res?.scenario;
    if (sc && THREATS.includes(sc) && sc !== loc.lastScenario && "Notification" in window && Notification.permission === "granted") {
      new Notification(`HelaLoka: ${res.brief?.headline || "Ancaman di sekitar lokasi Anda"}`, {
        body: `${loc.name}. ${res.brief?.summary || ""}`.slice(0, 220),
        icon: "/gunung.png",
        tag: "helaloka-watch"
      });
    }
    setWatchedLocation({ ...loc, lastScenario: sc });
  } catch {}
}

export function useLocationWatch() {
  useEffect(() => {
    checkOnce();
    const t = setInterval(checkOnce, INTERVAL_MS);
    return () => clearInterval(t);
  }, []);
}
