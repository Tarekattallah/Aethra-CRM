export function OrbitLoader({ className = '', label = 'جاري التحميل' }: { className?: string; label?: string }) {
  return <span role="status" aria-label={label} className={`aethra-loader ${className}`}>
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.75" opacity=".2" />
      <g className="aethra-loader__orbit">
        <path d="M32.99 12.5 A15 15 0 1 1 27.5 7.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="30.6" cy="9.4" r="2.3" fill="currentColor" />
      </g>
    </svg>
  </span>;
}
