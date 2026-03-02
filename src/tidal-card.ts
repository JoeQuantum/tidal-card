import { LitElement, html, TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { styles } from './styles';
import { TidalCardConfig, HiLoPrediction, SeriesPrediction, TidePoint, ChartRange, SunTimes } from './types';
import { parseSeries, computeRange, formatCountdown, getCurrentTideHeight, getNextEvent } from './utils';
import { renderTideCurve, NightInterval } from './chart';
import { findMoonPhases } from './moon';

// HA types -- minimal interface to avoid depending on HA's full types
interface HomeAssistant {
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
  themes: { darkMode: boolean; [key: string]: unknown };
}

const CARD_VERSION = '1.0.0';

class TidalCard extends LitElement {
  static styles = styles;

  @state() private _config!: TidalCardConfig;
  @state() private _seriesPoints: TidePoint[] = [];
  @state() private _hiloData: HiLoPrediction[] = [];
  @state() private _range: ChartRange = { min: 0, max: 10 };
  @state() private _currentHeight: number | null = null;
  @state() private _nextEvent: HiLoPrediction | null = null;
  @state() private _now: Date = new Date();
  @state() private _sunTimes: SunTimes | null = null;
  @state() private _darkMode = true;
  @state() private _entityError: string | null = null;

  private _hassObj?: HomeAssistant;
  private _updateTimer?: number;

  // --- HA lifecycle ---

  set hass(hass: HomeAssistant) {
    this._hassObj = hass;

    // Detect dark/light mode from HA theme setting
    const dark = hass.themes?.darkMode ?? true;
    if (dark !== this._darkMode) {
      this._darkMode = dark;
      this.classList.toggle('light-mode', !dark);
    }

    this._updateFromHass();
  }

  setConfig(config: Partial<TidalCardConfig>): void {
    if (!config.entity_hilo || !config.entity_series) {
      throw new Error('Please configure entity_hilo and entity_series');
    }
    this._config = {
      type: 'custom:tidal-card',
      show_moon_phases: true,
      entity_sun: 'sun.sun',
      show_day_night: true,
      ...config,
      chart_hours: Math.min(config.chart_hours ?? 48, 96),
    } as TidalCardConfig;
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: 'entity_hilo',
          required: true,
          selector: { entity: { domain: 'sensor' } },
        },
        {
          name: 'entity_series',
          required: true,
          selector: { entity: { domain: 'sensor' } },
        },
        {
          name: 'name',
          selector: { text: {} },
        },
        {
          name: 'chart_hours',
          default: 48,
          selector: { number: { min: 24, max: 96, step: 24, mode: 'slider' } },
        },
        {
          name: 'show_moon_phases',
          default: true,
          selector: { boolean: {} },
        },
        {
          name: 'entity_sun',
          default: 'sun.sun',
          selector: { entity: { domain: 'sun' } },
        },
        {
          name: 'show_day_night',
          default: true,
          selector: { boolean: {} },
        },
      ],
    };
  }

  static getStubConfig(hass: HomeAssistant) {
    const entities = Object.keys(hass.states).filter((e) => e.startsWith('sensor.tide'));
    return {
      entity_hilo: entities.find((e) => e.includes('hilo')) || '',
      entity_series: entities.find((e) => e.includes('series')) || '',
    };
  }

  getCardSize(): number {
    return 7;
  }

  getGridOptions() {
    return {
      columns: 12,
      rows: 4,
      min_columns: 6,
      min_rows: 3,
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._updateTimer = window.setInterval(() => {
      this._now = new Date();
    }, 60000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = undefined;
    }
  }

  // --- Data extraction ---

  private _updateFromHass(): void {
    if (!this._hassObj || !this._config) return;

    const hiloEntity = this._hassObj.states[this._config.entity_hilo];
    const seriesEntity = this._hassObj.states[this._config.entity_series];

    // Entity not found
    if (!hiloEntity) {
      this._entityError = `Entity not found: ${this._config.entity_hilo} \u2014 check your configuration.`;
      return;
    }
    if (!seriesEntity) {
      this._entityError = `Entity not found: ${this._config.entity_series} \u2014 check your configuration.`;
      return;
    }

    const hiloRaw = hiloEntity.attributes['predictions'] as HiLoPrediction[] | undefined;
    const seriesRaw = seriesEntity.attributes['predictions'] as SeriesPrediction[] | undefined;

    // Entity exists but no predictions attribute yet
    if (!hiloRaw || !seriesRaw) {
      this._entityError = 'waiting';
      return;
    }

    // Empty predictions arrays
    if (hiloRaw.length === 0 || seriesRaw.length === 0) {
      this._entityError = 'empty';
      return;
    }

    this._entityError = null;

    this._hiloData = hiloRaw;
    this._seriesPoints = parseSeries(seriesRaw);
    this._range = computeRange(this._seriesPoints);

    // Extract sun times for day/night shading
    const sunEntityId = this._config.entity_sun || 'sun.sun';
    const sunEntity = this._hassObj.states[sunEntityId];
    if (sunEntity) {
      const nextRising = sunEntity.attributes['next_rising'] as string | undefined;
      const nextSetting = sunEntity.attributes['next_setting'] as string | undefined;
      if (nextRising && nextSetting) {
        const nextRiseMs = new Date(nextRising).getTime();
        const nextSetMs = new Date(nextSetting).getTime();
        const MS_PER_DAY = 24 * 3600000;
        // Normalize: above_horizon means sun is up, so rise was in the past
        // below_horizon means sun is down, so set was in the past
        if (sunEntity.state === 'above_horizon') {
          this._sunTimes = { rise: nextRiseMs - MS_PER_DAY, set: nextSetMs };
        } else {
          this._sunTimes = { rise: nextRiseMs, set: nextSetMs - MS_PER_DAY };
        }
      }
    } else {
      this._sunTimes = null;
    }

    const now = new Date();
    this._now = now;
    this._currentHeight = getCurrentTideHeight(this._seriesPoints, now);
    this._nextEvent = getNextEvent(this._hiloData, now);
  }

  // --- Render ---

  protected render(): TemplateResult {
    if (!this._config) {
      return html`<ha-card><div class="not-found">Card not configured</div></ha-card>`;
    }

    // Entity not found
    if (this._entityError && this._entityError !== 'waiting' && this._entityError !== 'empty') {
      return html`
        <ha-card>
          <div class="status-message">
            <svg class="status-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
                fill="var(--warning-color, #FFA726)" />
            </svg>
            <span>${this._entityError}</span>
          </div>
        </ha-card>
      `;
    }

    // Waiting for predictions attribute
    if (this._entityError === 'waiting') {
      return html`
        <ha-card>
          <div class="status-message">
            <span class="loading-text">Waiting for tide data\u2026</span>
          </div>
        </ha-card>
      `;
    }

    // Empty predictions
    if (this._entityError === 'empty') {
      return html`
        <ha-card>
          <div class="status-message">No predictions available.</div>
        </ha-card>
      `;
    }

    try {
      return this._renderChart();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[tidal-card] render error:', e);
      return html`
        <ha-card>
          <div class="status-message">
            <svg class="status-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                fill="var(--error-color, #EF5350)" />
            </svg>
            <span>${message}</span>
          </div>
        </ha-card>
      `;
    }
  }

  private _renderChart(): TemplateResult {
    const chartHours = this._config.chart_hours || 48;
    const LOOKBACK_HOURS = Math.min(12, chartHours * 0.15);
    const chartStartMs = this._now.getTime() - LOOKBACK_HOURS * 3600000;
    let chartEndMs = chartStartMs + chartHours * 3600000;

    // Clamp chart end to last available data point — nothing renders beyond it
    if (this._seriesPoints.length > 0) {
      const lastDataMs = this._seriesPoints[this._seriesPoints.length - 1].time.getTime();
      if (chartEndMs > lastDataMs) {
        chartEndMs = lastDataMs;
      }
    }

    const chartStart = new Date(chartStartMs);
    const chartEnd = new Date(chartEndMs);
    const moonPhases = this._config.show_moon_phases
      ? findMoonPhases(chartStart, chartEnd)
      : [];

    // Compute night intervals from sun times
    const nightIntervals: NightInterval[] = [];
    if (this._config.show_day_night !== false && this._sunTimes) {
      const MS_PER_DAY = 24 * 3600000;
      const maxDayOffset = Math.ceil(chartHours / 24) + 2;
      for (let dayOffset = -2; dayOffset <= maxDayOffset; dayOffset++) {
        const sunset = this._sunTimes.set + dayOffset * MS_PER_DAY;
        const sunrise = this._sunTimes.rise + (dayOffset + 1) * MS_PER_DAY;
        if (sunset < chartEndMs && sunrise > chartStartMs) {
          nightIntervals.push({
            start: Math.max(sunset, chartStartMs),
            end: Math.min(sunrise, chartEndMs),
          });
        }
      }
    }

    const isRising = this._nextEvent?.type === 'H';
    const directionLabel = this._nextEvent ? (isRising ? 'Rising' : 'Falling') : '';
    const directionArrow = this._nextEvent ? (isRising ? '\u2191' : '\u2193') : '';
    const nextEventType = this._nextEvent ? (this._nextEvent.type === 'H' ? 'High' : 'Low') : '';
    const countdown = this._nextEvent
      ? formatCountdown(this._now.getTime(), new Date(this._nextEvent.t).getTime())
      : '';

    return html`
      <ha-card>
        <div class="header">
          <svg class="wave-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12c2-3 4-4.5 6-4.5s4 3 6 3 4-3 6-3 3 1.5 4 4.5"
              fill="none" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-linecap="round" />
            <path d="M2 17c2-3 4-4.5 6-4.5s4 3 6 3 4-3 6-3 3 1.5 4 4.5"
              fill="none" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-linecap="round" opacity="0.4" />
          </svg>
          <div>
            ${directionLabel
              ? html`<div class="tide-direction"><span class="direction-arrow">${directionArrow}</span> ${directionLabel}</div>`
              : ''}
            <div class="hero-height">
              ${this._currentHeight !== null ? this._currentHeight.toFixed(1) : '--'}
              <span style="font-size: 0.3em; font-weight: 400;">ft</span>
            </div>
            ${countdown
              ? html`<div class="next-event">
                  Next ${nextEventType} in ${countdown}
                </div>`
              : ''}
          </div>
        </div>

        <div class="chart-container">
          ${renderTideCurve(
            this._seriesPoints.filter(
              (p) => p.time.getTime() >= chartStartMs - 2 * 3600000 && p.time.getTime() <= chartEndMs,
            ),
            this._hiloData,
            this._range,
            this._now,
            chartStartMs,
            chartEndMs,
            moonPhases,
            this._config.show_moon_phases ?? true,
            nightIntervals,
          )}
        </div>

      </ha-card>
    `;
  }
}

// --- Registration ---

customElements.define('tidal-card', TidalCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'tidal-card',
  name: 'Tidal Card',
  description: 'Tide visualization card with SVG curve and predictions',
  preview: true,
  documentationURL: 'https://github.com/JoeQuantum/lovelace-tidal-card',
});

console.info(
  `%c TIDAL-CARD %c v${CARD_VERSION} `,
  'color: white; background: #0288D1; font-weight: bold; padding: 2px 4px; border-radius: 3px 0 0 3px;',
  'color: #0288D1; background: #E1F5FE; font-weight: bold; padding: 2px 4px; border-radius: 0 3px 3px 0;',
);
