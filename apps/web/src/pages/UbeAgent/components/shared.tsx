import { useId } from 'react'
import styled, { keyframes, useTheme } from 'styled-components'

import { AgentStatus, UserAgent } from '../data/useUserAgents'

/* ---------- formatting ---------- */

export function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function shortenAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function agentName(agent: UserAgent): string {
  return `Agent #${agent.number}`
}

export function formatPools(count: number): string {
  return `${count} ${count === 1 ? 'pool' : 'pools'}`
}

/* ---------- status badge ---------- */

const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  closed: 'Closed',
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 currentColor; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const BadgeWrapper = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 535;
  line-height: 20px;
  white-space: nowrap;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}1f`};
`

const Dot = styled.span<{ $animate: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: ${({ $animate }) => ($animate ? pulse : 'none')} 2s infinite;
`

export function useStatusColor(status: AgentStatus): string {
  const theme = useTheme()
  if (status === 'running') return theme.success
  if (status === 'paused') return theme.warning2
  if (status === 'closed') return theme.neutral2
  return theme.neutral3
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  const color = useStatusColor(status)
  return (
    <BadgeWrapper $color={color}>
      <Dot $animate={status === 'running'} />
      {STATUS_LABEL[status]}
    </BadgeWrapper>
  )
}

/* ---------- generated agent avatar ---------- */

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Deterministic robot-ish avatar, hue varies around the Ubeswap purple. */
export function AgentAvatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const gradientId = useId()
  const h = hash(seed)
  const hue = 250 + ((h % 120) - 60) // 190..310
  const eyeShape = h % 3
  const c1 = `hsl(${hue}, 55%, 62%)`
  const c2 = `hsl(${(hue + 40) % 360}, 60%, 45%)`

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="agent avatar">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
      {/* antenna */}
      <line x1="20" y1="7" x2="20" y2="12" stroke="white" strokeOpacity="0.85" strokeWidth="1.6" />
      <circle cx="20" cy="6.5" r="1.8" fill="white" />
      {/* head */}
      <rect x="9" y="12" width="22" height="18" rx="6" fill="white" fillOpacity="0.92" />
      {/* eyes */}
      {eyeShape === 0 && (
        <>
          <circle cx="15.5" cy="20" r="2.4" fill={c2} />
          <circle cx="24.5" cy="20" r="2.4" fill={c2} />
        </>
      )}
      {eyeShape === 1 && (
        <>
          <rect x="12.5" y="18.5" width="6" height="3" rx="1.5" fill={c2} />
          <rect x="21.5" y="18.5" width="6" height="3" rx="1.5" fill={c2} />
        </>
      )}
      {eyeShape === 2 && <rect x="12.5" y="18" width="15" height="4" rx="2" fill={c2} />}
      {/* mouth */}
      <rect x="16" y="25" width="8" height="1.6" rx="0.8" fill={c2} fillOpacity="0.6" />
    </svg>
  )
}

/* ---------- hero illustration: an agent node wired to tokens ---------- */

const orbit = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`
const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`
const dash = keyframes`
  to { stroke-dashoffset: -40; }
`

const IllustrationSvg = styled.svg`
  overflow: visible;
  .orbit {
    transform-origin: 160px 120px;
    animation: ${orbit} 40s linear infinite;
  }
  .orbit-reverse {
    transform-origin: 160px 120px;
    animation: ${orbit} 60s linear infinite reverse;
  }
  .float {
    animation: ${float} 4s ease-in-out infinite;
  }
  .flow {
    stroke-dasharray: 4 6;
    animation: ${dash} 2s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .orbit,
    .orbit-reverse,
    .float,
    .flow {
      animation: none;
    }
  }
`

export function AgentIllustration({ width = 320, className }: { width?: number; className?: string }) {
  const theme = useTheme()
  const id = useId()
  const accent = theme.accent1
  const height = (width * 240) / 320
  const satellites = [
    { x: 60, y: 60, label: 'CELO', color: '#FCFF52' },
    { x: 268, y: 78, label: 'UBE', color: accent },
    { x: 250, y: 196, label: 'USDm', color: '#40B66B' },
    { x: 70, y: 190, label: 'ETH', color: '#627EEA' },
  ]

  return (
    <IllustrationSvg className={className} width={width} height={height} viewBox="0 0 320 240" fill="none" aria-hidden>
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B3A6E8" />
          <stop offset="100%" stopColor="#5E4FA2" />
        </linearGradient>
      </defs>

      <circle cx="160" cy="120" r="110" fill={`url(#${id}-glow)`} />
      <g className="orbit">
        <circle cx="160" cy="120" r="92" stroke={accent} strokeOpacity="0.25" strokeDasharray="2 8" />
        <circle cx="252" cy="120" r="3" fill={accent} />
        <circle cx="68" cy="120" r="2" fill={accent} fillOpacity="0.6" />
      </g>
      <g className="orbit-reverse">
        <circle cx="160" cy="120" r="62" stroke={accent} strokeOpacity="0.35" />
        <circle cx="160" cy="58" r="2.5" fill={accent} />
      </g>

      {satellites.map((s) => (
        <path
          key={`line-${s.label}`}
          className="flow"
          d={`M160 120 L${s.x} ${s.y}`}
          stroke={accent}
          strokeOpacity="0.6"
        />
      ))}

      {satellites.map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy={s.y} r="17" fill={theme.surface1} stroke={theme.surface3} strokeWidth="1.5" />
          <circle cx={s.x} cy={s.y} r="5" fill={s.color} />
          <text
            x={s.x}
            y={s.y + 30}
            textAnchor="middle"
            fontSize="10"
            fontWeight="535"
            fill={theme.neutral2}
            fontFamily="inherit"
          >
            {s.label}
          </text>
        </g>
      ))}

      {/* central agent */}
      <g className="float">
        <rect x="128" y="88" width="64" height="64" rx="20" fill={`url(#${id}-core)`} />
        <line x1="160" y1="76" x2="160" y2="88" stroke="#B3A6E8" strokeWidth="2.5" />
        <circle cx="160" cy="73" r="4.5" fill="#B3A6E8" />
        <rect x="140" y="104" width="40" height="30" rx="10" fill="white" fillOpacity="0.95" />
        <circle cx="151" cy="117" r="4" fill="#5E4FA2" />
        <circle cx="169" cy="117" r="4" fill="#5E4FA2" />
        <rect x="153" y="126" width="14" height="2.4" rx="1.2" fill="#5E4FA2" fillOpacity="0.5" />
      </g>
    </IllustrationSvg>
  )
}
