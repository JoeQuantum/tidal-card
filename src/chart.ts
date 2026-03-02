import { html, svg, nothing, TemplateResult } from 'lit';
import { TidePoint, ChartRange, HiLoPrediction, MoonPhaseInfo } from './types';
import { getCurrentTideHeight, formatShortTime } from './utils';

const WIDTH = 500;
const CHART_HEIGHT = 195;
const PLOT_TOP = 28;
const PLOT_BOTTOM = 162;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const DAY_LABEL_Y = 14;
const TIME_AXIS_Y = 185;
const LABEL_BOTTOM = TIME_AXIS_Y - 10; // max Y for peak labels below curve

export interface NightInterval {
  start: number;
  end: number;
}

function computeGridStep(range: ChartRange): number {
  const dataRange = range.max - range.min;
  return dataRange < 6 ? 1 : dataRange < 15 ? 2 : 5;
}

export function renderTideCurve(
  series: TidePoint[],
  hilos: HiLoPrediction[],
  range: ChartRange,
  now: Date,
  chartStartTime: number,
  chartEndTime: number,
  moonPhases: MoonPhaseInfo[],
  showMoonPhases: boolean,
  nightIntervals: NightInterval[] = [],
): TemplateResult | typeof nothing {
  if (series.length < 2) return nothing;

  const timeToX = (t: number): number =>
    ((t - chartStartTime) / (chartEndTime - chartStartTime)) * WIDTH;

  const heightToY = (h: number): number =>
    PLOT_TOP + PLOT_HEIGHT - ((h - range.min) / (range.max - range.min)) * PLOT_HEIGHT;

  const points = series.map((p) => ({
    x: timeToX(p.time.getTime()),
    y: heightToY(p.height),
  }));
  const pathD = monotoneCubicPath(points);
  const areaD = `${pathD} L ${points[points.length - 1].x},${PLOT_BOTTOM} L ${points[0].x},${PLOT_BOTTOM} Z`;

  const nowMs = now.getTime();
  const nowInRange = nowMs >= chartStartTime && nowMs <= chartEndTime;
  const nowX = nowInRange ? timeToX(nowMs) : 0;
  const nowHeight = nowInRange ? (getCurrentTideHeight(series, now) ?? series[0].height) : 0;
  const nowY = nowInRange ? heightToY(nowHeight) : 0;

  // Data boundary: X position of last data point — clip decorations beyond this
  const lastDataMs = series[series.length - 1].time.getTime();
  const dataEndX = Math.min(WIDTH, timeToX(lastDataMs));

  // Compute average curve Y for gradient origin
  const avgCurveY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  // Compute day label positions first so grid labels can check for overlap
  const dayLabelPositions = computeDayLabelPositions(chartStartTime, chartEndTime, timeToX, dataEndX);

  // Compute peak labels first so grid labels can avoid them (future only)
  const peakLabelRects = computeVisiblePeakLabels(hilos, chartStartTime, chartEndTime, nowMs, timeToX, heightToY);

  const gridStep = computeGridStep(range);

  return html`
    <svg viewBox="0 0 ${WIDTH} ${CHART_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tidal-fill" x1="0" y1="${avgCurveY}" x2="0" y2="${PLOT_BOTTOM}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--tidal-curve-fill-start, rgba(79,195,247,1.0))" />
          <stop offset="100%" stop-color="var(--tidal-curve-fill-end, rgba(79,195,247,0.30))" />
        </linearGradient>
        <filter id="glow">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="var(--tidal-glow-color, rgba(79,195,247,0.35))" />
        </filter>
        <clipPath id="data-clip">
          <rect x="0" y="0" width="${dataEndX}" height="${CHART_HEIGHT}" />
        </clipPath>
      </defs>

      <g clip-path="url(#data-clip)">
        ${renderDayLines(chartStartTime, chartEndTime, timeToX)}
        ${renderNightShading(nightIntervals, timeToX)}
        ${renderGridLines(range, heightToY, gridStep)}
        ${renderDayLabelsFromPositions(dayLabelPositions)}

        <path d="${areaD}" fill="url(#tidal-fill)" />

        <path d="${pathD}" fill="none"
          stroke="var(--tidal-curve-stroke, #4FC3F7)" stroke-width="4"
          filter="url(#glow)" />

        ${renderGridLabels(range, heightToY, peakLabelRects.map((l) => l.rect), gridStep)}

        ${peakLabelRects.map((lbl) => {
          const timeStr = formatShortTime(new Date(lbl.item.hl.t));
          return svg`
            <text x="${lbl.x}" y="${lbl.labelY}" text-anchor="middle"
              font-size="12" font-weight="600"
              fill="var(--primary-text-color, #212121)">${lbl.item.h.toFixed(1)}</text>
            <text x="${lbl.x}" y="${lbl.timeY}" text-anchor="middle"
              font-size="10" font-weight="400"
              fill="var(--secondary-text-color, #aaa)">${timeStr}</text>
          `;
        })}

        ${nowInRange
          ? renderNowDot(nowX, nowY)
          : nothing}

        ${renderTimeAxis(chartStartTime, chartEndTime, timeToX)}

        ${showMoonPhases
          ? renderMoonPhaseIcons(moonPhases, chartStartTime, chartEndTime, timeToX)
          : nothing}
      </g>
    </svg>
  `;
}

