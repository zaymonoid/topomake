import { PALETTE, Topo } from "../state/types";
import { catmullRomPath } from "./spline";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

export function buildSvgString(topo: Topo): string {
  if (!topo.imageDataUrl) return "";
  const W = topo.imageWidth;
  const H = topo.imageHeight;
  const baseSize = Math.min(W, H);
  const lineWidth = baseSize * 0.002;
  const startR = baseSize * 0.022;
  const startFontSize = baseSize * 0.025;
  const endR = baseSize * 0.010;

  const routes = topo.routes
    .map((r) => {
      const startColor = PALETTE[r.color];
      const px = r.points.map((p) => ({ x: p.x * W, y: p.y * H }));
      if (px.length === 0) return "";
      const path = catmullRomPath(px);
      const start = px[0];
      const end = px[px.length - 1];
      const numFill = r.color === "white" ? "#000" : "#fff";
      const parts: string[] = [];
      parts.push(
        `<path d="${path}" stroke="#fff" stroke-width="${lineWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
      if (px.length >= 2) {
        parts.push(
          `<circle cx="${end.x}" cy="${end.y}" r="${endR}" fill="#fff"/>`,
        );
      }
      parts.push(
        `<circle cx="${start.x}" cy="${start.y}" r="${startR}" fill="${startColor}"/>`,
        `<text x="${start.x}" y="${start.y}" font-size="${startFontSize}" fill="${numFill}" text-anchor="middle" dominant-baseline="central" font-weight="700" font-family="JetBrains Mono, ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, monospace">${r.number}</text>`,
      );
      return parts.join("");
    })
    .join("");

  let banner = "";
  if (topo.showBanner) {
    const bannerW = W * 0.3;
    const bannerH = H * 0.06;
    const bannerX = W * 0.02;
    const bannerY = H * 0.02;
    banner =
      `<rect x="${bannerX}" y="${bannerY}" width="${bannerW}" height="${bannerH}" fill="#1e3a8a"/>` +
      `<text x="${bannerX + W * 0.015}" y="${bannerY + bannerH / 2}" font-size="${H * 0.035}" fill="#fff" font-weight="800" dominant-baseline="central" font-family="-apple-system, system-ui, sans-serif">${escapeXml(topo.name.toUpperCase())}</text>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<image href="${topo.imageDataUrl}" width="${W}" height="${H}"/>` +
    banner +
    routes +
    `</svg>`
  );
}

export async function exportTopoPng(topo: Topo): Promise<Blob> {
  if (!topo.imageDataUrl) throw new Error("No image to export");
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
    canvas.width = topo.imageWidth;
    canvas.height = topo.imageHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, topo.imageWidth, topo.imageHeight);
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
