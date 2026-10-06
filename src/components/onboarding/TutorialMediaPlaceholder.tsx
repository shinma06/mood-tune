"use client"

import { useState } from "react"
import { ImageIcon } from "lucide-react"

interface Props {
  mediaPath?: string
  alt: string
  className?: string
}

const PlaceholderBlock = () => (
  <div className="w-full h-full rounded-xl bg-linear-to-br from-slate-800 to-slate-900 flex items-center justify-center">
    <div className="text-center text-white/30 space-y-2">
      <ImageIcon className="w-12 h-12 mx-auto" />
      <p className="text-xs">メディア準備中</p>
    </div>
  </div>
)

export default function TutorialMediaPlaceholder({ mediaPath, alt, className = "" }: Props) {
  return <TutorialMedia key={mediaPath} mediaPath={mediaPath} alt={alt} className={className} />
}

function TutorialMedia({ mediaPath, alt, className }: Props) {
  const [videoError, setVideoError] = useState(false)
  const containerClassName = `w-full h-full rounded-xl overflow-hidden bg-black/40 ${className}`.trim()

  if (mediaPath) {
    const isVideo = /\.(mp4|webm)$/i.test(mediaPath)
    if (isVideo) {
      if (videoError) return <PlaceholderBlock />
      return (
        <div className={containerClassName}>
          <video
            src={mediaPath}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full rounded-xl object-cover object-center"
            aria-label={alt}
            onError={() => setVideoError(true)}
          />
        </div>
      )
    }
    return (
      <div className={containerClassName}>
        <img
          src={mediaPath}
          alt={alt}
          className="h-full w-full rounded-xl object-cover object-center"
        />
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      <PlaceholderBlock />
    </div>
  )
}
