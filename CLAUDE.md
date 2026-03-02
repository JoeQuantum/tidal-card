# Tidal Card -- Claude Code Context

## Project overview
Custom Home Assistant Lovelace card for tide visualization. Renders an inline
SVG tide curve from HA entity attributes. Published to HACS. Design inspired
by clock-weather-card's iOS-widget aesthetic: light font weights, no chart
chrome, generous whitespace, full theme integration.

## Tech stack
- Lit 3 + TypeScript (strict mode)
- Rollup for bundling to a single JS file (dist/tidal-card.js)
- No external chart libraries. SVG rendered inline via Lit html templates.
- Target: Home Assistant 2024.1+

NOTE: HA's frontend pins Lit 2.8.0. We bundle Lit 3.x (like Mushroom and most
modern cards do). Lit handles coexistence of two versions on the page, but it
does add page weight. This is the standard pragmatic choice.

## Development environment
- Windows ARM64 laptop
- PowerShell as primary shell
- Deploy via scp to HA instance at ha.themadronahouse.com

## HA custom card lifecycle (CRITICAL)
- Main class extends LitElement, registers as 'tidal-card'
- Wrap ALL output in <ha-card>
- Receive HA data via `set hass(hass: HomeAssistant)` setter
- NEVER make `hass` a @state() or @property() -- extract only relevant
  entity state into @state() properties to prevent re-render on every
  unrelated HA state change
- setConfig(config) validates and stores config, called once
- getConfigForm() returns schema for HA's built-in visual editor (v1.0)
  (migrate to getConfigElement() only if v1.1+ needs conditional fields/tabs)
- getStubConfig(hass) returns sensible defaults for card picker
- getCardSize() returns height in 50px units (~7 for this card)
- getGridOptions() returns { columns, rows, min_columns, min_rows } for
  HA's sections view layout (12-column grid)
- Register with window.customCards array for HA card picker UI,
  including documentationURL field

## Entity data format (from NOAA REST sensors)
The card reads two HA sensor entities:

### HiLo entity (config key: entity_hilo)
Example: sensor.tide_predictions_hilo_2
- state: "X predictions" (string, count of predictions)
- attributes.predictions: Array of objects:
  { t: "2026-02-28 03:24", v: "8.234", type: "H" }
  { t: "2026-02-28 09:47", v: "0.112", type: "L" }
  t = local time string (YYYY-MM-DD HH:MM), v = height in feet (string),
  type = "H" (high) or "L" (low)

### Series entity (config key: entity_series)
Example: sensor.tide_predictions_series
- state: "OK"
- attributes.predictions: Array of objects:
  { t: "2026-02-28 00:00", v: "3.456" }
  { t: "2026-02-28 00:30", v: "3.789" }
  30-minute intervals, no type field. Same t/v format as hilo.

## Design spec

### Layout
- Header: horizontal flex, 16px gap, wave icon left + text right
- Text stack: Rising/Falling label, hero height number, countdown
- Tide curve: full-width SVG (viewBox 500x195), 12px top margin
- No event rows or range bar pills in v1.0
- Card padding: 16px

### Typography
- Rising/Falling label: 1.8em, font-weight 600, with arrow (up/down unicode)
- Hero tide height: 3.5em, font-weight 300
- Countdown: 14px, weight 400, "Next High in 5 h 21 m" (compact, no specific time)
- Peak height labels on curve: 12px, weight 600
- Peak time labels on curve: 10px, weight 400
- Time axis: 13px, weight 400, 0.5 opacity
- Grid labels (Y-axis): 11px, weight 500, 0.5 opacity
- Moon phase label: 9px, weight 400
- Day labels: 11px, weight 600, 0.6 opacity

### Chart time range
- Default chart_hours: 48 (config slider 24-168, step 24)
- Lookback: min(12h, chart_hours * 0.15) of history shown before "now"
- Chart end clamped to last available data point
- All chart content clipped to data boundary via SVG clipPath

### Curve rendering
- Stroke: var(--tidal-curve-stroke), 4px width
- Stroke color: #4FC3F7 dark / #0288D1 light
- Area fill: linearGradient from curve's average Y position down to plot bottom
  - Dark mode: rgba(79,195,247,1.0) to rgba(79,195,247,0.30) (near-opaque)
  - Light mode: rgba(2,136,209,0.85) to rgba(2,136,209,0.15)
- Glow: drop-shadow filter using var(--tidal-glow-color)
- Cubic bezier path (monotone interpolation), NOT linear segments

### Peak labels
- Split across the curve line: one label above, one below
- HIGH peaks: time above peak (8px clearance), height below peak (24px clearance)
- LOW peaks: height above trough (24px clearance), time below trough (8px clearance)
- Future peaks only (past peaks unlabeled)
- Collision detection: bounding box overlap check, skip colliding labels
- Wide zoom (>168h): decimation keeps best H/L per day bucket
- Left margin: labels start at x=50 minimum
- Labels clamped to valid plot zone (PLOT_TOP to LABEL_BOTTOM)