interface LabelRect {
  x: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface VisiblePeakLabel {
  item: { hl: HiLoPrediction; origX: number; h: number; tMs: number };
  x: number;
  peakY: number;
  labelY: number;
  timeY: number;
  rect: LabelRect;
  needsLeader: boolean;
}

function computeVisiblePeakLabels(
  hilos: HiLoPrediction[],
  chartStartTime: number,
  chartEndTime: number,
  nowMs: number,
  timeToX: (t: number) => number,
  heightToY: (h: number) => number,
): VisiblePeakLabel[] {
  const durationH = (chartEndTime - chartStartTime) / 3600000;
  const MS_PER_DAY = 24 * 3600000;

  let items: Array<{ hl: HiLoPrediction; origX: number; h: number; tMs: number }> = [];
  for (const hl of hilos) {
    const tMs = new Date(hl.t).getTime();
    // Only label future peaks within the chart range
    if (tMs < nowMs || tMs > chartEndTime) continue;
    items.push({ hl, origX: timeToX(tMs), h: parseFloat(hl.v), tMs });
  }

  if (durationH > 168 && items.length > 0) {
    const startDay = new Date(chartStartTime);
    startDay.setHours(0, 0, 0, 0);
    const startDayMs = startDay.getTime();

    const buckets = new Map<number, typeof items>();
    for (const item of items) {
      const bucket = Math.floor((item.tMs - startDayMs) / MS_PER_DAY);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(item);
    }

    const decimated: typeof items = [];
    for (const group of buckets.values()) {
      const highs = group.filter((g) => g.hl.type === 'H');
      const lows = group.filter((g) => g.hl.type === 'L');
      if (highs.length > 0) {
        decimated.push(highs.reduce((a, b) => (a.h >= b.h ? a : b)));
      }
      if (lows.length > 0) {
        decimated.push(lows.reduce((a, b) => (a.h <= b.h ? a : b)));
      }
    }
    items = decimated.sort((a, b) => a.tMs - b.tMs);
  }

  const HEIGHT_GAP = 18;    // clearance from peak to height label edge
  const TIME_GAP = 8;       // clearance from peak to time label edge
  const CHAR_W = 7;
  const RIGHT_MARGIN = 10;
  const LEFT_MIN_X = 50;
  const HEIGHT_ASCENT = 9;  // approx ascent for 12px font
  const TIME_ASCENT = 7;    // approx ascent for 10px font

  const labels: Array<VisiblePeakLabel & { halfW: number }> = [];

  for (const item of items) {
    const heightStr = item.h.toFixed(1);
    const timeStr = formatShortTime(new Date(item.hl.t));
    const halfW = Math.max(heightStr.length, timeStr.length) * CHAR_W / 2;

    let x = item.origX;
    if (x < LEFT_MIN_X) x = LEFT_MIN_X;
    if (x + halfW > WIDTH - RIGHT_MARGIN) continue;
    if (x - halfW < 0) continue;

    const peakY = heightToY(item.h);
    const isHigh = item.hl.type === 'H';
    const needsLeader = false;

    let labelY: number;  // height number baseline
    let timeY: number;   // time text baseline

    if (isHigh) {
      // HIGH: time 8px above peak, height 18px below peak
      timeY = peakY - TIME_GAP;
      labelY = peakY + HEIGHT_GAP + HEIGHT_ASCENT;
    } else {
      // LOW: height 24px above trough, time 8px below trough
      labelY = peakY - HEIGHT_GAP - 6;
      timeY = peakY + TIME_GAP + TIME_ASCENT;
    }

    // Clamp labels to valid zones
    if (timeY - TIME_ASCENT < PLOT_TOP) timeY = PLOT_TOP + 2;
    if (timeY + 2 > LABEL_BOTTOM) timeY = LABEL_BOTTOM - 2;
    if (labelY - HEIGHT_ASCENT < PLOT_TOP) labelY = PLOT_TOP + 2;
    if (labelY + 2 > LABEL_BOTTOM) labelY = LABEL_BOTTOM - 2;

    // Rect: union of both text bounding boxes
    const topY = Math.min(labelY - HEIGHT_ASCENT, timeY - TIME_ASCENT);
    const bottomY = Math.max(labelY + 2, timeY + 2);
    const rect: LabelRect = {
      x,
      top: topY,
      bottom: bottomY,
      left: x - halfW,
      right: x + halfW,
    };

    labels.push({ item, x, peakY, labelY, timeY, rect, needsLeader, halfW });
  }

  const visible = new Set<number>();
  for (let i = 0; i < labels.length; i++) {
    let collides = false;
    for (const j of visible) {
      const a = labels[i].rect;
      const b = labels[j].rect;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
        collides = true;
        break;
      }
    }
    if (!collides) visible.add(i);
  }

