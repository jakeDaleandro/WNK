/**
 * Minimal report-layout engine on top of jsPDF. Charts are drawn as vectors
 * (not screenshots) so they stay crisp in print, and follow the dataviz mark
 * specs: thin bars with rounded data-ends, hairline grids, text in ink tokens,
 * never in series colors.
 */
import { jsPDF } from "jspdf";
import { autoTable, type RowInput, type Styles } from "jspdf-autotable";

export const palette = {
  brand: "#124032",
  brandSoft: "#effaf4",
  accent: "#f47f32",
  ink: "#1c1917",
  ink2: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  panel: "#f6f5f2",
  // Validated categorical order (blue, orange, aqua, yellow)
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
};

const PAGE_W = 612;
const PAGE_H = 792;
const M = 48;
const CONTENT_W = PAGE_W - M * 2;

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface Kpi {
  label: string;
  value: string;
  sub?: string;
}

export interface Series {
  name: string;
  color: string;
  values: number[];
}

/** Tightest clean axis: 3–5 gridline steps, each a 1/2/2.5/5 × 10ⁿ value (integers only). */
function niceScale(v: number): { max: number; ticks: number } {
  if (v <= 0) return { max: 4, ticks: 4 };
  let best = { max: Infinity, ticks: 4 };
  for (const ticks of [4, 5, 3]) {
    const raw = v / ticks;
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / exp;
    const step = Math.max((f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp, 1);
    if (!Number.isInteger(step)) continue;
    if (step * ticks < best.max) best = { max: step * ticks, ticks };
  }
  return best.max === Infinity ? { max: Math.ceil(v), ticks: 4 } : best;
}

export class Report {
  doc: jsPDF;
  y = M;
  private title: string;

  constructor(title: string) {
    this.title = title;
    this.doc = new jsPDF({ unit: "pt", format: "letter" });
    this.doc.setProperties({ title, creator: "Waste Not Kitchen", author: "Waste Not Kitchen" });
    this.doc.setLineHeightFactor(1.35);
  }

  // ----- primitives -----

  private fill(color: string) {
    this.doc.setFillColor(...hex(color));
  }
  private stroke(color: string) {
    this.doc.setDrawColor(...hex(color));
  }
  private text(color: string, size: number, style: "normal" | "bold" = "normal") {
    this.doc.setTextColor(...hex(color));
    this.doc.setFontSize(size);
    this.doc.setFont("helvetica", style);
  }

  ensure(space: number) {
    if (this.y + space > PAGE_H - M - 20) {
      this.doc.addPage();
      this.y = M;
    }
  }

  gap(n = 16) {
    this.y += n;
  }

  // ----- blocks -----

  /** Branded masthead with report title, subject line and meta rows. */
  header(opts: { kicker: string; title: string; subtitle?: string; meta: [string, string][] }) {
    const { doc } = this;
    const bandH = 132;
    this.fill(palette.brand);
    doc.rect(0, 0, PAGE_W, bandH, "F");

    // Logo mark
    this.fill("#1a7a57");
    doc.roundedRect(M, 34, 26, 26, 7, 7, "F");
    this.fill("#7fcfab");
    doc.circle(M + 13, 50, 6.5, "F");
    doc.triangle(M + 6.8, 49, M + 19.2, 49, M + 13, 38, "F");
    this.text("#ffffff", 11, "bold");
    doc.text("Waste Not Kitchen", M + 36, 51);

    this.text("#b1e4ca", 8, "bold");
    doc.text(opts.kicker.toUpperCase(), M, 86, { charSpace: 1 });
    this.text("#ffffff", 20, "bold");
    doc.text(opts.title, M, 108);

    // Meta, right-aligned in the band
    let my = 40;
    for (const [k, v] of opts.meta) {
      this.text("#b1e4ca", 7.5, "normal");
      doc.text(k.toUpperCase(), PAGE_W - M, my, { align: "right", charSpace: 0.6 });
      this.text("#ffffff", 9.5, "bold");
      doc.text(v, PAGE_W - M, my + 12, { align: "right" });
      my += 30;
    }

    this.y = bandH + 28;
    if (opts.subtitle) {
      this.text(palette.ink2, 10);
      const lines = doc.splitTextToSize(opts.subtitle, CONTENT_W);
      doc.text(lines, M, this.y);
      this.y += lines.length * 13 + 8;
    }
  }

  /** Section heading; `keepWith` reserves room so a heading never ends up alone at a page bottom. */
  section(title: string, note?: string, keepWith = 110) {
    this.ensure(34 + keepWith);
    this.gap(10);
    this.text(palette.ink, 12, "bold");
    this.doc.text(title, M, this.y);
    if (note) {
      this.text(palette.muted, 8.5);
      this.doc.text(note, PAGE_W - M, this.y, { align: "right" });
    }
    this.y += 8;
    this.stroke(palette.grid);
    this.doc.setLineWidth(0.75);
    this.doc.line(M, this.y, PAGE_W - M, this.y);
    this.y += 16;
  }

  paragraph(text: string, color = palette.ink2, size = 9.5) {
    this.text(color, size);
    const lines = this.doc.splitTextToSize(text, CONTENT_W);
    this.ensure(lines.length * 13);
    this.doc.text(lines, M, this.y);
    this.y += lines.length * size * 1.35 + 6;
  }

  kpis(items: Kpi[]) {
    const { doc } = this;
    const cols = Math.min(items.length, 4);
    const gapX = 10;
    const w = (CONTENT_W - gapX * (cols - 1)) / cols;
    const h = 64;
    const rows = Math.ceil(items.length / cols);
    this.ensure(rows * (h + 10));
    items.forEach((k, i) => {
      const x = M + (i % cols) * (w + gapX);
      const y = this.y + Math.floor(i / cols) * (h + 10);
      this.fill(palette.panel);
      doc.roundedRect(x, y, w, h, 8, 8, "F");
      this.text(palette.ink2, 8);
      doc.text(k.label, x + 12, y + 18);
      this.text(palette.ink, 17, "bold");
      doc.text(k.value, x + 12, y + 41);
      if (k.sub) {
        this.text(palette.muted, 7.5);
        doc.text(k.sub, x + 12, y + 55);
      }
    });
    this.y += rows * (h + 10) + 4;
  }

  legend(series: { name: string; color: string }[], x = M) {
    let cx = x;
    for (const s of series) {
      this.fill(s.color);
      this.doc.roundedRect(cx, this.y - 7, 8, 8, 2, 2, "F");
      this.text(palette.ink2, 8.5);
      this.doc.text(s.name, cx + 12, this.y);
      cx += 12 + this.doc.getTextWidth(s.name) + 16;
    }
    this.y += 14;
  }

  /** Column chart; multiple series stack with a 2pt surface gap between segments. */
  columns(opts: { labels: string[]; series: Series[]; height?: number; format?: (n: number) => string }) {
    const { doc } = this;
    const fmt = opts.format ?? ((n: number) => Math.round(n).toLocaleString("en-US"));
    const h = opts.height ?? 170;
    if (opts.series.length > 1) this.ensure(h + 50);
    else this.ensure(h + 36);
    if (opts.series.length > 1) this.legend(opts.series);

    const axisW = 44;
    const x0 = M + axisW;
    const plotW = CONTENT_W - axisW;
    const top = this.y + 6;
    const base = top + h;
    const n = opts.labels.length;
    const totals = opts.labels.map((_, i) => opts.series.reduce((s, se) => s + (se.values[i] ?? 0), 0));
    const { max, ticks } = niceScale(Math.max(...totals, 0));

    // Grid + y ticks
    doc.setLineWidth(0.5);
    for (let t = 0; t <= ticks; t++) {
      const v = (max / ticks) * t;
      const y = base - (v / max) * h;
      this.stroke(t === 0 ? palette.baseline : palette.grid);
      doc.line(x0, y, x0 + plotW, y);
      this.text(palette.muted, 7.5);
      doc.text(fmt(v), x0 - 6, y + 2.5, { align: "right" });
    }

    const band = plotW / Math.max(n, 1);
    const barW = Math.min(18, band * 0.62);
    const labelEvery = Math.ceil(n / 14);

    opts.labels.forEach((label, i) => {
      const cx = x0 + band * i + band / 2;
      let yCursor = base;
      const stack = opts.series.map((s) => s.values[i] ?? 0);
      const lastNonZero = stack.reduce((acc, v, idx) => (v > 0 ? idx : acc), -1);
      stack.forEach((v, si) => {
        if (v <= 0) return;
        const segH = (v / max) * h;
        const gap = si > 0 && yCursor < base ? 1.5 : 0;
        const yTop = yCursor - segH;
        const drawH = Math.max(segH - gap, 0.8);
        this.fill(opts.series[si].color);
        if (si === lastNonZero && drawH > 4) {
          // Rounded data-end, square at the baseline side.
          const r = Math.min(3, barW / 2);
          doc.roundedRect(cx - barW / 2, yTop, barW, drawH, r, r, "F");
          doc.rect(cx - barW / 2, yTop + drawH / 2, barW, drawH / 2, "F");
        } else {
          doc.rect(cx - barW / 2, yTop, barW, drawH, "F");
        }
        yCursor = yTop;
      });
      if (i % labelEvery === 0) {
        this.text(palette.muted, 7);
        doc.text(label, cx, base + 12, { align: "center" });
      }
    });

    // Label the peak only (selective direct labeling).
    const peak = totals.indexOf(Math.max(...totals));
    if (peak >= 0 && totals[peak] > 0) {
      const cx = x0 + band * peak + band / 2;
      this.text(palette.ink, 7.5, "bold");
      doc.text(fmt(totals[peak]), cx, base - (totals[peak] / max) * h - 5, { align: "center" });
    }

    this.y = base + 28;
  }

  /** Horizontal bars with the value at each tip. */
  bars(opts: { rows: { label: string; value: number }[]; color?: string; format?: (n: number) => string }) {
    const { doc } = this;
    const fmt = opts.format ?? ((n: number) => Math.round(n).toLocaleString("en-US"));
    const rowH = 20;
    this.ensure(opts.rows.length * rowH + 16);
    const labelW = 150;
    const x0 = M + labelW;
    const plotW = CONTENT_W - labelW - 60;
    const max = Math.max(...opts.rows.map((r) => r.value), 1);
    const color = opts.color ?? palette.series[0];

    opts.rows.forEach((r, i) => {
      const y = this.y + i * rowH;
      this.text(palette.ink2, 8.5);
      const label = doc.splitTextToSize(r.label, labelW - 12)[0] as string;
      doc.text(label, M, y + 9);
      this.fill(palette.panel);
      doc.roundedRect(x0, y + 1, plotW, 11, 2, 2, "F");
      const w = (r.value / max) * plotW;
      if (w > 0) {
        this.fill(color);
        doc.roundedRect(x0, y + 1, Math.max(w, 3), 11, 2, 2, "F");
      }
      this.text(palette.ink, 8.5, "bold");
      doc.text(fmt(r.value), x0 + Math.max(w, 3) + 6, y + 9.5);
    });
    this.y += opts.rows.length * rowH + 10;
  }

  table(opts: {
    head: string[];
    body: RowInput[];
    align?: ("left" | "right" | "center")[];
    foot?: RowInput[];
    widths?: (number | "auto")[];
  }) {
    const columnStyles: Record<number, Partial<Styles>> = {};
    opts.align?.forEach((a, i) => (columnStyles[i] = { halign: a }));
    opts.widths?.forEach((w, i) => (columnStyles[i] = { ...columnStyles[i], cellWidth: w }));
    this.ensure(60);
    autoTable(this.doc, {
      startY: this.y,
      head: [opts.head],
      body: opts.body,
      foot: opts.foot,
      showFoot: "lastPage",
      margin: { left: M, right: M, top: M, bottom: M + 20 },
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: hex(palette.ink),
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        lineColor: hex(palette.grid),
      },
      headStyles: {
        fillColor: hex(palette.panel),
        textColor: hex(palette.ink2),
        fontStyle: "bold",
        fontSize: 7.5,
      },
      footStyles: { fontStyle: "bold", textColor: hex(palette.ink), fillColor: hex(palette.brandSoft) },
      bodyStyles: { lineWidth: { bottom: 0.5 } },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === "head" || data.section === "foot") {
          const a = opts.align?.[data.column.index];
          if (a) data.cell.styles.halign = a;
        }
      },
    });
    this.y = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  note(text: string) {
    this.ensure(50);
    this.fill(palette.brandSoft);
    const lines = this.doc.splitTextToSize(text, CONTENT_W - 24);
    const h = lines.length * 12 + 18;
    this.doc.roundedRect(M, this.y, CONTENT_W, h, 6, 6, "F");
    this.text(palette.brand, 8.5);
    this.doc.text(lines, M + 12, this.y + 16);
    this.y += h + 14;
  }

  empty(message: string) {
    this.ensure(50);
    this.stroke(palette.grid);
    this.doc.setLineDashPattern([3, 3], 0);
    this.doc.roundedRect(M, this.y, CONTENT_W, 40, 6, 6, "S");
    this.doc.setLineDashPattern([], 0);
    this.text(palette.muted, 9);
    this.doc.text(message, PAGE_W / 2, this.y + 24, { align: "center" });
    this.y += 54;
  }

  /** Stamps page footers and returns the finished document. */
  finish(): jsPDF {
    const pages = this.doc.getNumberOfPages();
    const stamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    for (let p = 1; p <= pages; p++) {
      this.doc.setPage(p);
      this.stroke(palette.grid);
      this.doc.setLineWidth(0.5);
      this.doc.line(M, PAGE_H - 40, PAGE_W - M, PAGE_H - 40);
      this.text(palette.muted, 7.5);
      this.doc.text(`Waste Not Kitchen · ${this.title} · Generated ${stamp}`, M, PAGE_H - 26);
      this.doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 26, { align: "right" });
    }
    return this.doc;
  }
}
