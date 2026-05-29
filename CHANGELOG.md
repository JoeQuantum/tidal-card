# Changelog

All notable changes to Tidal Card will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/).

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

### Removed

- `CLAUDE.md` no longer ships in the public repository.

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
