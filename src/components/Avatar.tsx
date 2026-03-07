// Shared Avatar component — shows photo if available, else colored initial
// Used in Nav, ItemCard, ProfilePage, LoansPage, BarterPage, NotificationsPage

interface AvatarProps {
  name: string | null | undefined
  avatarUrl?: string | null
  color?: string | null
  size?: number
  fontSize?: string
  style?: React.CSSProperties
  className?: string
}

export default function Avatar({ name, avatarUrl, color, size = 32, fontSize, style, className }: AvatarProps) {
  const bg = color || '#C4622D'
  const fs = fontSize || `${Math.round(size * 0.38)}px`
  const initial = name?.[0]?.toUpperCase() || '?'

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  }

  if (avatarUrl) {
    return (
      <span style={base} className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name || 'avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    )
  }

  return (
    <span
      style={{ ...base, background: bg, color: '#fff', fontWeight: 600, fontSize: fs }}
      className={className}
    >
      {initial}
    </span>
  )
}
