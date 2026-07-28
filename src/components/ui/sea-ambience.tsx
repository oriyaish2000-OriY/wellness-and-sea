'use client'

import { useMemo } from 'react'

/* ─────────────────────────────────────────────────────────────
   SVG Yoga / Sea symbol library — all drawn in teal strokes,
   no fills, so they blend gently into any background
───────────────────────────────────────────────────────────── */

function LotusIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 6 petals rotated around centre */}
      {[0, 60, 120, 180, 240, 300].map(deg => (
        <ellipse
          key={deg}
          cx="24" cy="24" rx="4.5" ry="13"
          stroke="currentColor" strokeWidth="1.2"
          transform={`rotate(${deg}, 24, 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" />
    </svg>
  )
}

function OmIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stylised OM shape using text path approximation */}
      <text
        x="22" y="32"
        textAnchor="middle"
        fontSize="30"
        fontFamily="Georgia, serif"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      >
        ॐ
      </text>
    </svg>
  )
}

function WaveIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size / 2.5} viewBox="0 0 56 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2,11 C10,3 18,19 26,11 C34,3 42,19 50,11 C52,8 54,13 56,11"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      />
      <path
        d="M0,16 C8,9 16,22 24,16 C32,10 40,22 48,16 C52,13 54,17 56,16"
        stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"
      />
    </svg>
  )
}

function MandalaDot({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg * Math.PI) / 180
        const x = 18 + 12 * Math.sin(rad)
        const y = 18 - 12 * Math.cos(rad)
        return <circle key={deg} cx={x} cy={y} r="1.8" fill="currentColor" />
      })}
      <circle cx="18" cy="18" r="10" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="18" cy="18" r="4"  stroke="currentColor" strokeWidth="0.8" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
    </svg>
  )
}

function YogaFigure({ size = 42 }: { size?: number }) {
  /* Simple tree-pose silhouette outline */
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 42 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="21" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      {/* Body */}
      <line x1="21" y1="12" x2="21" y2="34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Arms raised (tree pose) */}
      <path d="M21,18 Q14,10 10,6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M21,18 Q28,10 32,6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Standing leg */}
      <line x1="21" y1="34" x2="21" y2="54" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Raised leg (tree pose) */}
      <path d="M21,34 Q14,40 14,46" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function DropletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14,2 C14,2 4,14 4,22 C4,27.5 8.5,32 14,32 C19.5,32 24,27.5 24,22 C24,14 14,2 14,2 Z"
        stroke="currentColor" strokeWidth="1.4"
      />
      <path
        d="M10,24 Q10,19 14,17"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"
      />
    </svg>
  )
}

function NamasteIcon({ size = 40 }: { size?: number }) {
  /* Simplified praying / namaste hands */
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left hand */}
      <path
        d="M20,32 C16,32 10,28 9,20 C8,14 11,8 14,6"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
      />
      {/* Right hand */}
      <path
        d="M20,32 C24,32 30,28 31,20 C32,14 29,8 26,6"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
      />
      {/* Fingers together at top */}
      <path d="M14,6 Q17,4 20,4 Q23,4 26,6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Wrists meeting */}
      <path d="M12,28 Q16,30 20,32 Q24,30 28,28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Symbol pool — each entry defines which SVG to render
   and the CSS animation to use
───────────────────────────────────────────────────────────── */
type SymbolKind = 'lotus' | 'om' | 'wave' | 'mandala' | 'yoga' | 'drop' | 'namaste'
const DRIFTS = ['float-drift-a', 'float-drift-b', 'float-drift-c', 'float-drift-d'] as const

interface Particle {
  id: number
  kind: SymbolKind
  x: number          // % from left
  startY: number     // % from top (start position)
  size: number       // px
  opacity: number
  duration: number   // seconds
  delay: number      // seconds
  drift: typeof DRIFTS[number]
}

function buildParticles(): Particle[] {
  /* Fixed seed so SSR and client match — no random() on server */
  const seed: Array<Omit<Particle, 'id'>> = [
    { kind: 'lotus',   x: 5,  startY: 88, size: 44, opacity: 0.07, duration: 22, delay: 0,    drift: 'float-drift-a' },
    { kind: 'om',      x: 15, startY: 95, size: 38, opacity: 0.08, duration: 26, delay: 4,    drift: 'float-drift-b' },
    { kind: 'wave',    x: 28, startY: 91, size: 52, opacity: 0.06, duration: 20, delay: 2,    drift: 'float-drift-c' },
    { kind: 'mandala', x: 42, startY: 93, size: 34, opacity: 0.07, duration: 28, delay: 7,    drift: 'float-drift-d' },
    { kind: 'yoga',    x: 58, startY: 89, size: 40, opacity: 0.06, duration: 24, delay: 1,    drift: 'float-drift-a' },
    { kind: 'drop',    x: 70, startY: 96, size: 28, opacity: 0.08, duration: 18, delay: 9,    drift: 'float-drift-b' },
    { kind: 'namaste', x: 82, startY: 90, size: 38, opacity: 0.07, duration: 23, delay: 5,    drift: 'float-drift-c' },
    { kind: 'lotus',   x: 92, startY: 94, size: 32, opacity: 0.06, duration: 27, delay: 12,   drift: 'float-drift-d' },
    { kind: 'wave',    x: 8,  startY: 75, size: 48, opacity: 0.05, duration: 31, delay: 16,   drift: 'float-drift-a' },
    { kind: 'mandala', x: 50, startY: 78, size: 30, opacity: 0.06, duration: 25, delay: 20,   drift: 'float-drift-b' },
    { kind: 'om',      x: 76, startY: 82, size: 42, opacity: 0.07, duration: 29, delay: 8,    drift: 'float-drift-c' },
    { kind: 'yoga',    x: 36, startY: 80, size: 36, opacity: 0.05, duration: 33, delay: 14,   drift: 'float-drift-d' },
  ]
  return seed.map((p, i) => ({ ...p, id: i }))
}

function SymbolNode({ kind, size }: { kind: SymbolKind; size: number }) {
  switch (kind) {
    case 'lotus':   return <LotusIcon size={size} />
    case 'om':      return <OmIcon size={size} />
    case 'wave':    return <WaveIcon size={size} />
    case 'mandala': return <MandalaDot size={size} />
    case 'yoga':    return <YogaFigure size={size} />
    case 'drop':    return <DropletIcon size={size} />
    case 'namaste': return <NamasteIcon size={size} />
  }
}

/* ─────────────────────────────────────────────────────────────
   Main component — rendered in root layout
   `useMemo` keeps particle list stable across re-renders
───────────────────────────────────────────────────────────── */
export function SeaAmbience() {
  const particles = useMemo(() => buildParticles(), [])

  return (
    <div className="sea-ambience" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="ambience-symbol"
          style={{
            left: `${p.x}%`,
            top: `${p.startY}%`,
            color: '#0d6e6e',
            opacity: p.opacity,
            animation: `${p.drift} ${p.duration}s ${p.delay}s ease-in-out infinite`,
          }}
        >
          <SymbolNode kind={p.kind} size={p.size} />
        </div>
      ))}
    </div>
  )
}
