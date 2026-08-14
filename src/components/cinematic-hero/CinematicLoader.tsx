export const CinematicLoader: React.FC = () => (
  <div className="cinematic-loader" role="status" aria-live="polite">
    <img src="/logo/final-logo.png" alt="" className="cinematic-loader-logo" fetchPriority="high" />
    <span className="cinematic-loader-text">Preparing your journey…</span>
    <div className="cinematic-loader-bar">
      <div className="cinematic-loader-bar-fill" />
    </div>
  </div>
);
