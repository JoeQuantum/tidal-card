import { css } from 'lit';

export const styles = css`
  :host {
    --tidal-curve-stroke: #4FC3F7;
    --tidal-curve-fill-start: rgba(79, 195, 247, 1.0);
    --tidal-curve-fill-end: rgba(79, 195, 247, 0.30);
    --tidal-night-fill: rgba(0, 0, 40, 0.40);
    --tidal-glow-color: rgba(79, 195, 247, 0.35);
  }

  :host(.light-mode) {
    --tidal-curve-stroke: #0288D1;
    --tidal-curve-fill-start: rgba(2, 136, 209, 0.85);
    --tidal-curve-fill-end: rgba(2, 136, 209, 0.15);
    --tidal-night-fill: rgba(0, 0, 60, 0.25);
    --tidal-glow-color: rgba(2, 136, 209, 0.25);
  }

  ha-card {
    padding: 16px;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .wave-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .hero-height {
    font-size: 3.5em;
    font-weight: 300;
    color: var(--primary-text-color);
    line-height: 1;
  }

  .tide-direction {
    font-size: 1.8em;
    font-weight: 600;
    color: var(--primary-text-color);
    margin-bottom: 2px;
    letter-spacing: 0.02em;
  }

  .direction-arrow {
    font-size: 1.1em;
  }

  .next-event {
    font-size: 14px;
    font-weight: 400;
    color: var(--primary-text-color);
    margin-top: 4px;
  }

  .next-event-time {
    font-size: 12px;
    color: var(--secondary-text-color);
  }

  .chart-container {
    width: 100%;
    margin-top: 12px;
  }

  .chart-container svg {
    width: 100%;
    display: block;
    overflow: visible;
  }

  circle.now-dot {
    filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.3)) drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.15));
  }

  .not-found {
    padding: 16px;
    color: var(--secondary-text-color);
  }

  .status-message {
    padding: 24px 16px;
    color: var(--secondary-text-color);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .loading-text {
    animation: pulse-opacity 2s ease-in-out infinite;
  }

  @keyframes pulse-opacity {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
`;
