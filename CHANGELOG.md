# Changelog

All notable changes to Tidal Card will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.3] - 2026-06-01

### Changed

- Card now sizes to its container. The SVG chart previously kept a fixed
  500×195 internal canvas regardless of the card's allocated dashboard
  space, leaving empty padding when the dashboard reserved more vertical
  room. The card now measures its container via `ResizeObserver` and
  renders the curve into the actual width and height, with all text
  labels staying at fixed pixel sizes so they remain legible at any
  card size. Honors dashboard-level height/width settings in both
  sections-view and grid-layout views.

### Internal

- `chart.ts`: removed file-level `WIDTH`/`CHART_HEIGHT`/`PLOT_TOP`/
  `PLOT_BOTTOM`/`DAY_LABEL_Y`/`TIME_AXIS_Y`/`MOON_Y` constants. New
  `ChartDims` parameter and `computeLayout()` helper plumb a `Layout`
  object through all chart helpers.
- `tidal-card.ts`: `ResizeObserver` on `.chart-container` with a
  synchronous initial measurement in `firstUpdated()`; clean disconnect
  in `disconnectedCallback()`.
- `styles.ts`: `:host` / `ha-card` / `.chart-container` height-propagation
  chain (`height: 100%`, `flex: 1`, `min-height: 0`, `align-self: stretch`)
  so the SVG's container claims its grid cell height.

## [1.0.2] - 2026-05-29

### Added

- README and `screenshots/` now include dark- and light-mode screenshots of the card.
- `CHANGELOG.md` with retroactive entries for v1.0.0 and v1.0.1.

### Changed

- CI: tag-triggered release workflow now auto-populates the GitHub release body from the matching `CHANGELOG.md` section, and hard-fails if the tag has no corresponding entry.

No runtime changes to the card itself.

## [1.0.1] - 2026-03-02

### Changed

- Redesigned the card's hero section: split layout with a countdown to the next tide event, removed the wave icon, and improved text contrast.
- README: added Features section, updated installation steps to use the renamed `tidal-card` repository (previously `lovelace-tidal-card`), corrected URL references.

## [1.0.0] - 2026-03-01

### Added

- Initial public release.
- Custom Home Assistant Lovelace card that renders tide predictions as a smooth SVG curve from HA entity attributes.
- Day/night shading from the sun entity, moon phase icons (new, first quarter, full, last quarter).
- Peak high/low labels with collision detection.
- Dynamic Y-axis range that adapts to any location.
- Horizontal grid lines with height labels.
- Visual config editor (no YAML required) and dark/light mode support.
- HACS publishing: `hacs.json`, validate workflow, release workflow.
