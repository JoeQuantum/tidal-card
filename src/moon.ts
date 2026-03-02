import { MoonPhaseInfo } from './types';

// Reference new moon: Jan 6, 2000 18:14 UTC
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_PERIOD = 29.53059; // days

function getMoonPhase(date: Date): number {
  const daysSinceRef = (date.getTime() - REFERENCE_NEW_MOON) / (1000 * 60 * 60 * 24);
  const cycles = daysSinceRef / SYNODIC_PERIOD;
  return cycles - Math.floor(cycles); // 0..1 phase fraction
}

export function findMoonPhases(startDate: Date, endDate: Date): MoonPhaseInfo[] {
  const tolerance = 0.02;

  const targets: Array<{ target: number; phase: MoonPhaseInfo['phase']; label: string }> = [
    { target: 0, phase: 'new', label: 'New' },
    { target: 0.25, phase: 'first_quarter', label: '1st Qtr' },
    { target: 0.5, phase: 'full', label: 'Full' },
    { target: 0.75, phase: 'last_quarter', label: 'Last Qtr' },
  ];

  // Check each day in range, collect candidates per phase type
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // For each phase type, keep only the closest matching day
  const best = new Map<string, { info: MoonPhaseInfo; distance: number }>();

  while (current <= end) {
    const phase = getMoonPhase(current);

    for (const t of targets) {
      let dist: number;
      if (t.target === 0) {
        // New moon wraps around 0/1
        dist = Math.min(phase, 1 - phase);
      } else {
        dist = Math.abs(phase - t.target);
      }
      if (dist < tolerance) {
        const existing = best.get(t.phase);
        if (!existing || dist < existing.distance) {
          best.set(t.phase, {
            info: { phase: t.phase, date: new Date(current), label: t.label },
            distance: dist,
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Return sorted by date
  return Array.from(best.values())
    .map((b) => b.info)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
