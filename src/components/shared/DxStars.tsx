// ============================================================
// DxStars — DX 星级 SVG 图标（不用 emoji，不显示数字）
// ============================================================

export default function DxStars({ stars, size = 11 }: { stars: number; size?: number }) {
  const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'

  return (
    <span className="inline-flex items-center gap-[1px]" title={`DX ${stars} 星`}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < stars ? '#FFD700' : 'none'}
          stroke={i < stars ? '#FFD700' : '#9CA3AF'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d={starPath} />
        </svg>
      ))}
    </span>
  )
}