### Grid labels (Y-axis)
- Split into two SVG text elements: number (text-anchor="end" at x=15) and
  "ft" suffix (text-anchor="start" at x=17) for consistent digit alignment
- Step: every 2 ft
- Hidden if within 15px of day label row or overlapping a peak label
- 0.5 opacity, var(--secondary-text-color)

### Grid lines
- Horizontal lines at every 2 ft, 0.5px stroke, 0.12 opacity
- var(--divider-color) with fallback

### Dynamic Y-axis range (CRITICAL)
Never hardcode min/max. Compute from data on each render:
1. Scan series predictions for actual min and max height
2. Add 15% padding to each end
3. Round to nearest 0.5 ft
This ensures every location (Gulf Coast 0-3ft, Orcas -2 to 8ft,
Bay of Fundy -2 to 50ft) produces a well-proportioned chart.

### Moon phases
Compute from date math, no API. Reference: Jan 6, 2000 18:14 UTC.
Synodic period: 29.53059 days. Four major phases with +/-0.02 tolerance.
Deduplicated: only the closest matching day per phase type is kept.
If a phase falls within chart time range, render small icon (r=5)
at top of chart (y=8) at that date's X position. Label below in 9px text.
Icons: filled circle (new), right-half (first quarter), open circle
(full), left-half (last quarter). Hidden if too close to day labels.
Config toggle: show_moon_phases.

### Now indicator
- Solid white circle: r=6, fill #ffffff, class "now-dot"
- CSS drop-shadow filter (two stacked): 0px 1px 2px rgba(0,0,0,0.3)
  and 0px 0px 4px rgba(0,0,0,0.15)
- No vertical line, no separate label (unless far from peak labels)
- SVG overflow: visible on .chart-container to prevent shadow clipping

### Day dividers (midnight lines)
- Vertical lines at each midnight boundary
- stroke: var(--primary-text-color) at 0.3 opacity, stroke-width 2

### Day labels
- Positioned at top of chart area (y=14), text-anchor="start"
- Offset 2h right of midnight for visual balance
- Collision avoidance: 40px minimum spacing, skip overlapping labels
- Short names: Sun, Mon, Tue, Wed, Thu, Fri, Sat

### Night shading
- Rectangles from sunset to sunrise, full plot height
- fill: var(--tidal-night-fill)
  - Dark mode: rgba(0, 0, 40, 0.40)
  - Light mode: rgba(0, 0, 60, 0.25)
- Sun times derived from HA sun.sun entity (next_rising/next_setting)
- Repeated +/- days to cover full chart range

### Time axis
- Dynamic interval based on chart duration:
  - <= 24h: every 6h
  - <= 96h: every 12h
  - > 96h: every 24h
- 12-hour format with AM/PM, 0.5 opacity

### Dark/light mode detection
- Detected via hass.themes.darkMode (boolean), NOT CSS media queries
- Stored as @state() _darkMode property
- Toggles .light-mode CSS class on host element
- :host sets dark mode CSS variables (default)
- :host(.light-mode) overrides with light mode values

### Theme integration
- All text: var(--primary-text-color) / var(--secondary-text-color)
- Card background: transparent (inherits ha-card)
- Dividers: var(--divider-color)
- Overridable CSS custom properties:
  --tidal-curve-stroke, --tidal-curve-fill-start, --tidal-curve-fill-end,
  --tidal-night-fill, --tidal-glow-color

### Error and loading states
- Entity not found: ha-card with warning triangle icon and
  "Entity not found: [entity_id] -- check your configuration."
- Entity exists but no predictions attribute: "Waiting for tide data..."
  with pulsing opacity animation (0.4 to 1.0 over 2s)
- Empty predictions array: "No predictions available."
- Main render wrapped in try/catch: falls back to error card with
  error circle icon and the exception message
- Never shows a JavaScript error or broken layout

## File structure
src/
  tidal-card.ts          -- main LitElement card
  types.ts               -- TypeScript interfaces (config, tide data, moon)
  styles.ts              -- CSS (Lit css tagged templates)
  chart.ts               -- SVG tide curve rendering (500x195 viewBox)
  moon.ts                -- lunar phase computation (deduplicated)
  utils.ts               -- data parsing, time formatting, range computation
dist/
  tidal-card.js          -- bundled output (do not edit directly)

## Build commands
- npm install            -- install dependencies
- npm run build          -- production build to dist/
- npm run dev            -- watch mode with local serve on port 5000
- npm run lint           -- TypeScript type checking

## Deploy command (PowerShell)
npm run build; scp .\dist\tidal-card.js root@ha.themadronahouse.com:/config/www/tidal-card.js

## Code conventions
- Use HA action: not service: (post-2024 convention)
- Config keys: snake_case in YAML (entity_hilo, entity_series, chart_hours)
- Timestamps: parse with new Date(), compare as getTime() milliseconds
- Colors: always use CSS custom properties with fallbacks
- Commit messages: conventional commits (feat:, fix:, chore:)
- Scripts: use PowerShell (.ps1), not bash (.sh)
