export interface TidalCardConfig {
  type: string;
  entity_hilo: string;
  entity_series: string;
  name?: string;
  chart_hours?: number;
  show_moon_phases?: boolean;
  entity_sun?: string;
  show_day_night?: boolean;
}

export interface SunTimes {
  rise: number;
  set: number;
}

export interface HiLoPrediction {
  t: string;
  v: string;
  type: 'H' | 'L';
}

export interface SeriesPrediction {
  t: string;
  v: string;
}

export interface TidePoint {
  time: Date;
  height: number;
}

export interface ChartRange {
  min: number;
  max: number;
}

export interface MoonPhaseInfo {
  phase: 'new' | 'first_quarter' | 'full' | 'last_quarter';
  date: Date;
  label: string;
}
