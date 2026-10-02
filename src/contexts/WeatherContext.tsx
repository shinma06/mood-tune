"use client"

import { createContext, useContext, useState, useSyncExternalStore, useMemo, useCallback, ReactNode } from "react"
import { getTimeOfDay, isCanvasTextDark, type TimeOfDay, type WeatherType } from "@/lib/weather-background"
import { normalizeWeatherType } from "@/lib/weather-utils"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import {
  DEFAULT_THEME_PREFERENCE,
  SETTINGS_STORAGE_KEYS,
  type ThemePreference,
} from "@/lib/constants"
import { isThemePreference } from "@/lib/validators"

interface WeatherContextType {
  /** クライアントで現在時刻が確定したか（SSR/初回は false） */
  isTimeInitialized: boolean
  /** 表示用の現地時刻（分単位のepoch ms）。SSR/初回は null。 */
  currentTime: number | null
  /** 表示用の現在時（0–23）。マウント時と1分ごとに更新。 */
  displayHour: number
  /** 実際の時間帯（displayHour から算出）。UI の明暗・背景はこれにのみ従う。 */
  actualTimeOfDay: TimeOfDay
  /** moodTuningTimeOfDay を考慮した表示用時間帯（プレイリスト生成・選択状態用） */
  effectiveTimeOfDay: TimeOfDay
  /** normalizeWeatherType を適用した表示用天気（単一ソース） */
  effectiveWeather: WeatherType
  /** キャンバス（背景）が暗いか。画面上のテキスト・アイコンの視認性用。天気×時間帯で算出。 */
  isCanvasBackgroundDark: boolean
  /** モーダル・パネル等オーバーレイのライト/ダークテーマ。 */
  isOverlayThemeDark: boolean
  /** UI テーマの表示モード（time/light/dark/system）。 */
  themePreference: ThemePreference
  setThemePreference: (value: ThemePreference | ((prev: ThemePreference) => ThemePreference)) => void
  weatherType: string | null
  setWeatherType: (weather: string | null) => void
  /** APIから取得した実際の天気（手動設定をやめるときの復帰用） */
  actualWeatherType: string | null
  setActualWeatherType: (weather: string | null) => void
  /** Mood Tuning で手動設定した時間帯 */
  moodTuningTimeOfDay: TimeOfDay | null
  setMoodTuningTimeOfDay: (timeOfDay: TimeOfDay | null) => void
  /** Mood Tuning で手動設定中か（天気・時間帯を上書きしているか） */
  isMoodTuning: boolean
  setIsMoodTuning: (enabled: boolean) => void
  /** 表示が実際の天気・時間と異なる場合 true（虹枠・虹色ラベル等の Mood Tuning UI 用。単一ソース） */
  isMoodTuningApplied: boolean
  /** パネルから「プレイリストを再構築」が押されたときのトリガー（インクリメントで発火） */
  playlistRefreshTrigger: number
  requestPlaylistRefresh: () => void
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined)

function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

function getCurrentMinute() {
  return Math.floor(Date.now() / 60000) * 60000
}

