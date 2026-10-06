"use client"

import { useSelectedGenres } from "@/hooks/useSelectedGenres"
import {
  AVAILABLE_GENRES,
  MAX_SELECTED_GENRES,
  type Genre,
} from "@/lib/constants"
import { getOverlayStyles } from "@/lib/overlay-theme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Check, Music, XCircle } from "lucide-react"
import { useWeather } from "@/contexts/WeatherContext"

interface GenreSelectorProps {
  flat?: boolean
}

export default function GenreSelector({ flat = false }: GenreSelectorProps) {
  const [selectedGenres, setSelectedGenres] = useSelectedGenres()
  const { isOverlayThemeDark } = useWeather()
  const s = getOverlayStyles(isOverlayThemeDark)

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre)
      }
      if (prev.length >= MAX_SELECTED_GENRES) {
        return prev
      }
      return [...prev, genre]
    })
  }

  const clearAll = () => {
    setSelectedGenres([])
  }

  const isSelected = (genre: Genre) => selectedGenres.includes(genre)
  const isMaxReached = selectedGenres.length >= MAX_SELECTED_GENRES
  const isEmpty = selectedGenres.length === 0

  const genreBtnClass = (selected: boolean, disabled: boolean) => {
    if (isOverlayThemeDark) {
      return `h-7 px-3 text-xs font-medium rounded-full border transition-all ${
        selected
          ? "bg-white text-slate-900 border-white"
          : "bg-transparent text-white/60 border-white/20 hover:border-white/50 hover:text-white/90"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`
    }
    return `h-7 px-3 text-xs font-medium rounded-full transition-all ${
      selected
        ? "bg-primary text-primary-foreground shadow-sm"
        : "hover:bg-muted/50"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className={`flex items-center gap-2 text-sm font-medium ${s.title}`}>
        <Music className="w-4 h-4" />
        ジャンルを選択
        <span className={`text-xs font-normal ${s.muted}`}>
          {selectedGenres.length}/{MAX_SELECTED_GENRES}
        </span>
      </div>
      {isOverlayThemeDark ? (
        <button
          onClick={clearAll}
          disabled={isEmpty}
          className={`flex items-center gap-1 text-xs ${s.muted} hover:text-white/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <XCircle className="w-3.5 h-3.5" />
          選択解除
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          disabled={isEmpty}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          aria-label="すべて解除"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          選択解除
        </Button>
      )}
    </div>
  )

  const body = (
    <>
      {isEmpty && (
        <p className={`mb-3 text-xs ${isOverlayThemeDark ? "text-amber-400" : "text-amber-600 dark:text-amber-500"}`}>
          好みのジャンルを1つ以上選択してください
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_GENRES.map((genre) => {
          const selected = isSelected(genre)
          const disabled = !selected && isMaxReached
          return isOverlayThemeDark ? (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              disabled={disabled}
              className={genreBtnClass(selected, disabled)}
            >
              {selected && <Check className="w-3 h-3 mr-1 inline" />}
              {genre}
            </button>
          ) : (
            <Button
              key={genre}
              variant={selected ? "default" : "outline"}
              size="sm"
              onClick={() => toggleGenre(genre)}
              disabled={disabled}
              className={genreBtnClass(selected, disabled)}
            >
              {selected && <Check className="w-3 h-3 mr-1" />}
              {genre}
            </Button>
          )
        })}
      </div>
      {isMaxReached && (
        <p className={`mt-3 text-xs ${s.muted}`}>
          最大{MAX_SELECTED_GENRES}個まで選択できます。変更するには選択済みのジャンルを解除してください。
        </p>
      )}
    </>
  )

  if (flat || isOverlayThemeDark) {
    const wrapperClass = isOverlayThemeDark && !flat
      ? `w-full rounded-2xl border shadow-xl ${s.container}`
      : "w-full"
    return (
      <div className={wrapperClass}>
        <div className={isOverlayThemeDark && !flat ? "px-4 pt-4 pb-3" : "pb-3"}>
          {header}
        </div>
        <div className={isOverlayThemeDark && !flat ? "px-4 pb-4" : ""}>
          {body}
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full bg-background/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        {header}
      </CardHeader>
      <CardContent className="pt-0">
        {body}
      </CardContent>
    </Card>
  )
}
