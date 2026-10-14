/**
 * simulation/windLayer.ts - Nationwide wind field from /layers/wind drawn on a canvas
 * above the Leaflet tiles. Particles drift with the forecast wind and leave short trails
 * coloured by speed; with prefers-reduced-motion it draws static arrows instead.
 * The field is bilinear in space and linear in time between the 3-hourly steps.
 * Adopted directly from ITHACKITS/FE-FORGEHACK-2026.
 */

import type L from "leaflet";

export interface WindGridSpec {
  lat0: number;
  lon0: number;
  dlat: number;
  dlon: number;
  nlat: number;
  nlon: number;
}

export interface WindField {
  grid: WindGridSpec;
  u: number[][];
  v: number[][];
}

const DEG = Math.PI / 180;
const MAX_PARTICLES = 4500;
const PX_PER_MS = 0.35;     // screen pixels per frame for 1 m/s (visual only)
const MAX_AGE = 90;         // frames before a particle respawns
const ARROW_SPACING = 56;   // px between static arrows (reduced motion)

/** Speed bins in m/s with their colours (legend uses the same table). */
export const WIND_SPEED_BINS: { max: number; color: string; label: string }[] = [
  { max: 2, color: "rgba(186, 214, 232, 0.35)", label: "< 2" },
  { max: 4, color: "rgba(125, 211, 192, 0.40)", label: "2–4" },
  { max: 7, color: "rgba(250, 224, 120, 0.45)", label: "4–7" },
  { max: 10, color: "rgba(251, 146, 60, 0.50)", label: "7–10" },
  { max: Infinity, color: "rgba(239, 68, 68, 0.55)", label: "≥ 10" }
];

function binOf(speed: number): number {
  for (let i = 0; i < WIND_SPEED_BINS.length; i++) if (speed < WIND_SPEED_BINS[i].max) return i;
  return WIND_SPEED_BINS.length - 1;
}

/** (u, v) in m/s at a position and fractional time index, interpolated seamlessly across 100% full screen. */
export function sampleWind(field: WindField, t: number, lat: number, lon: number): [number, number] | null {
  const g = field.grid;
  if (!g || !field.u || field.u.length === 0) return null;

  // Clamp fi & fj seamlessly so particles stream across 100% of the viewport without rectangular box cuts
  const rawFi = (lat - g.lat0) / g.dlat;
  const rawFj = (lon - g.lon0) / g.dlon;
  const fi = Math.max(0, Math.min(g.nlat - 1.0001, rawFi));
  const fj = Math.max(0, Math.min(g.nlon - 1.0001, rawFj));

  const nT = field.u.length;
  const t0 = Math.max(0, Math.min(nT - 1, Math.floor(t)));
  const t1 = Math.min(nT - 1, t0 + 1);
  const wt = Math.max(0, Math.min(1, t - t0));
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  const i1 = Math.min(i0 + 1, g.nlat - 1), j1 = Math.min(j0 + 1, g.nlon - 1);
  const di = fi - i0, dj = fj - j0;
  const n = g.nlon;
  const bil = (row: number[]) =>
    row[i0 * n + j0] * (1 - di) * (1 - dj) + row[i0 * n + j1] * (1 - di) * dj +
    row[i1 * n + j0] * di * (1 - dj) + row[i1 * n + j1] * di * dj;
  const u = bil(field.u[t0]) * (1 - wt) + bil(field.u[t1]) * wt;
  const v = bil(field.v[t0]) * (1 - wt) + bil(field.v[t1]) * wt;
  return [u, v];
}

export class WindLeafletLayer {
  private readonly map: L.Map;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reducedMotion: boolean;
  private field: WindField | null = null;
  private t = 0;
  private visible = false;
  private raf = 0;
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private age = new Uint16Array(0);

