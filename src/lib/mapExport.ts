import { Polyline, type LatLng, type Map as LeafletMap } from 'leaflet';
import { RESTAURANTS, type Restaurant } from './kolkataRestaurants';
import type { LandmarkZone } from './kolkataLandmarks';

/**
 * Map download: draws what the map shows right now (tiles, route lines and markers, read from the page) onto a
 * canvas, then adds a header, numbered restaurants and a restaurant legend that exist in the file only.
 */

const SCALE = 2;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TEXT_FONT = 'Inter,"Segoe UI",system-ui,-apple-system,Roboto,sans-serif';
const INK = '#111111';
const MUTED = '#6b7280';
const ACCENT = '#e11d48';
const HEADER_H = 64;
const FOOTER_H = 38;
const LEGEND_ZONES: LandmarkZone[] = ['North', 'South', 'East', 'West'];

export class MapExportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MapExportError';
    }
}

const loadSvgImage = (svg: SVGElement) => new Promise<HTMLImageElement | null>((resolve) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
});

const flattenLatLngs = (value: unknown): LatLng[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => (Array.isArray(item) ? flattenLatLngs(item) : [item as LatLng]));
};

const drawEmoji = (ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, sizePx: number) => {
    ctx.save();
    ctx.font = `${sizePx * SCALE}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // White halo (two passes), then a soft shadow, to match how the marker looks on screen.
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 3 * SCALE;
    ctx.fillText(emoji, x * SCALE, y * SCALE);
    ctx.fillText(emoji, x * SCALE, y * SCALE);
    ctx.shadowColor = 'rgba(20,20,20,0.4)';
    ctx.shadowBlur = 3 * SCALE;
    ctx.shadowOffsetY = 2 * SCALE;
    ctx.fillText(emoji, x * SCALE, y * SCALE);
    ctx.restore();
};

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
    return `${result}…`;
};

const drawBadge = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, radius: number, fill = ACCENT) => {
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,20,0.35)';
    ctx.shadowBlur = 3 * SCALE;
    ctx.shadowOffsetY = SCALE;
    ctx.beginPath();
    ctx.arc(x * SCALE, y * SCALE, radius * SCALE, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.6 * SCALE;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${(label.length > 1 ? radius * 0.95 : radius * 1.15) * SCALE}px ${TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x * SCALE, y * SCALE + 0.5 * SCALE);
    ctx.restore();
};

/** Draws the live map (tiles, lines, markers, numbered restaurants) with its top-left corner at (0, offsetY). */
const drawMap = async (ctx: CanvasRenderingContext2D, map: LeafletMap, offsetY: number) => {
    const container = map.getContainer();
    const box = container.getBoundingClientRect();
    const size = map.getSize();

    ctx.save();
    ctx.translate(0, offsetY * SCALE);
    ctx.beginPath();
    ctx.rect(0, 0, size.x * SCALE, size.y * SCALE);
    ctx.clip();
    ctx.fillStyle = '#e5e3df';
    ctx.fillRect(0, 0, size.x * SCALE, size.y * SCALE);

    // Tiles, lowest zoom level first so a fading old level never covers a fresh one.
    const tiles = Array.from(container.querySelectorAll<HTMLImageElement>('img.leaflet-tile'))
        .filter((tile) => tile.complete && tile.naturalWidth > 0)
        .map((tile) => ({ tile, z: Number((tile.closest('.leaflet-tile-container') as HTMLElement | null)?.style.zIndex) || 0 }))
        .sort((a, b) => a.z - b.z);
    if (!tiles.length) throw new MapExportError('The map tiles are still loading. Try again in a moment.');
    for (const { tile } of tiles) {
        const rect = tile.getBoundingClientRect();
        ctx.drawImage(tile, (rect.left - box.left) * SCALE, (rect.top - box.top) * SCALE, rect.width * SCALE, rect.height * SCALE);
    }

    // Route lines.
    map.eachLayer((layer) => {
        if (!(layer instanceof Polyline)) return;
        const points = flattenLatLngs(layer.getLatLngs()).map((latlng) => map.latLngToContainerPoint(latlng));
        if (points.length < 2) return;
        const { color = '#3388ff', weight = 3, opacity = 1 } = layer.options;
        ctx.save();
        ctx.beginPath();
        points.forEach((p, index) => (index === 0 ? ctx.moveTo(p.x * SCALE, p.y * SCALE) : ctx.lineTo(p.x * SCALE, p.y * SCALE)));
        ctx.strokeStyle = color;
        ctx.lineWidth = weight * SCALE;
        ctx.globalAlpha = opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    });

    // Markers, in the same stacking order as on screen.
    const icons = Array.from(container.querySelectorAll<HTMLElement>('.leaflet-marker-pane .leaflet-marker-icon'))
        .map((el) => ({ el, z: Number(el.style.zIndex) || 0 }))
        .sort((a, b) => a.z - b.z);
    for (const { el } of icons) {
        const emojiEl = el.querySelector<HTMLElement>('.map2-emoji-marker');
        const svgEl = el.querySelector<SVGElement>('svg');
        const dotEl = el.querySelector<HTMLElement>('.map2-user-dot');
        if (emojiEl) {
            const rect = emojiEl.getBoundingClientRect();
            const fontSize = parseFloat(getComputedStyle(emojiEl).fontSize) || 22;
            drawEmoji(ctx, emojiEl.textContent || '', rect.left - box.left + rect.width / 2, rect.top - box.top + rect.height / 2, fontSize);
        } else if (svgEl) {
            const image = await loadSvgImage(svgEl);
            if (!image) continue;
            const rect = svgEl.getBoundingClientRect();
            ctx.save();
            ctx.shadowColor = 'rgba(20,20,20,0.3)';
            ctx.shadowBlur = 5 * SCALE;
            ctx.shadowOffsetY = 3 * SCALE;
            ctx.drawImage(image, (rect.left - box.left) * SCALE, (rect.top - box.top) * SCALE, rect.width * SCALE, rect.height * SCALE);
            ctx.restore();
        } else if (dotEl) {
            const rect = dotEl.getBoundingClientRect();
            const cx = (rect.left - box.left + rect.width / 2) * SCALE;
            const cy = (rect.top - box.top + rect.height / 2) * SCALE;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, (rect.width / 2 + 8) * SCALE, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(25,118,255,0.18)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, (rect.width / 2) * SCALE, 0, Math.PI * 2);
            ctx.fillStyle = '#1976ff';
            ctx.fill();
            ctx.lineWidth = 3 * SCALE;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.restore();
        }
    }

    // Numbered restaurants: these numbers are in the downloaded file only.
    const inView = new Set<number>();
    for (const restaurant of RESTAURANTS) {
        const p = map.latLngToContainerPoint([restaurant.lat, restaurant.lng]);
        if (p.x < -12 || p.y < -12 || p.x > size.x + 12 || p.y > size.y + 12) continue;
        inView.add(restaurant.number);
        drawBadge(ctx, String(restaurant.number), p.x + 13, p.y - 15, 10.5);
    }

    ctx.restore();
    return inView;
};

interface LegendRow {
    kind: 'zone' | 'item';
    zone?: LandmarkZone;
    restaurant?: Restaurant;
    height: number;
}

const ZONE_ROW_H = 30;
const ITEM_ROW_H = 40;

/** Draws the restaurant legend into the block starting at `top` and returns the block's height. */
const drawLegend = (ctx: CanvasRenderingContext2D, width: number, top: number, inView: Set<number>, draw: boolean) => {
    const pad = 20;
    const columns = width >= 900 ? 4 : width >= 620 ? 3 : width >= 420 ? 2 : 1;
    const gap = 18;
    const colWidth = (width - pad * 2 - gap * (columns - 1)) / columns;

    const rows: LegendRow[] = [];
    for (const zone of LEGEND_ZONES) {
        const inZone = RESTAURANTS.filter((item) => item.zone === zone);
        if (!inZone.length) continue;
        rows.push({ kind: 'zone', zone, height: ZONE_ROW_H });
        inZone.forEach((restaurant) => rows.push({ kind: 'item', restaurant, height: ITEM_ROW_H }));
    }

    // Flow the rows into columns top to bottom, never leaving a zone heading alone at the bottom of a column.
    const total = rows.reduce((sum, row) => sum + row.height, 0);
    const target = total / columns;
    const placed: Array<{ row: LegendRow; col: number; y: number }> = [];
    const colHeights = new Array<number>(columns).fill(0);
    let col = 0;
    rows.forEach((row) => {
        const needed = row.kind === 'zone' ? row.height + ITEM_ROW_H : row.height;
        if (col < columns - 1 && colHeights[col] > 0 && colHeights[col] + needed > target + ITEM_ROW_H / 2) col += 1;
        placed.push({ row, col, y: colHeights[col] });
        colHeights[col] += row.height;
    });

    const titleH = 92;
    const bodyH = Math.max(...colHeights);
    const blockH = titleH + bodyH + 18;
    if (!draw) return blockH;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, top * SCALE, width * SCALE, blockH * SCALE);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${18 * SCALE}px ${TEXT_FONT}`;
    ctx.fillText('Restaurant guide', pad * SCALE, (top + 34) * SCALE);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${12 * SCALE}px ${TEXT_FONT}`;
    ctx.fillText(fitText(ctx, 'Numbers match the red markers on the map.', (width - pad * 2) * SCALE), pad * SCALE, (top + 56) * SCALE);
    ctx.fillText(fitText(ctx, 'Restaurants outside this view are listed too.', (width - pad * 2) * SCALE), pad * SCALE, (top + 74) * SCALE);

    for (const { row, col: column, y } of placed) {
        const x = pad + column * (colWidth + gap);
        const rowTop = top + titleH + y;
        if (row.kind === 'zone') {
            ctx.fillStyle = INK;
            ctx.font = `800 ${11 * SCALE}px ${TEXT_FONT}`;
            ctx.fillText(`${row.zone!.toUpperCase()} KOLKATA`, x * SCALE, (rowTop + 16) * SCALE);
            ctx.fillStyle = ACCENT;
            ctx.fillRect(x * SCALE, (rowTop + 22) * SCALE, 26 * SCALE, 2 * SCALE);
        } else if (row.restaurant) {
            const restaurant = row.restaurant;
            const visible = inView.has(restaurant.number);
            drawBadge(ctx, String(restaurant.number), x + 11, rowTop + 15, 10, visible ? ACCENT : '#9ca3af');
            ctx.textAlign = 'left';
            ctx.fillStyle = INK;
            ctx.font = `700 ${13 * SCALE}px ${TEXT_FONT}`;
            ctx.fillText(fitText(ctx, restaurant.name, (colWidth - 30) * SCALE), (x + 28) * SCALE, (rowTop + 13) * SCALE);
            ctx.fillStyle = MUTED;
            ctx.font = `500 ${11 * SCALE}px ${TEXT_FONT}`;
            ctx.fillText(
                fitText(ctx, `${restaurant.cuisine}${visible ? '' : ' · outside this view'}`, (colWidth - 30) * SCALE),
                (x + 28) * SCALE,
                (rowTop + 28) * SCALE,
            );
        }
    }
    ctx.restore();
    return blockH;
};

export const renderMapExport = async (map: LeafletMap): Promise<HTMLCanvasElement> => {
    const size = map.getSize();
    const width = Math.max(320, Math.round(size.x));
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) throw new MapExportError('Your browser could not create the image.');

    const legendHeight = drawLegend(measure, width, 0, new Set(), false);
    const height = HEADER_H + size.y + legendHeight + FOOTER_H;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * SCALE);
    canvas.height = Math.round(height * SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new MapExportError('Your browser could not create the image.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, canvas.width, HEADER_H * SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${20 * SCALE}px ${TEXT_FONT}`;
    ctx.fillText('Kolkata map', 20 * SCALE, 30 * SCALE);
    ctx.fillStyle = '#d1d5db';
    ctx.font = `500 ${12 * SCALE}px ${TEXT_FONT}`;
    ctx.fillText('The Better Pass', 20 * SCALE, 50 * SCALE);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), (width - 20) * SCALE, 50 * SCALE);

    let inView: Set<number>;
    try {
        inView = await drawMap(ctx, map, HEADER_H);
    } catch (error) {
        if (error instanceof MapExportError) throw error;
        throw new MapExportError('The map could not be captured. Please try again.');
    }

    drawLegend(ctx, width, HEADER_H + size.y, inView, true);

    // Footer (the OpenStreetMap credit is required wherever its map is shown)
    const footerTop = height - FOOTER_H;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, footerTop * SCALE, canvas.width, FOOTER_H * SCALE);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    ctx.font = `500 ${11 * SCALE}px ${TEXT_FONT}`;
    ctx.fillText(fitText(ctx, 'Map data © OpenStreetMap contributors', (width - 40) * SCALE), 20 * SCALE, (footerTop + 23) * SCALE);

    return canvas;
};

const fileName = (extension: 'png' | 'pdf') => `kolkata-map-${new Date().toISOString().slice(0, 10)}.${extension}`;

const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const downloadMapAsPng = async (map: LeafletMap) => {
    const canvas = await renderMapExport(map);
    const blob = await new Promise<Blob | null>((resolve) => {
        try {
            canvas.toBlob(resolve, 'image/png');
        } catch {
            resolve(null);
        }
    });
    if (!blob) throw new MapExportError('The image could not be saved. Please try again.');
    saveBlob(blob, fileName('png'));
};

export const downloadMapAsPdf = async (map: LeafletMap) => {
    const canvas = await renderMapExport(map);
    let dataUrl: string;
    try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    } catch {
        throw new MapExportError('The PDF could not be created. Please try again.');
    }
    const { jsPDF } = await import('jspdf');
    const width = canvas.width / SCALE;
    const height = canvas.height / SCALE;
    const pdf = new jsPDF({
        orientation: width >= height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
        compress: true,
        hotfixes: ['px_scaling'],
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    pdf.save(fileName('pdf'));
};
