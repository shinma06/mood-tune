"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"

interface FloatingNote {
  id: number
  xPercent: number
  yPercent: number
  durationMs: number
  driftX: number
  sizeRem: number
  symbol: string
  opacity: number
}

interface FloatingNoteEffectProps {
  accentColor: string
  isDarkText: boolean
}

const NOTE_SYMBOLS = ["♪", "♫", "♩", "♬"]

const randomBetween = (min: number, max: number): number => {
  return Math.random() * (max - min) + min
}

export default function FloatingNoteEffect({
  accentColor,
  isDarkText,
}: FloatingNoteEffectProps) {
  const [notes, setNotes] = useState<FloatingNote[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    const spawnNote = () => {
      const id = idRef.current++
      const durationMs = Math.round(randomBetween(2400, 3600))
      const note: FloatingNote = {
        id,
        xPercent: randomBetween(70, 88),
        yPercent: randomBetween(26, 40),
        durationMs,
        driftX: randomBetween(-26, 26),
        sizeRem: randomBetween(1.19, 1.75),
        symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
        opacity: randomBetween(0.45, 0.95),
      }

      setNotes((prev) => [...prev.slice(-9), note])
    }

    const firstFrame = requestAnimationFrame(spawnNote)
    const timer = window.setInterval(spawnNote, randomBetween(520, 900))
    return () => {
      cancelAnimationFrame(firstFrame)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden>
      {notes.map((note) => (
        <span
          key={note.id}
          onAnimationEnd={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
          className="absolute select-none will-change-transform motion-note-float"
          style={{
            left: `${note.xPercent}%`,
            top: `${note.yPercent}%`,
            animationDuration: `${note.durationMs}ms`,
            transform: `translate3d(0, 0, 0)`,
            "--note-drift-x": `${note.driftX}px`,
            fontSize: `${note.sizeRem}rem`,
            color: isDarkText ? "#ffffff" : accentColor,
            opacity: note.opacity,
            textShadow: isDarkText ? "0 0 6px rgba(255,255,255,0.24)" : "0 0 6px rgba(0,0,0,0.12)",
          } as CSSProperties}
        >
          {note.symbol}
        </span>
      ))}
    </div>
  )
}