  constructor(map: L.Map) {
    this.map = map;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "wind-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      zIndex: "440", // above tiles and overlay pane, below smoke/markers
      pointerEvents: "none",
      display: "none",
      opacity: "0.75",
      mixBlendMode: "screen"
    });
    map.getContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    map.on("resize", this.reset);
    map.on("movestart", this.onMoveStart);
    map.on("moveend", this.reset);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
  }

  setField(field: WindField | null) {
    this.field = field;
    this.reset();
  }

  setTime(t: number) {
    this.t = t;
    if (this.reducedMotion) this.drawArrows();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.canvas.style.display = visible ? "block" : "none";
    this.reset();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.map.off("resize", this.reset);
    this.map.off("movestart", this.onMoveStart);
    this.map.off("moveend", this.reset);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.remove();
  }

  private onMoveStart = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clear();
  };

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      this.reset();
    }
  };

  private resize() {
    const size = this.map.getSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(size.x * dpr);
    this.canvas.height = Math.round(size.y * dpr);
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private clear() {
    const size = this.map.getSize();
    this.ctx.clearRect(0, 0, size.x, size.y);
  }

  /** Container pixel -> lat/lon with inline spherical mercator (no allocations per particle). */
  private projector() {
    const scale = 256 * Math.pow(2, this.map.getZoom());
    const origin = this.map.getPixelOrigin();
    const pane = this.map.containerPointToLayerPoint([0, 0]);
    const offX = -origin.x - pane.x;
    const offY = -origin.y - pane.y;
    return {
      toLatLon: (x: number, y: number): [number, number] => {
        const lon = ((x - offX) * 360) / scale - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y - offY)) / scale))) / DEG;
        return [lat, lon];
      }
    };
  }

  private reset = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resize();
    this.clear();
    if (!this.visible || !this.field || document.hidden) return;
    if (this.reducedMotion) {
      this.drawArrows();
      return;
    }
    const size = this.map.getSize();
    const n = Math.min(MAX_PARTICLES, Math.round((size.x * size.y) / 340));
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.age = new Uint16Array(n);
    for (let i = 0; i < n; i++) this.spawn(i, true);
    this.raf = requestAnimationFrame(this.loop);
  };

  private spawn(i: number, randomAge: boolean) {
    const size = this.map.getSize();
    this.px[i] = Math.random() * size.x;
    this.py[i] = Math.random() * size.y;
    this.age[i] = randomAge ? Math.floor(Math.random() * MAX_AGE) : 0;
  }

  private loop = () => {
    const field = this.field;
    if (!field || !this.visible) return;
    const ctx = this.ctx;
    const size = this.map.getSize();
    const { toLatLon } = this.projector();

    // Fade the previous frame so moving particles leave short trails.
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.86)";
    ctx.fillRect(0, 0, size.x, size.y);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.05;
    ctx.lineCap = "round";

    const paths: Path2D[] = WIND_SPEED_BINS.map(() => new Path2D());
    for (let i = 0; i < this.px.length; i++) {
      const x = this.px[i], y = this.py[i];
      const [lat, lon] = toLatLon(x, y);
      const uv = sampleWind(field, this.t, lat, lon);
      if (!uv || this.age[i] > MAX_AGE) {
        this.spawn(i, false);
        continue;
      }
      const [u, v] = uv;
      const nx = x + u * PX_PER_MS;
      const ny = y - v * PX_PER_MS; // screen y grows southwards
      const p = paths[binOf(Math.hypot(u, v))];
      p.moveTo(x, y);
      p.lineTo(nx, ny);
      this.px[i] = nx;
      this.py[i] = ny;
      this.age[i]++;
      if (nx < 0 || ny < 0 || nx > size.x || ny > size.y) this.spawn(i, false);
    }
    paths.forEach((p, k) => {
      ctx.strokeStyle = WIND_SPEED_BINS[k].color;
      ctx.stroke(p);
    });
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Reduced motion: a static grid of arrows pointing where the wind blows. */
  private drawArrows() {
    const field = this.field;
    this.clear();
    if (!field || !this.visible) return;
    const ctx = this.ctx;
    const size = this.map.getSize();
    const { toLatLon } = this.projector();
    ctx.lineWidth = 1.6;
    for (let y = ARROW_SPACING / 2; y < size.y; y += ARROW_SPACING) {
      for (let x = ARROW_SPACING / 2; x < size.x; x += ARROW_SPACING) {
        const [lat, lon] = toLatLon(x, y);
        const uv = sampleWind(field, this.t, lat, lon);
        if (!uv) continue;
        const speed = Math.hypot(uv[0], uv[1]);
        if (speed < 0.2) continue;
        const len = Math.min(24, 8 + speed * 1.6);
        const dx = (uv[0] / speed) * len, dy = (-uv[1] / speed) * len;
        const hx = x + dx / 2, hy = y + dy / 2;
        ctx.strokeStyle = WIND_SPEED_BINS[binOf(speed)].color;
        ctx.beginPath();
        ctx.moveTo(x - dx / 2, y - dy / 2);
        ctx.lineTo(hx, hy);
        const a = Math.atan2(dy, dx);
        ctx.lineTo(hx - 6 * Math.cos(a - 0.45), hy - 6 * Math.sin(a - 0.45));
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 6 * Math.cos(a + 0.45), hy - 6 * Math.sin(a + 0.45));
        ctx.stroke();
      }
    }
  }
}
