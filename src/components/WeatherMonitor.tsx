"use client"

import { createElement, useState, useEffect, useCallback, useRef } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useWeather } from "@/contexts/WeatherContext"
import type { WeatherState } from "@/types/weather"
import { formatDateTime, getWeatherIcon, getWeatherThemeColor, normalizeWeatherType } from "@/lib/weather-utils"
import { WEATHER_TYPE_LABELS } from "@/lib/constants"
import { fetchWeatherData } from "@/lib/weather-api"
import { useGeolocation } from "@/hooks/useGeolocation"
import { useSettings } from "@/hooks/useSettings"

export default function WeatherMonitor() {
    const [weatherState, setWeatherState] = useState<WeatherState>({
        status: "loading",
        message: "位置情報を取得中...",
    })
    const { currentTime, effectiveTimeOfDay, isCanvasBackgroundDark, setWeatherType, setActualWeatherType, weatherType, isMoodTuning, isMoodTuningApplied } = useWeather()
    const { moodTuningWeatherDisplay } = useSettings()

    const isMoodTuningRef = useRef(isMoodTuning)
    useEffect(() => {
        isMoodTuningRef.current = isMoodTuning
    }, [isMoodTuning])

    /** ポーリング用：最後に取得成功した座標。バックグラウンド再取得で位置情報を再要求しない */
    const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null)

    /** 初回のみ位置情報を要求するためのフラグ（再レンダーで getCurrentPosition が繰り返し呼ばれるのを防ぐ） */
    const initialRequestDoneRef = useRef(false)

    const handleWeatherFetch = useCallback(async (lat: number, lon: number, options?: { background?: boolean }) => {
        const isBackground = options?.background === true
        try {
            if (!isBackground) {
                setWeatherState({ status: "loading", message: "天気を確認中..." })
            }
            const { weatherData, weatherMain } = await fetchWeatherData(lat, lon)
            setActualWeatherType(weatherMain)
            if (!isMoodTuningRef.current) {
                setWeatherType(weatherMain)
            }
            setWeatherState({ status: "success", data: weatherData })
            lastCoordsRef.current = { lat, lon }
        } catch (error) {
            if (!isBackground) {
                setWeatherState({
                    status: "error",
                    message: error instanceof Error ? error.message : "エラーが発生しました",
                })
            }
        }
    }, [setWeatherType, setActualWeatherType])

    /** 10分ごとに天気を再取得。Mood Tuning 中は行わない。初回成功後に lastCoordsRef が設定されてから有効。バックグラウンドで実行しローディング表示は出さない。 */
    useEffect(() => {
        const intervalMs = 10 * 60 * 1000
        const timer = setInterval(() => {
            if (isMoodTuningRef.current) return
            const coords = lastCoordsRef.current
            if (coords) {
                handleWeatherFetch(coords.lat, coords.lon, { background: true })
            }
        }, intervalMs)
        return () => clearInterval(timer)
    }, [handleWeatherFetch])

    const onGeolocationSuccess = useCallback(
        (position: GeolocationPosition) => {
            const { latitude, longitude } = position.coords
            handleWeatherFetch(latitude, longitude)
        },
        [handleWeatherFetch]
    )
    const onGeolocationError = useCallback((error: string) => {
        setWeatherState({ status: "error", message: error })
    }, [])

    const { requestGeolocation } = useGeolocation({
        onSuccess: onGeolocationSuccess,
        onError: onGeolocationError,
    })

    useEffect(() => {
        if (initialRequestDoneRef.current) return
        initialRequestDoneRef.current = true
        requestGeolocation()
    }, [requestGeolocation])


    const dateTime = currentTime !== null ? formatDateTime(new Date(currentTime)) : { dateString: "--/--/--/---", timeString: "--:--" }
    const { dateString, timeString } = dateTime

    const tuningWeatherType =
        isMoodTuning && moodTuningWeatherDisplay === "tuning" && weatherType !== null
            ? normalizeWeatherType(weatherType)
            : null
    const shouldUseTuningWeather = tuningWeatherType !== null

    // アイコン・気温表示用（天気取得成功時のみ表示）
    const displayWeatherType = tuningWeatherType
        ? tuningWeatherType
        : weatherState.status === "success"
        ? normalizeWeatherType(weatherState.data.weatherMain)
        : null

    const shouldUseMoodRainbowWeatherUi = isMoodTuningApplied && shouldUseTuningWeather
    const weatherDescriptionText = shouldUseMoodRainbowWeatherUi && displayWeatherType
      ? WEATHER_TYPE_LABELS[displayWeatherType]
      : weatherState.status === "success"
        ? weatherState.data.description
        : ""
    
    // isCanvasBackgroundDark: キャンバス背景の明暗に連動（画面上のテキスト・アイコン視認性用）
    const iconColor = displayWeatherType
        ? getWeatherThemeColor(displayWeatherType, effectiveTimeOfDay, isCanvasBackgroundDark)
        : undefined
    const weatherIcon = displayWeatherType
        ? createElement(getWeatherIcon(displayWeatherType, effectiveTimeOfDay), {
            className: shouldUseMoodRainbowWeatherUi ? "relative z-10 h-10 w-10" : "w-10 h-10",
            style: { color: iconColor },
            strokeWidth: 1.5,
        })
        : null
    
    const textColorClass = isCanvasBackgroundDark ? "text-white" : ""
    const mutedTextColorClass = isCanvasBackgroundDark ? "text-white/80" : "text-muted-foreground/60"
    const mutedTextColorClass2 = isCanvasBackgroundDark ? "text-white/70" : "text-muted-foreground/70"
    const mutedTextColorClass3 = isCanvasBackgroundDark ? "text-white/60" : "text-muted-foreground/80"

    const handleRetry = () => {
        setWeatherState({ status: "loading", message: "位置情報を取得中..." })
        requestGeolocation()
    }

    return (
        <div className="w-full max-w-md relative z-10">
            <div className="flex items-center justify-between gap-4">
                {/* 左: 日時（控えめに） */}
                <div className="text-left">
                    <p className={`text-[10px] font-light tracking-wide ${mutedTextColorClass}`}>{dateString}</p>
                    <p className={`text-sm font-light ${mutedTextColorClass3}`}>{timeString}</p>
                </div>

                {/* 右: 天気と気温 */}
                <div className="flex items-center gap-3">
                    {weatherState.status === "loading" && (
                        <div className="flex items-center gap-3">
                            <div className="text-right space-y-1">
                                <Skeleton className="h-6 w-16" />
                                <p className={`text-xs font-light ${mutedTextColorClass2}`}>{weatherState.message}</p>
                            </div>
                            <Skeleton className="w-10 h-10 rounded-full" />
                        </div>
                    )}

                    {weatherState.status === "error" && (
                        <div className="flex flex-col items-end gap-2">
                            <p className={`text-xs font-light text-right ${mutedTextColorClass2}`}>{weatherState.message}</p>
                            <Button variant="outline" size="sm" onClick={handleRetry}>
                                再試行
                            </Button>
                        </div>
                    )}

                    {weatherState.status === "success" && weatherIcon && (
                        <>
                            <div className="text-right">
                                <p className={`text-2xl font-serif ${textColorClass || "text-foreground"}`}>{weatherState.data.temp}</p>
                                <p className={`text-xs font-light ${mutedTextColorClass2}`}>{weatherState.data.city}</p>
                                {weatherDescriptionText && (
                                    <p className={`text-[10px] font-light ${shouldUseMoodRainbowWeatherUi ? "text-rainbow" : mutedTextColorClass}`}>
                                        {weatherDescriptionText}
                                    </p>
                                )}
                            </div>
                            {shouldUseMoodRainbowWeatherUi ? (
                                <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
                                    <span className="ring-rainbow absolute inset-0 rounded-full" aria-hidden />
                                    {weatherIcon}
                                </span>
                            ) : (
                                weatherIcon
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
