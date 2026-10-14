/**
 * simulation/heatLayer.ts - Fire heatmap from /layers/heatmap on a canvas above the tiles.
 * Adopted directly from ITHACKITS/FE-FORGEHACK-2026.
 */

import type L from "leaflet";

export interface HeatCell {
  lat: number;
  lon: number;
  count: number;
  frp_sum: number;
}

const DEG = Math.PI / 180;

/** Palette stops shared with the legend (low to high intensity). */
export const HEAT_STOPS: [number, string][] = [
  [0.0, "rgba(254,240,138,0)"],
  [0.25, "rgba(253,224,71,0.75)"],
  [0.5, "rgba(251,146,60,0.85)"],
  [0.75, "rgba(220,38,38,0.9)"],
  [1.0, "rgba(127,29,29,0.95)"]
];

function makePalette(): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  HEAT_STOPS.forEach(([s, col]) => g.addColorStop(s, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

export class HeatLeafletLayer {
  private readonly map: L.Map;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly palette = makePalette();
  private cells: HeatCell[] = [];
  private maxFrp = 1;
  private cellDeg = 0.25;
  private visible = false;

  constructor(map: L.Map) {
    this.map = map;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "heat-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      zIndex: "430",
      pointerEvents: "none",
      display: "none"
    });
    map.getContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    map.on("moveend", this.draw);
    map.on("resize", this.draw);
    map.on("movestart", this.hideWhileMoving);
  }

  setData(cells: HeatCell[], maxFrp: number, cellDeg: number) {
    this.cells = cells;
    this.maxFrp = Math.max(1, maxFrp);
    this.cellDeg = cellDeg;
    this.draw();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.canvas.style.display = visible ? "block" : "none";
    this.draw();
  }

  destroy() {
    this.map.off("moveend", this.draw);
    this.map.off("resize", this.draw);
    this.map.off("movestart", this.hideWhileMoving);
    this.canvas.remove();
  }

  private hideWhileMoving = () => {
    this.canvas.style.opacity = "0";
  };

  private draw = () => {
    const size = this.map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    this.canvas.style.opacity = "1";
    const ctx = this.ctx;
    ctx.clearRect(0, 0, size.x, size.y);
    if (!this.visible || this.cells.length === 0) return;

    const zoom = this.map.getZoom();
    const scale = 256 * Math.pow(2, zoom);
    const origin = this.map.getPixelOrigin();
    const pane = this.map.containerPointToLayerPoint([0, 0]);
    const offX = -origin.x - pane.x;
    const offY = -origin.y - pane.y;
    const cellPx = (this.cellDeg / 360) * scale;
    const radius = Math.max(10, Math.min(60, cellPx * 1.6));

    for (const c of this.cells) {
      const x = (scale * (c.lon + 180)) / 360 + offX;
      const sinLat = Math.sin(c.lat * DEG);
      const y = scale * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) + offY;
      if (x < -radius || y < -radius || x > size.x + radius || y > size.y + radius) continue;
      const w = Math.min(1, Math.sqrt(c.frp_sum / this.maxFrp) * 0.9 + 0.12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(0,0,0,${w})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const img = ctx.getImageData(0, 0, size.x, size.y);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) {
      const a = px[i];
      if (a === 0) continue;
      const k = a * 4;
      px[i - 3] = this.palette[k];
      px[i - 2] = this.palette[k + 1];
      px[i - 1] = this.palette[k + 2];
      px[i] = this.palette[k + 3];
    }
    ctx.putImageData(img, 0, 0);
  };
}
