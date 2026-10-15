import React, { useEffect, useRef } from "react";

export interface VineFrameProps {
  radius?: number | [number, number, number, number];
  runs?: [number, number][];
  seed?: number;
  className?: string;
  season?: string;
  isNavbarEdges?: boolean;
}

/**
 * VineFrame: Mengadopsi 1:1 algoritma sulur merambat dari Landing Page HelaLoka.
 * Menghitung keliling (perimeter guide) elemen induk secara akurat, lalu merayapkan
 * batang bergelombang di tepi border, daun yang mencuat ke luar, serta bunga-bunga mekar.
 */
export const VineFrame: React.FC<VineFrameProps> = ({
  radius,
  runs,
  seed = 1,
  className = "",
  season = "sunrise",
  isNavbarEdges = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !svg.parentElement) return;
    const host = svg.parentElement;

    const NS = "http://www.w3.org/2000/svg";
    const P = 14;
    let lw = 0;
    let lh = 0;

    const el = (n: string, a: Record<string, any>, p?: SVGElement) => {
      const e = document.createElementNS(NS, n);
      for (const k in a) e.setAttribute(k, String(a[k]));
      (p || svg).appendChild(e);
      return e;
    };

    const f2 = (v: number) => v.toFixed(1);

    const build = () => {
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      if (!w || !h || (Math.abs(w - lw) < 2 && Math.abs(h - lh) < 2)) return;
      lw = w;
      lh = h;

      svg.setAttribute("viewBox", `0 0 ${w + 2 * P} ${h + 2 * P}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      let effectiveR = Array.isArray(radius)
        ? radius
        : typeof radius === "number"
        ? [radius, radius, radius, radius]
        : null;

      if (!effectiveR) {
        try {
          const cs = window.getComputedStyle(host);
          effectiveR = [
            parseFloat(cs.borderTopLeftRadius) || 14,
            parseFloat(cs.borderTopRightRadius) || 14,
            parseFloat(cs.borderBottomRightRadius) || 14,
            parseFloat(cs.borderBottomLeftRadius) || 14
          ];
        } catch {
          effectiveR = [14, 14, 14, 14];
        }
      }

      const r = effectiveR.map((v) => Math.min(v, h / 2, w / 2));
      const x0 = P,
        y0 = P,
        x1 = P + w,
        y1 = P + h;

      // Panduan keliling tertutup persis tepi kotak (perimeter border guide)
      const d = `M${x0 + r[0]} ${y0}H${x1 - r[1]}A${r[1]} ${r[1]} 0 0 1 ${x1} ${y0 + r[1]}V${y1 - r[2]}A${r[2]} ${r[2]} 0 0 1 ${x1 - r[2]} ${y1}H${x0 + r[3]}A${r[3]} ${r[3]} 0 0 1 ${x0} ${y1 - r[3]}V${y0 + r[0]}A${r[0]} ${r[0]} 0 0 1 ${x0 + r[0]} ${y0}Z`;

      const guide = el("path", { d, fill: "none", stroke: "none" });
      const L = (guide as SVGGeometryElement).getTotalLength();
      if (!L) return;

      let effectiveRuns = runs;
      if (isNavbarEdges) {
        // Tepi navbar kiri dan kanan: tidak maksa panjang ke tengah, persis landing page!
        const leftSpan = Math.min(95, w * 0.12);
        const rightSpan = Math.min(95, w * 0.12);
        effectiveRuns = [
          [(L - leftSpan) / L, (L + leftSpan) / L],
          [(w - rightSpan) / L, (w + h + rightSpan) / L]
        ];
      } else if (!effectiveRuns || !effectiveRuns.length) {
        const s = seed || 1;
        effectiveRuns = [
          [0.82 + ((s * 0.11) % 0.08), 1.16 + ((s * 0.07) % 0.08)],
          [0.34 + ((s * 0.09) % 0.08), 0.66 + ((s * 0.06) % 0.08)]
        ];
      }

      const LEAF =
        "M0 0C-3.6-2.2-6.4-6.6-4.6-10.6-3.4-13.2-1.2-13.4 0-15.6 1.2-13.4 3.4-13.2 4.6-10.6 6.4-6.6 3.6-2.2 0 0Z";
      let n = 0;

      effectiveRuns.forEach((run, ri) => {
        const pts: [number, number][] = [];
        const a = run[0] * L,
          b = run[1] * L;
        for (let s = a; s <= b; s += 4) {
          const q = (guide as SVGGeometryElement).getPointAtLength(((s % L) + L) % L);
          pts.push([q.x, q.y]);
        }
        if (pts.length < 3) return;

        // Vektor normal tegak lurus terhadap tepi
        const N = pts.map((_, i) => {
          const A = pts[Math.max(0, i - 1)],
            B = pts[Math.min(pts.length - 1, i + 1)];
          const tx = B[0] - A[0],
            ty = B[1] - A[1];
          const l = Math.hypot(tx, ty) || 1;
          return [tx / l, ty / l, ty / l, -tx / l];
        });

        // Batang bergelombang menyusuri tepi kartu
        const S = pts.map((p, i) => {
          const o = 1.6 * Math.sin(i * 0.55 + (seed || 1) + ri * 2);
          return [p[0] + N[i][2] * o, p[1] + N[i][3] * o];
        });

        let sd = "";
        S.forEach((p, i) => {
          sd += (i ? "L" : "M") + f2(p[0]) + " " + f2(p[1]);
        });
        el("path", { d: sd, class: "wc-stem" });

        for (let i = 2; i < S.length - 2; i += 3) {
          const t = N[i],
            side = n % 2 ? 1 : -1;
          const ang = (side > 0 ? 0.6 : -0.6) + Math.sin(n * 1.9 + (seed || 1)) * 0.25;
          const out = n % 5 === 4 ? -0.35 : 1;
          let vx = (t[2] * Math.cos(ang) + t[0] * Math.sin(ang)) * out;
          let vy = (t[3] * Math.cos(ang) + t[1] * Math.sin(ang)) * out;
          if (out < 0) {
            vx = t[0] * side * 0.8 - t[2] * 0.3;
            vy = t[1] * side * 0.8 - t[3] * 0.3;
          }
          const rot = (Math.atan2(vx, -vy) * 180) / Math.PI;
          const sc = (out < 0 ? 0.42 : 0.62 + 0.18 * Math.sin(n * 1.3 + (seed || 1))).toFixed(2);
          const g = el("g", {
            transform: `translate(${f2(S[i][0])} ${f2(S[i][1])}) rotate(${rot.toFixed(0)}) scale(${sc})`
          });

          // Daun
          el("path", { d: LEAF, class: `wc-leaf${n % 3 === 0 ? " b" : ""}` }, g);
          // Tulang daun
          el("path", { d: "M0-1.5L0-12.5M0-5L-2.4-8M0-8L2.2-10.6", class: "wc-vein" }, g);

          // Bunga mekar cantik alami
          if (n % 4 === 1 || n % 7 === 3) {
            const fg = el("g", {
              class: "wc-fl",
              transform: `translate(${f2(S[i + 1][0])} ${f2(S[i + 1][1])}) rotate(${(n * 37) % 360}) scale(0.9)`
            });
            for (let k = 0; k < 5; k++) {
              el(
                "ellipse",
                { rx: "2.3", ry: "3.4", transform: `rotate(${k * 72}) translate(0 -2.9)` },
                fg
              );
            }
            el("circle", { r: "1.5", class: "wc-ctr" }, fg);
          }

          // Sulur pilin
          if (n % 8 === 5) {
            el(
              "path",
              {
                d: "M0 0C0-4 1.5-7.5 4.6-8.2 7.4-8.8 8.4-5.6 6.4-4.2 4.8-3.1 3.6-4.6 4.7-5.6",
                class: "wc-tendril",
                transform: `translate(${f2(S[i][0])} ${f2(S[i][1])}) rotate(${(rot + 180 * (side < 0 ? 1 : 0)).toFixed(0)}) scale(0.9)`
              }
            );
          }
          n++;
        }
      });

      svg.removeChild(guide);
    };

    build();
    const rafId = requestAnimationFrame(build);
    const timerId = setTimeout(build, 80);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        build();
      });
      ro.observe(host);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      if (ro) ro.disconnect();
    };
  }, [radius, runs, seed, isNavbarEdges]);

  return (
    <svg
      ref={svgRef}
      className={`vframe ${className}`}
      data-s={season}
      aria-hidden="true"
    />
  );
};
