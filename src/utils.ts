import { HiLoPrediction, SeriesPrediction, TidePoint, ChartRange } from './types';

export function parseSeries(predictions: SeriesPrediction[]): TidePoint[] {
  return predictions.map((p) => ({
    time: new Date(p.t),
    height: parseFloat(p.v),
  }));
}

export function computeRange(points: TidePoint[]): ChartRange {
  if (points.length === 0) return { min: -1, max: 10 };

  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.height < min) min = p.height;
    if (p.height > max) max = p.height;
  }

  // Add 15% padding
  const span = max - min || 1;
  min -= span * 0.15;
  max += span * 0.15;

  // Round to nearest 0.5 ft
  min = Math.floor(min * 2) / 2;
  max = Math.ceil(max * 2) / 2;

  return { min, max };
}

export function formatCountdown(nowMs: number, eventMs: number): string {
  const diffMs = eventMs - nowMs;
  if (diffMs <= 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatShortTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function getCurrentTideHeight(series: TidePoint[], now: Date): number | null {
  const t = now.getTime();
  for (let i = 0; i < series.length - 1; i++) {
    const t0 = series[i].time.getTime();
    const t1 = series[i + 1].time.getTime();
    if (t >= t0 && t <= t1) {
      const frac = (t - t0) / (t1 - t0);
      return series[i].height + frac * (series[i + 1].height - series[i].height);
    }
  }
  return null;
}

export function getNextEvent(
  hilos: HiLoPrediction[],
  now: Date,
): HiLoPrediction | null {
  const t = now.getTime();
  for (const hl of hilos) {
    if (new Date(hl.t).getTime() > t) return hl;
  }
  return null;
}