  return labels.filter((_, i) => visible.has(i));
}

function renderTimeAxis(
  chartStartTime: number,
  chartEndTime: number,
  timeToX: (t: number) => number,
) {
  const result = [];
  const durationH = (chartEndTime - chartStartTime) / 3600000;

  // Dynamic interval based on chart duration
  const stepH = durationH <= 24 ? 6 : durationH <= 96 ? 12 : 24;
  const step = stepH * 3600000;

  const start = new Date(chartStartTime);
  start.setMinutes(0, 0, 0);
  // Advance to next boundary
  const rem = start.getHours() % stepH;
  if (rem !== 0) start.setHours(start.getHours() + (stepH - rem));
  if (start.getTime() <= chartStartTime) start.setHours(start.getHours() + stepH);

  for (let t = start.getTime(); t < chartEndTime; t += step) {
    const x = timeToX(t);
    if (x < 20 || x > WIDTH - 10) continue;
    const d = new Date(t);
    const hr = d.getHours();
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr % 12 || 12;
    const label = `${h12} ${ampm}`;
    result.push(svg`
      <text x="${x}" y="${TIME_AXIS_Y}" text-anchor="middle"
        font-size="13" font-weight="400"
        fill="var(--primary-text-color, #212121)" opacity="0.5">${label}</text>
    `);
  }
  return result;
}

function renderGridLines(
  range: ChartRange,
  heightToY: (h: number) => number,
  step: number,
) {
  const first = Math.floor(range.min / step) * step;
  const last = Math.ceil(range.max / step) * step;
  const result = [];

  for (let ft = first; ft <= last; ft += step) {
    const y = heightToY(ft);
    if (y < PLOT_TOP - 2 || y > PLOT_BOTTOM + 2) continue;
    result.push(svg`
      <line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}"
        stroke="var(--divider-color, rgba(128,128,128,0.2))"
        stroke-width="0.5" opacity="0.12" />
    `);
  }
  return result;
}

