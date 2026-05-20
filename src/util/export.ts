import { PALETTE, Topo } from "../state/types";
import { effectivePoints } from "../state/computed";
import { catmullRomPath } from "./spline";

export function buildSvgString(topo: Topo): string {
  const image = topo.image;
  if (!image) return "";
  const W = image.width;
  const H = image.height;
  const baseSize = Math.min(W, H);
  const lineWidth = baseSize * 0.002;
  const startR = baseSize * 0.022;
  const startFontSize = baseSize * 0.025;
  const endR = baseSize * 0.010;

  const byId = new Map(topo.routes.map((r) => [r.id, r]));

  const routes = topo.routes
    .map((r) => {
      const startColor = PALETTE[r.color];
      const eff = effectivePoints(r, byId);
      const px = eff.map((p) => ({ x: p.x * W, y: p.y * H }));
      if (px.length === 0) return "";
      const path = catmullRomPath(px);
      const start = px[0];
      const end = px[px.length - 1];
      const numFill = r.color === "white" ? "#000" : "#fff";
      const isVariation = r.branchFrom !== undefined;
      const parts: string[] = [];
      parts.push(
        `<path d="${path}" stroke="#fff" stroke-width="${lineWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
      if (px.length >= 2) {
        parts.push(
          `<circle cx="${end.x}" cy="${end.y}" r="${endR}" fill="#fff"/>`,
        );
      }
      // Skip the numbered start chip for variations — their start is the parent's anchor,
      // which the parent already renders.
      if (!isVariation) {
        parts.push(
          `<circle cx="${start.x}" cy="${start.y}" r="${startR}" fill="${startColor}"/>`,
          `<text x="${start.x}" y="${start.y}" font-size="${startFontSize}" fill="${numFill}" text-anchor="middle" dominant-baseline="central" font-weight="700" font-family="JetBrains Mono, ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, monospace">${r.number}</text>`,
        );
      }
      return parts.join("");
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<image href="${image.dataUrl}" width="${W}" height="${H}"/>` +
    routes +
    `</svg>`
  );
}

export async function exportTopoPng(topo: Topo): Promise<Blob> {
  if (!topo.image) throw new Error("No image to export");
  const { width, height } = topo.image;
  const svg = buildSvgString(topo);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to render SVG to image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
