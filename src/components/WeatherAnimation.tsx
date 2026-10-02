"use client"

import { useWeather } from "@/contexts/WeatherContext"
import { useEffect, useState } from "react"

function Lightning() {
  const [showLightning, setShowLightning] = useState(false)
  useEffect(() => {
    let flash: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setShowLightning(true)
      flash = setTimeout(() => setShowLightning(false), 100)
    }, Math.random() * 3000 + 2000)
    return () => {
      clearInterval(interval)
      clearTimeout(flash)
    }
  }, [])
  return showLightning ? <div className="absolute inset-0 bg-white/20 animate-pulse" /> : null
}

export default function WeatherAnimation() {
  // Context の単一ソースを使用（背景と常に一致）
  const { effectiveWeather, weatherType } = useWeather()
  // 初回は天気未取得で描画しない。粒子の乱数は保持し、再描画で飛び回らせない。
  const [particles] = useState(() => Array.from({ length: 100 }, () => ({
    x: Math.random(),
    y: Math.random(),
    delay: Math.random(),
    duration: Math.random(),
  })))

  // weatherType が null（天気未取得）の場合はアニメーションを表示しない
  if (!weatherType) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* 雷のフラッシュ */}
      {effectiveWeather === "Thunderstorm" && <Lightning />}

      {/* 雨のアニメーション */}
      {(effectiveWeather === "Rain" || effectiveWeather === "Drizzle" || effectiveWeather === "Thunderstorm") && (
        <div className="rain-container">
          {particles.slice(0, effectiveWeather === "Thunderstorm" ? 100 : effectiveWeather === "Rain" ? 50 : 30).map((particle, i) => (
            <div
              key={i}
              className="rain-drop"
              style={{
                left: `${particle.x * 100}%`,
                animationDelay: `${particle.delay * 2}s`,
                animationDuration: `${0.5 + particle.duration * 0.5}s`,
                opacity: effectiveWeather === "Drizzle" ? 0.4 : 0.6,
              }}
            />
          ))}
        </div>
      )}

      {/* 雪のアニメーション */}
      {effectiveWeather === "Snow" && (
        <div className="snow-container">
          {particles.slice(0, 50).map((particle, i) => (
            <div
              key={i}
              className="snowflake"
              style={{
                left: `${particle.x * 100}%`,
                animationDelay: `${particle.delay * 5}s`,
                animationDuration: `${3 + particle.duration * 4}s`,
              }}
            >
              ❄
            </div>
          ))}
        </div>
      )}

      {/* 雲のアニメーション */}
      {effectiveWeather === "Clouds" && (
        <div className="clouds-container">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="cloud"
              style={{
                left: `${i * 33}%`,
                animationDelay: `${i * 2}s`,
                animationDuration: `${20 + i * 5}s`,
              }}
            >
              ☁
            </div>
          ))}
        </div>
      )}

      {/* 霧/もやのアニメーション */}
      {(effectiveWeather === "Mist" || effectiveWeather === "Fog" || effectiveWeather === "Haze") && (
        <div className="fog-container">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="fog-layer"
              style={{
                animationDelay: `${i * 3}s`,
                animationDuration: `${15 + i * 5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 画面の水滴効果（雨の場合） */}
      {(effectiveWeather === "Rain" || effectiveWeather === "Thunderstorm") && (
        <div className="water-drops">
          {particles.slice(0, 10).map((particle, i) => (
            <div
              key={i}
              className="water-drop"
              style={{
                left: `${particle.x * 100}%`,
                top: `${particle.y * 100}%`,
                animationDelay: `${particle.delay * 10}s`,
              }}
            />
          ))}
        </div>
      )}

    </div>
  )
}
