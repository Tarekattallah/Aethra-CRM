import React from 'react';

interface BeeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textSubtitle?: string;
  variant?: 'light' | 'dark' | 'honey';
  className?: string;
  onClick?: () => void;
}

export const BeeLogo: React.FC<BeeLogoProps> = ({
  size = 'md',
  showText = true,
  textSubtitle = 'منظومة إدارة وتوزيع العملاء',
  variant = 'light',
  className = '',
  onClick
}) => {
  const iconDimensions = {
    sm: { width: 34, height: 34, text: 'text-sm', sub: 'text-[9px]' },
    md: { width: 44, height: 44, text: 'text-base', sub: 'text-[10px]' },
    lg: { width: 56, height: 56, text: 'text-xl', sub: 'text-xs' },
    xl: { width: 80, height: 80, text: 'text-3xl', sub: 'text-sm' }
  }[size];

  const textColor = variant === 'dark' ? 'text-white' : 'text-[#171717]';
  const subColor = variant === 'dark' ? 'text-slate-400' : 'text-[#737373]';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title="Bee Company"
    >
      {/* Bee Icon Container */}
      <div
        style={{ width: iconDimensions.width, height: iconDimensions.height }}
        className="relative flex-shrink-0 flex items-center justify-center rounded-2xl bg-[#FFE15C] shadow-sm shadow-[#FFE15C]/40 border border-[#f5d742] overflow-hidden group active:scale-95 transition-transform duration-150"
      >
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full transform transition duration-300 group-hover:scale-105"
        >
          {/* Honeycomb pattern in background */}
          <g stroke="#FFFFFF" strokeWidth="2.5" fill="none" opacity="0.9">
            <polygon points="80,42 96,51 96,70 80,79 64,70 64,51" />
            <polygon points="63,22 79,31 79,50 63,59 47,50 47,31" />
            <polygon points="97,22 113,31 113,50 97,59 81,50 81,31" />
            <polygon points="46,52 62,61 62,80 46,89 30,80 30,61" />
            <polygon points="114,52 130,61 130,80 114,89 98,80 98,61" />
            <polygon points="63,82 79,91 79,110 63,119 47,110 47,91" />
            <polygon points="97,82 113,91 113,110 97,119 81,110 81,91" />
          </g>

          {/* Bee Figure */}
          <g transform="translate(0, 8)">
            {/* Antennae */}
            <path d="M74 52 C70 42 63 36 67 31 C69 29 73 31 73 34 C73 40 76 46 78 50" fill="#171717" />
            <path d="M86 52 C90 42 97 36 93 31 C91 29 87 31 87 34 C87 40 84 46 82 50" fill="#171717" />

            {/* Head */}
            <ellipse cx="80" cy="56" rx="14" ry="11" fill="#171717" />

            {/* Wings */}
            <g>
              {/* Left Wing */}
              <path d="M74 65 C45 52 28 66 38 78 C46 87 68 83 74 72 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
              <path d="M42 70 C52 64 63 67 68 71" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8" />

              {/* Right Wing */}
              <path d="M86 65 C115 52 132 66 122 78 C114 87 92 83 86 72 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
              <path d="M118 70 C108 64 97 67 92 71" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8" />
            </g>

            {/* Abdomen with Striped Bands */}
            <g>
              <clipPath id={`abdomen-clip-${size}`}>
                <path d="M62 70 C60 88 62 108 80 116 C98 108 100 88 98 70 C94 65 66 65 62 70 Z" />
              </clipPath>

              <g clipPath={`url(#abdomen-clip-${size})`}>
                <rect x="50" y="60" width="60" height="60" fill="#FFE15C" />
                <rect x="50" y="68" width="60" height="9" fill="#171717" />
                <rect x="50" y="77" width="60" height="9" fill="#FFE15C" />
                <rect x="50" y="86" width="60" height="9" fill="#171717" />
                <rect x="50" y="95" width="60" height="9" fill="#FFE15C" />
                <rect x="50" y="104" width="60" height="14" fill="#171717" />
              </g>

              {/* Contour */}
              <path d="M62 70 C60 88 62 108 80 116 C98 108 100 88 98 70 C94 65 66 65 62 70 Z" fill="none" stroke="#171717" strokeWidth="2" />
              {/* Stinger */}
              <polygon points="77,115 83,115 80,123" fill="#171717" />
            </g>
          </g>
        </svg>
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight ${iconDimensions.text} ${textColor}`}>
              BEE COMPANY
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#FFE15C]"></span>
          </div>
          {textSubtitle && (
            <span className={`font-medium ${iconDimensions.sub} ${subColor} tracking-wide hidden sm:inline truncate max-w-[200px]`}>
              {textSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
