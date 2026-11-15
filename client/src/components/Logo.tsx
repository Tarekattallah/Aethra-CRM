import React from 'react';

type LogoProps = {
  variant?: 'mark' | 'full';
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  subtitle?: string;
};

/** The mark and Outfit wordmark inherit their color from the surrounding surface. */
export function Logo({ variant = 'full', size = 'md', className = '', subtitle }: LogoProps) {
  const diameter = typeof size === 'number' ? size : { sm: 32, md: 40, lg: 56, xl: 80 }[size];
  return (
    <span role="img" aria-label="Aethra" dir="ltr" className={`aethra-logo ${className}`}
      style={{ '--logo-size': `${diameter}px`, '--logo-clear-space': `${diameter * .2295}px`, '--logo-gap': `${diameter * .36}px` } as React.CSSProperties}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 200 200" fill="none" className="aethra-logo__mark">
        <g stroke="currentColor" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M177.94 55 A90 90 0 1 1 145 22.06" />
          <path d="M60.4 136 L100 55 L139.6 136" />
          <path d="M72.7 111 H127.3" />
        </g>
        <g fill="currentColor">
          <circle cx="163.64" cy="36.36" r="7.65" />
          <circle cx="100" cy="55" r="7.65" />
          <circle cx="60.4" cy="136" r="7.65" />
          <circle cx="139.6" cy="136" r="7.65" />
        </g>
      </svg>
      {variant === 'full' && <span aria-hidden="true" className="aethra-logo__type">
        <span className="aethra-logo__wordmark">Aethra</span>
        {subtitle && <span className="aethra-logo__subtitle" dir="auto">{subtitle}</span>}
      </span>}
    </span>
  );
}