function renderGridLabels(
  range: ChartRange,
  heightToY: (h: number) => number,
  peakRects: LabelRect[],
  step: number,
) {
  const first = Math.floor(range.min / step) * step;
  const last = Math.ceil(range.max / step) * step;
  const result = [];

  // Grid label bounding box: x=4, width ~35px, height ~10px centered on y
  const GRID_LABEL_W = 38;
  const GRID_LABEL_H = 10;

  for (let ft = first; ft <= last; ft += step) {
    const y = heightToY(ft);
    if (y < PLOT_TOP - 2 || y > PLOT_BOTTOM + 2) continue;

    // Hide if grid label Y is within 15px of the day label row
    if (Math.abs(y - DAY_LABEL_Y) < 15) continue;

    const gTop = y - GRID_LABEL_H / 2;
    const gBottom = y + GRID_LABEL_H / 2;
    const gLeft = 0;
    const gRight = GRID_LABEL_W;

    // Hide if any visible peak label overlaps this grid label
    const peakOverlap = peakRects.some((pr) =>
      pr.left < gRight && pr.right > gLeft && pr.top < gBottom && pr.bottom > gTop,
    );
    if (peakOverlap) continue;

    const num = Number.isInteger(ft) ? `${ft}` : `${ft.toFixed(1)}`;
    result.push(svg`
      <text x="15" y="${y + 3}" text-anchor="end"
        font-size="11" font-weight="500"
        fill="var(--secondary-text-color, #999)" opacity="0.5">${num}</text>
      <text x="17" y="${y + 3}" text-anchor="start"
        font-size="11" font-weight="500"
        fill="var(--secondary-text-color, #999)" opacity="0.5">ft</text>
    `);
  }
  return result;
}

function renderDayLines(
  chartStartTime: number,
  chartEndTime: number,
  timeToX: (t: number) => number,
) {
  const result = [];
  const MS_PER_DAY = 24 * 3600000;
  const startDay = new Date(chartStartTime);
  startDay.setHours(0, 0, 0, 0);
  const startMidnightMs = startDay.getTime();

  for (let midMs = startMidnightMs; midMs < chartEndTime; midMs += MS_PER_DAY) {
    const midX = timeToX(midMs);
    if (midMs > chartStartTime && midX >= 10 && midX <= WIDTH) {
      result.push(svg`
        <line x1="${midX}" y1="0" x2="${midX}" y2="${PLOT_BOTTOM}"
          stroke="var(--primary-text-color, #212121)" stroke-width="2" opacity="0.3" />
      `);
    }
  }
  return result;
}

interface DayLabelPos {
  x: number;
  label: string;
}

function computeDayLabelPositions(
  chartStartTime: number,
  chartEndTime: number,
  timeToX: (t: number) => number,
  dataEndX: number,
): DayLabelPos[] {
  const MS_PER_DAY = 24 * 3600000;
  const LABEL_OFFSET_MS = 2 * 3600000;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MIN_SPACING = 40;

  const startDay = new Date(chartStartTime);
  startDay.setHours(0, 0, 0, 0);
  const startMidnightMs = startDay.getTime();

  const candidates: DayLabelPos[] = [];
  for (let midMs = startMidnightMs; midMs < chartEndTime; midMs += MS_PER_DAY) {
    const naturalLabelX = timeToX(midMs + LABEL_OFFSET_MS);
    const labelX = Math.max(4, naturalLabelX);
    if (labelX <= dataEndX - 10 && labelX <= WIDTH - 20) {
      const dayOfWeek = new Date(midMs).getDay();
      candidates.push({ x: labelX, label: dayNames[dayOfWeek] });
    }
  }

  // Filter: skip labels too close to a later one (keep rightmost in collisions)
  const visible: DayLabelPos[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const next = candidates[i + 1];
    if (next && next.x - candidates[i].x < MIN_SPACING) continue;
    visible.push(candidates[i]);
  }
  return visible;
}

function renderDayLabelsFromPositions(positions: DayLabelPos[]) {
  return positions.map((pos) => svg`
    <text x="${pos.x}" y="${DAY_LABEL_Y}" text-anchor="start"
      font-size="11" font-weight="600"
      fill="var(--secondary-text-color, #999)" opacity="0.6">${pos.label}</text>
  `);
}