function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  mediaQuery.addEventListener("change", onChange)
  return () => mediaQuery.removeEventListener("change", onChange)
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const currentTime = useSyncExternalStore(subscribeToClock, getCurrentMinute, () => null)
  const isTimeInitialized = currentTime !== null
  const displayHour = currentTime === null ? 0 : new Date(currentTime).getHours()
  const [weatherType, setWeatherType] = useState<string | null>(null)
  const [actualWeatherType, setActualWeatherType] = useState<string | null>(null)
  const [moodTuningTimeOfDay, setMoodTuningTimeOfDay] = useState<TimeOfDay | null>(null)
  const [isMoodTuning, setIsMoodTuning] = useState(false)
  const [playlistRefreshTrigger, setPlaylistRefreshTrigger] = useState(0)
  const [themePreference, setThemePreference] = useLocalStorage<ThemePreference>(
    SETTINGS_STORAGE_KEYS.themePreference,
    DEFAULT_THEME_PREFERENCE,
    { validate: isThemePreference }
  )
  const isSystemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  )

  /** 実際の時間帯（displayHour から算出）。UI の明暗・背景はこれにのみ従う。 */
  const actualTimeOfDay = useMemo<TimeOfDay>(() => {
    if (!isTimeInitialized) return "day"
    return getTimeOfDay(displayHour)
  }, [isTimeInitialized, displayHour])

  /** moodTuningTimeOfDay を考慮した表示用時間帯（プレイリスト生成・選択状態用）。未初期化時は day。 */
  const effectiveTimeOfDay = useMemo<TimeOfDay>(() => {
    if (!isTimeInitialized) return "day"
    if (isMoodTuning && moodTuningTimeOfDay) {
      return moodTuningTimeOfDay
    }
    return getTimeOfDay(displayHour)
  }, [isTimeInitialized, isMoodTuning, moodTuningTimeOfDay, displayHour])

  /** normalizeWeatherType を適用した表示用天気（単一ソース） */
  const effectiveWeather = useMemo<WeatherType>(() => {
    return normalizeWeatherType(weatherType ?? "Clear")
  }, [weatherType])

  /** キャンバス背景が暗いか。視認性専用の静的テーブル（天気×表示時間）で算出。 */
  const isCanvasBackgroundDark = useMemo(() => {
    if (!isTimeInitialized) return false
    return isCanvasTextDark(effectiveWeather, effectiveTimeOfDay)
  }, [isTimeInitialized, effectiveWeather, effectiveTimeOfDay])

  /** オーバーレイのテーマ。themePreference に従う（canvas 判定とは独立）。 */
  const isOverlayThemeDark = useMemo(() => {
    if (!isTimeInitialized) return false
    if (themePreference === "dark") return true
    if (themePreference === "light") return false
    if (themePreference === "system") return isSystemDark
    return actualTimeOfDay === "dusk" || actualTimeOfDay === "night"
  }, [isTimeInitialized, themePreference, isSystemDark, actualTimeOfDay])

  /** 表示が実際の天気・時間と異なる場合のみ true。虹枠・虹色ラベル等の Mood Tuning UI を共通で制御。 */
  const isMoodTuningApplied = useMemo(() => {
    const actualWeatherNorm = actualWeatherType ? normalizeWeatherType(actualWeatherType) : null
    return (
      (actualWeatherNorm != null && effectiveWeather !== actualWeatherNorm) ||
      effectiveTimeOfDay !== actualTimeOfDay
    )
  }, [actualWeatherType, effectiveWeather, effectiveTimeOfDay, actualTimeOfDay])

  const requestPlaylistRefresh = useCallback(() => {
    setPlaylistRefreshTrigger((prev) => prev + 1)
  }, [])

  const contextValue = useMemo<WeatherContextType>(() => ({
    isTimeInitialized,
    currentTime,
    displayHour,
    actualTimeOfDay,
    effectiveTimeOfDay,
    effectiveWeather,
    isCanvasBackgroundDark,
    isOverlayThemeDark,
    themePreference,
    setThemePreference,
    weatherType,
    setWeatherType,
    actualWeatherType,
    setActualWeatherType,
    moodTuningTimeOfDay,
    setMoodTuningTimeOfDay,
    isMoodTuning,
    setIsMoodTuning,
    isMoodTuningApplied,
    playlistRefreshTrigger,
    requestPlaylistRefresh,
  }), [
    isTimeInitialized,
    currentTime,
    displayHour,
    actualTimeOfDay,
    effectiveTimeOfDay,
    effectiveWeather,
    isCanvasBackgroundDark,
    isOverlayThemeDark,
    themePreference,
    setThemePreference,
    weatherType,
    setWeatherType,
    actualWeatherType,
    setActualWeatherType,
    moodTuningTimeOfDay,
    setMoodTuningTimeOfDay,
    isMoodTuning,
    setIsMoodTuning,
    isMoodTuningApplied,
    playlistRefreshTrigger,
    requestPlaylistRefresh,
  ])

  return (
    <WeatherContext.Provider value={contextValue}>
      {children}
    </WeatherContext.Provider>
  )
}

export function useWeather() {
  const context = useContext(WeatherContext)
  if (context === undefined) {
    throw new Error("useWeather must be used within a WeatherProvider")
  }
  return context
}
