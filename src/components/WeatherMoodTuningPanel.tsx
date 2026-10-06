"use client"

import { useState } from "react"
import { useWeather } from "@/contexts/WeatherContext"
import { getWeatherIcon, getWeatherThemeColor, normalizeWeatherType } from "@/lib/weather-utils"
import { getTimeOfDay } from "@/lib/weather-background"
import type { WeatherType, TimeOfDay } from "@/lib/weather-background"
import { WEATHER_TYPES, TIME_OF_DAY_OPTIONS, TIME_OF_DAY_LABELS, WEATHER_TYPE_LABELS } from "@/lib/constants"
import { getOverlayStyles } from "@/lib/overlay-theme"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

interface WeatherMoodTuningPanelProps {
  /** 親で制御する場合の開閉状態 */
  isOpen?: boolean
  onOpen?: () => void
  onClose?: () => void
  /** true のときトグルボタンを非表示（他パネル開時） */
  hideToggleButton?: boolean
}

export default function WeatherMoodTuningPanel({
  isOpen: controlledIsOpen,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  hideToggleButton = false,
}: WeatherMoodTuningPanelProps = {}) {
  const {
    displayHour,
    effectiveTimeOfDay,
    effectiveWeather,
    isOverlayThemeDark,
    weatherType,
    setWeatherType,
    actualWeatherType,
    moodTuningTimeOfDay,
    setMoodTuningTimeOfDay,
    setIsMoodTuning,
    requestPlaylistRefresh,
  } = useWeather()
  const [internalOpen, setInternalOpen] = useState(false)
  /** 親制御時は props を、そうでなければ内部 state を使う */
  const isOpen = onOpenProp !== undefined ? (controlledIsOpen ?? false) : internalOpen
  /** パネルを開いた時点のスナップショット（開閉時の変更判定・リセットボタン表示判定用） */
  const [snapshot, setSnapshot] = useState<{
    openedWeather: string | null
    openedTimeOfDay: TimeOfDay | null
    actualWeatherAtOpen: string | null
    actualTimeOfDayAtOpen: TimeOfDay | null
  }>({ openedWeather: null, openedTimeOfDay: null, actualWeatherAtOpen: null, actualTimeOfDayAtOpen: null })

  /** パネルを開く: この時点の天気・時間と「現在の天気・時間」をスナップショットしてから開く */
  const handleOpenPanel = () => {
    setSnapshot({
      openedWeather: weatherType,
      openedTimeOfDay: moodTuningTimeOfDay,
      actualWeatherAtOpen: actualWeatherType,
      actualTimeOfDayAtOpen: getTimeOfDay(displayHour),
    })
    if (onOpenProp) onOpenProp()
    else setInternalOpen(true)
  }

  /** 天気・時間帯は即時Contextに反映（UIのみ。プレイリストは閉じたときのみ更新） */
  const handleWeatherTypeChange = (type: WeatherType) => {
    setWeatherType(type)
    setIsMoodTuning(true)
  }

  const handleTimeOfDayChange = (timeOfDay: TimeOfDay) => {
    setMoodTuningTimeOfDay(timeOfDay)
    setIsMoodTuning(true)
  }

  /** パネルを閉じる: 開いた時点の天気・時間と比べて変わっている場合のみプレイリストを再構築 */
  const handleClosePanel = () => {
    const { openedWeather, openedTimeOfDay } = snapshot
    if (weatherType !== openedWeather || moodTuningTimeOfDay !== openedTimeOfDay) {
      requestPlaylistRefresh()
    }
    if (onCloseProp) onCloseProp()
    else setInternalOpen(false)
  }

  /** トグル: 開くときはスナップショット、閉じるときは変更があれば再構築してから閉じる */
  const handleTogglePanel = () => {
    if (isOpen) {
      handleClosePanel()
    } else {
      handleOpenPanel()
    }
  }

  /** リセットは即時反映（Contextを実際の天気・時間に戻す。プレイリストは閉じたときに判定） */
  const handleReset = () => {
    if (actualWeatherType) {
      setWeatherType(actualWeatherType)
    } else {
      setWeatherType(null)
    }
    setMoodTuningTimeOfDay(null)
    setIsMoodTuning(false)
  }

  /** 表示用: Context の単一ソースを使用（背景と常に一致） */
  const currentWeatherType = effectiveWeather
  const currentTimeOfDayLabel = TIME_OF_DAY_OPTIONS.find((opt) => opt.value === effectiveTimeOfDay)?.label ?? "-"
  /** 実際の天気・時間帯（API・displayHour。選択肢の「現在」強調用） */
  const actualWeatherTypeNormalized = actualWeatherType ? normalizeWeatherType(actualWeatherType) : null
  const actualTimeOfDay = getTimeOfDay(displayHour)

  /** 表示中の天気・時間が実際と異なる場合に虹色ボタンを表示（パネル開閉に依存させず一貫したデザインに） */
  const showRainbowButton =
    (actualWeatherTypeNormalized != null && effectiveWeather !== actualWeatherTypeNormalized) ||
    effectiveTimeOfDay !== actualTimeOfDay

  /** パネルを開いた時点で「現在の天気・時間」と違う状態を設定していた場合のみリセットボタンを表示 */
  const { openedWeather, openedTimeOfDay, actualWeatherAtOpen, actualTimeOfDayAtOpen } = snapshot
  const actualWeatherAtOpenNorm = normalizeWeatherType(actualWeatherAtOpen ?? "Clear")
  const actualTimeAtOpen = actualTimeOfDayAtOpen ?? actualTimeOfDay
  const effectiveWeatherAtOpen = openedWeather != null ? normalizeWeatherType(openedWeather) : actualWeatherAtOpenNorm
  const effectiveTimeOfDayAtOpen = openedTimeOfDay ?? actualTimeAtOpen
  const showResetButton =
    isOpen &&
    (effectiveWeatherAtOpen !== actualWeatherAtOpenNorm || effectiveTimeOfDayAtOpen !== actualTimeAtOpen)

  const s = getOverlayStyles(isOverlayThemeDark)

  const btnClass = (base: string, isSelected: boolean, isActual: boolean) => {
    const selected = isSelected
      ? isOverlayThemeDark
        ? "border-white bg-white/10 ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        : "border-primary bg-primary/10 ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
      : isOverlayThemeDark
        ? "border-white/20 hover:bg-white/10"
        : "border-muted-foreground/50 hover:bg-muted/50"
    const actualRing = isActual && !isSelected
      ? isOverlayThemeDark
        ? "ring-2 ring-white/20 ring-offset-2 ring-offset-slate-900"
        : "ring-2 ring-muted-foreground/40 ring-offset-2 ring-offset-background"
      : ""
    return `${base} ${selected} ${actualRing}`
  }

  return (
    <>
      {/* トグルボタン（常に同一サイズのラッパーで包み、Mood Tuning 中の開閉でレイアウトがずれないようにする） */}
      {!hideToggleButton && (
        <div
          className={`fixed bottom-12 left-4 z-50 rounded-[1.2rem] w-[calc(3.1rem+4px)] h-[calc(3.1rem+4px)] flex items-center justify-center ${showRainbowButton ? "bg-rainbow p-[2px]" : ""}`}
        >
          <Button
            variant="outline"
            size="icon"
            className={`
              size-[3.1rem] bg-background/80 backdrop-blur-sm [&_svg]:size-6
              ${showRainbowButton ? "rounded-[calc(1.2rem-2px)] border-0" : "rounded-[1.2rem]"}
              ${isOpen
                ? isOverlayThemeDark
                  ? "bg-white/15 text-white border-white/40 hover:bg-white/25 hover:text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                : isOverlayThemeDark
                  ? "hover:bg-white/10 hover:text-white/90 hover:border-white/40"
                  : "hover:bg-background hover:text-foreground hover:border-border"
              }
            `}
            onClick={handleTogglePanel}
            aria-label={isOpen ? "Mood Tuningパネルを閉じる" : "Mood Tuningパネルを開く"}
          >
            <Sparkles className="size-6" />
          </Button>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-26 left-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
          <Card className={`w-full backdrop-blur-sm ${s.container}`}>
            <CardHeader>
              <CardTitle className={`text-base font-semibold flex items-center gap-2.5 ${s.title}`}>
                <Sparkles className="w-5 h-5 shrink-0" />
                <span className="text-rainbow">Mood Tuning</span>
              </CardTitle>
              <CardDescription className={`text-xs ${s.muted}`}>
                天気や時間帯を選んで、今の気分に合わせたプレイリストを作成
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label className={`text-sm ${s.title}`}>天気</Label>
                <div className="grid grid-cols-3 gap-2">
                  {WEATHER_TYPES.map((type) => {
                    const Icon = getWeatherIcon(type)
                    const color = getWeatherThemeColor(type, undefined, isOverlayThemeDark)
                    const isSelected = currentWeatherType === type
                    const isActualWeather = actualWeatherTypeNormalized === type
                    return (
                      <button
                        key={type}
                        className={btnClass("relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all", isSelected, isActualWeather)}
                        onClick={() => handleWeatherTypeChange(type)}
                      >
                        {isActualWeather && (
                          <span className={`absolute -top-1 -right-1 rounded px-1 text-[9px] font-medium ring-1 ${isOverlayThemeDark ? "bg-white/30 text-white ring-slate-900" : "bg-muted-foreground text-background ring-background"}`}>
                            現在
                          </span>
                        )}
                        <Icon className="w-5 h-5" style={{ color }} />
                        <span className={`text-xs ${isOverlayThemeDark ? "text-white/80" : ""}`}>{WEATHER_TYPE_LABELS[type]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 時間帯選択 */}
              <div className="space-y-2">
                <Label className={`text-sm ${s.title}`}>時間帯</Label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_OF_DAY_OPTIONS.map((option) => {
                    const isSelected = effectiveTimeOfDay === option.value
                    const isActualTime = actualTimeOfDay === option.value
                    return (
                      <button
                        key={option.value}
                        className={btnClass("relative flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all text-xs", isSelected, isActualTime)}
                        onClick={() => handleTimeOfDayChange(option.value)}
                      >
                        {isActualTime && (
                          <span className={`absolute -top-1 -right-1 rounded px-1 text-[9px] font-medium ring-1 ${isOverlayThemeDark ? "bg-white/30 text-white ring-slate-900" : "bg-muted-foreground text-background ring-background"}`}>
                            現在
                          </span>
                        )}
                        <span className={`block leading-tight ${isSelected ? isOverlayThemeDark ? "text-white font-medium" : "text-primary font-medium" : isOverlayThemeDark ? "text-white/70" : ""}`}>
                          <span className="block">{TIME_OF_DAY_LABELS[option.value]}</span>
                          <span className="block text-[10px] opacity-90">{option.timeRange}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {showResetButton && (
                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className={`w-full ${isOverlayThemeDark ? "border-white/50 bg-white/15 text-white hover:bg-white/25 hover:text-white hover:border-white/60" : ""}`}
                    size="sm"
                  >
                    実際の天気・時間に戻す
                  </Button>
                  <div className={`pt-2 border-t text-xs space-y-1 ${isOverlayThemeDark ? "border-white/20" : ""} ${s.muted}`}>
                    <div>
                      現在の設定: <span className="font-mono">{currentWeatherType ? WEATHER_TYPE_LABELS[currentWeatherType] : "-"}</span> / {currentTimeOfDayLabel}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
