// The Last Save mark, copied from web/src/components/brand.tsx (Mark) so the close card uses the app's own logo.
// The gradient stops are the app mark's own colours.
export function Mark({ size = 64, id = "g6lsg" }: { size?: number; id?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd27a" /><stop offset="0.55" stopColor="#ff7a1a" /><stop offset="1" stopColor="#ff4d6d" /></linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="9" fill="#12101d" stroke={`url(#${id})`} strokeWidth="2" />
      <path d="M11 12h13l5 5v11a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1z" fill="none" stroke="#efeaff" strokeOpacity=".22" strokeWidth="1.5" />
      <path d="M8 23h7l2.5-6 4 11 3-8 2 3h5.5" fill="none" stroke={`url(#${id})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
