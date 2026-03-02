import { css } from 'lit';

export const styles = css`
  :host {
    --tidal-curve-stroke: #4FC3F7;
    --tidal-curve-fill-start: rgba(79, 195, 247, 1.0);
    --tidal-curve-fill-end: rgba(79, 195, 247, 0.30);
    --tidal-night-fill: rgba(0, 0, 40, 0.40);
    --tidal-glow-color: rgba(79, 195, 247, 0.35);
    display: flex;
    flex-direction: column;
  }

  :host(.light-mode) {
    --tidal-curve-stroke: #0288D1;
    --tidal-curve-fill-start: rgba(2, 136, 209, 0.85);
    --tidal-curve-fill-end: rgba(2, 136, 209, 0.15);
    --tidal-night-fill: rgba(0, 0, 60, 0.25);
    --tidal-glow-color: rgba(2, 136, 209, 0.25);
  }

  ha-card {
    overflow: hidden;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px 16px 8px;
  }

  .hero-left {
    display: flex;
    flex-direction: column;
  }


  .hero-number-row {
    display: flex;
    align-items: baseline;
  }

  .hero-sign {
    font-size: 42px;
    font-weight: 600;
    color: var(--primary-text-color);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .hero-digits-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-number {
    font-size: 42px;
    font-weight: 600;
    color: var(--primary-text-color);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .hero-unit {
    font-size: 18px;
    font-weight: 400;
    color: var(--secondary-text-color);
    margin-left: 4px;
  }

  .hero-direction {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 400;
    color: var(--secondary-text-color);
    margin-top: 4px;
  }

  .hero-direction .arrow {
    font-size: 12px;
  }

  .hero-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    padding-top: 4px;
  }

  .countdown-label {
    font-size: 12px;
    font-weight: 400;
    color: var(--secondary-text-color);
  }

  .countdown-time {
    font-size: 22px;
    font-weight: 500;
    color: var(--primary-text-color);
    letter-spacing: -0.01em;
    margin-top: 2px;
    line-height: 1.1;
  }

  .chart-container {
    width: 100%;
    margin-top: 4px;
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
