// Catmull-Rom -> cubic Bezier conversion.
// Returns an SVG path string. Points are in arbitrary coords (we'll pass pixels).
export function catmullRomPath(pts) {
    if (pts.length === 0)
        return "";
    if (pts.length === 1)
        return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) {
        return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    }
    const out = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        // Standard Catmull-Rom -> cubic Bezier (tension 0.5)
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        out.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
    }
    return out.join(" ");
}