function renderNightShading(
  nightIntervals: NightInterval[],
  timeToX: (t: number) => number,
) {
  if (nightIntervals.length === 0) return nothing;
  return nightIntervals.map((interval) => {
    const x1 = timeToX(interval.start);
    const x2 = timeToX(interval.end);
    const clampX1 = Math.max(0, x1);
    const clampX2 = Math.min(WIDTH, x2);
    if (clampX2 <= clampX1) return nothing;
    return svg`
      <rect x="${clampX1}" y="0" width="${clampX2 - clampX1}" height="${PLOT_BOTTOM}"
        fill="var(--tidal-night-fill, rgba(0,0,40,0.08))" />
    `;
  });
}

function renderMoonPhaseIcons(
  moonPhases: MoonPhaseInfo[],
  chartStartTime: number,
  chartEndTime: number,
  timeToX: (t: number) => number,
) {
  // Compute day label X positions to avoid collision
  const MS_PER_DAY = 24 * 3600000;
  const LABEL_OFFSET_MS = 2 * 3600000;
  const startDay = new Date(chartStartTime);
  startDay.setHours(0, 0, 0, 0);
  const startMidnightMs = startDay.getTime();
  const dayLabelXs: number[] = [];
  for (let midMs = startMidnightMs; midMs < chartEndTime; midMs += MS_PER_DAY) {
    const labelX = timeToX(midMs + LABEL_OFFSET_MS);
    if (labelX >= 0 && labelX <= WIDTH) dayLabelXs.push(labelX);
  }

  const MOON_Y = 8; // above day labels (which are at PLOT_TOP - 6 = 22)
  return moonPhases.map((mp) => {
    // Position at noon of the phase day for better separation from day labels
    const phaseNoon = new Date(mp.date);
    phaseNoon.setHours(12, 0, 0, 0);
    const t = phaseNoon.getTime();
    if (t < chartStartTime || t > chartEndTime) return nothing;
    const x = timeToX(t);
    // Hide if clipped at right edge or too close to a day label
    if (x > WIDTH - 25 || x < 10) return nothing;
    const tooClose = dayLabelXs.some((dx) => Math.abs(x - dx) < 25);
    if (tooClose) return nothing;
    const r = 5;
    return svg`
      <g transform="translate(${x}, ${MOON_Y})">
        ${moonSvgIcon(mp.phase, r)}
        <text x="0" y="14" text-anchor="middle"
          font-size="9" font-weight="400"
          fill="var(--secondary-text-color, #999)">${mp.label}</text>
      </g>
    `;
  });
}

function moonSvgIcon(phase: MoonPhaseInfo['phase'], r: number) {
  const color = 'var(--secondary-text-color, #999)';
  switch (phase) {
    case 'new':
      return svg`<circle cx="0" cy="0" r="${r}" fill="${color}" />`;
    case 'full':
      return svg`<circle cx="0" cy="0" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" />`;
    case 'first_quarter':
      return svg`
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" />
        <path d="M 0,${-r} A ${r},${r} 0 0,1 0,${r} Z" fill="${color}" />
      `;
    case 'last_quarter':
      return svg`
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" />
        <path d="M 0,${-r} A ${r},${r} 0 0,0 0,${r} Z" fill="${color}" />
      `;
  }
}

function renderNowDot(nowX: number, nowY: number) {
  return svg`
    <circle class="now-dot" cx="${nowX}" cy="${nowY}" r="6"
      fill="#ffffff" />
  `;
}

function monotoneCubicPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    dy.push(points[i + 1].y - points[i].y);
    m.push(dy[i] / dx[i]);
  }

  const tangents: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push((m[i - 1] + m[i]) / 2);
    }
  }
  tangents.push(m[n - 2]);

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3;
    const cp1x = points[i].x + seg;
    const cp1y = points[i].y + tangents[i] * seg;
    const cp2x = points[i + 1].x - seg;
    const cp2y = points[i + 1].y - tangents[i + 1] * seg;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1].x},${points[i + 1].y}`;
  }

  return d;
}
