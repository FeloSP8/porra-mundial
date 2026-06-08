/**
 * Trofeo dorado genérico (SVG inline). No representa la copa oficial de la FIFA
 * (que es marca registrada): es un trofeo genérico para decorar la final.
 * Puedes sustituirlo por tu propia imagen si quieres.
 */
export default function TrophySvg({
  className = "",
  size = 80,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Trofeo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCEA9E" />
          <stop offset="45%" stopColor="#F4C430" />
          <stop offset="100%" stopColor="#C9971B" />
        </linearGradient>
      </defs>
      {/* Asas */}
      <path
        d="M14 14 H10 a8 8 0 0 0 8 8 v-4 a4 4 0 0 1-4-4Z"
        fill="url(#gold)"
        stroke="#9c7414"
        strokeWidth="1"
      />
      <path
        d="M50 14 H54 a8 8 0 0 1-8 8 v-4 a4 4 0 0 0 4-4Z"
        fill="url(#gold)"
        stroke="#9c7414"
        strokeWidth="1"
      />
      {/* Copa */}
      <path
        d="M16 10 H48 V22 a16 16 0 0 1-32 0 Z"
        fill="url(#gold)"
        stroke="#9c7414"
        strokeWidth="1.5"
      />
      {/* Cuello */}
      <rect x="29" y="38" width="6" height="8" fill="url(#gold)" stroke="#9c7414" strokeWidth="1" />
      {/* Base superior */}
      <rect x="22" y="46" width="20" height="5" rx="1.5" fill="url(#gold)" stroke="#9c7414" strokeWidth="1" />
      {/* Pedestal */}
      <rect x="18" y="51" width="28" height="6" rx="2" fill="url(#gold)" stroke="#9c7414" strokeWidth="1" />
      {/* Brillo */}
      <path d="M22 13 q4 12 10 14" stroke="#fff" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}
