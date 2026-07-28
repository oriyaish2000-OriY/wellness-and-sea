'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Yoga & sea symbols shown during the wave
const SYMBOLS = [
  { char: 'ॐ',  style: { top: '28%', right: '18%', fontSize: 72 } },
  { char: '🪷', style: { top: '55%', left: '22%',  fontSize: 58 } },
  { char: '🌊', style: { top: '38%', left: '45%',  fontSize: 64 } },
  { char: '🧘', style: { top: '60%', right: '28%', fontSize: 52 } },
  { char: '✨', style: { top: '22%', left: '30%',  fontSize: 40 } },
  { char: '💧', style: { top: '72%', left: '60%',  fontSize: 36 } },
]

type Phase = 'idle' | 'entering' | 'holding' | 'exiting'

export function WaveTransition() {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  useEffect(() => {
    // Skip very first render (page load)
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname
      return
    }
    if (prevPathRef.current === pathname) return
    prevPathRef.current = pathname

    // Sequence: enter → hold briefly → exit
    setPhase('entering')
    const holdTimer = setTimeout(() => setPhase('holding'), 520)
    const exitTimer = setTimeout(() => setPhase('exiting'), 620)
    const doneTimer = setTimeout(() => setPhase('idle'), 1120)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [pathname])

  if (phase === 'idle') return null

  return (
    <div className="wave-transition-overlay" aria-hidden="true">
      {/* Wave panel */}
      <div className={`wave-panel ${phase === 'entering' || phase === 'holding' ? 'entering' : 'exiting'}`}>

        {/* Animated wave edge at the top of the panel */}
        <div className="wave-panel-edge">
          <svg viewBox="0 0 800 52" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0,26 C80,0 160,52 240,26 C320,0 400,52 480,26 C560,0 640,52 720,26 C760,13 780,32 800,26 L800,52 L0,52 Z"
              fill="#0d6e6e"
            />
            <path
              d="M0,32 C60,8 140,48 220,30 C300,12 380,44 460,28 C540,12 620,46 700,30 C750,20 780,38 800,30 L800,52 L0,52 Z"
              fill="#0a4a4a"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* Mandala / radial decoration in centre */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 160,
            height: 160,
            opacity: 0.12,
          }}
        >
          <MandalaIcon />
        </div>

        {/* Floating yoga symbols */}
        {phase !== 'exiting' && SYMBOLS.map((s, i) => (
          <div
            key={i}
            className="wave-symbol"
            style={{
              ...s.style,
              animationDelay: `${i * 60}ms`,
              fontFamily: s.char === 'ॐ' ? 'serif' : undefined,
            }}
          >
            {s.char}
          </div>
        ))}

        {/* Brand watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 13,
            fontFamily: "'Playfair Display', serif",
            letterSpacing: 3,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          WELLNESS & SEA
        </div>
      </div>
    </div>
  )
}

/* Simple SVG mandala / lotus geometry */
function MandalaIcon() {
  return (
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer petals — 8 ellipses rotated */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <ellipse
          key={deg}
          cx="80" cy="80"
          rx="8" ry="32"
          stroke="white" strokeWidth="1.5"
          transform={`rotate(${deg}, 80, 80)`}
          opacity="0.9"
        />
      ))}
      {/* Middle ring */}
      <circle cx="80" cy="80" r="22" stroke="white" strokeWidth="1.5" opacity="0.7" />
      {/* Inner dots */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg * Math.PI) / 180
        const x = 80 + 22 * Math.sin(rad)
        const y = 80 - 22 * Math.cos(rad)
        return <circle key={deg} cx={x} cy={y} r="2.5" fill="white" opacity="0.8" />
      })}
      {/* Centre dot */}
      <circle cx="80" cy="80" r="5" fill="white" opacity="0.9" />
      <circle cx="80" cy="80" r="2" fill="#0d6e6e" />
    </svg>
  )
}
