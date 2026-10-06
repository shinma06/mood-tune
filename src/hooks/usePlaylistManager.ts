"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { generateDashboard } from "@/app/actions/generateDashboard"
import { hasGenresChanged, getGenresDiff, EMPTY_PLAYLIST, type LoadingMode } from "@/lib/playlist-utils"
import type { DashboardItem } from "@/types/dashboard"
import type { Genre } from "@/lib/constants"
import type { WeatherType, TimeOfDay } from "@/lib/weather-background"

interface UsePlaylistManagerOptions {
  initialPlaylists?: DashboardItem[]
  selectedGenres: Genre[]
  isGenresInitialized: boolean
  effectiveWeather: WeatherType
  effectiveTimeOfDay: TimeOfDay
  actualWeatherType: string | null
  actualTimeOfDay: TimeOfDay
  isMoodTuning: boolean
  playlistRefreshTrigger: number
  /** true の間は初期同期をスキップ */
  suspended: boolean
  /** ジャンルパネル開中は Mood Tuning トリガーで再構築しない */
  isGenrePanelOpen: boolean
}

interface PlaylistRequest {
  weather: WeatherType
  time: TimeOfDay
  genres: Genre[]
  mode: Exclude<LoadingMode, null>
  /** 差分更新時は、再利用する既存データと最終表示順を保持する。 */
  previous?: DashboardItem[] | null
  order?: string[]
}

export function usePlaylistManager({
  initialPlaylists,
  selectedGenres,
  isGenresInitialized,
  effectiveWeather,
  effectiveTimeOfDay,
  actualWeatherType,
  actualTimeOfDay,
  isMoodTuning,
  playlistRefreshTrigger,
  suspended,
  isGenrePanelOpen,
}: UsePlaylistManagerOptions) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playlists, setPlaylists] = useState<DashboardItem[] | null>(initialPlaylists ?? null)
  const [request, setRequest] = useState<PlaylistRequest | null>(null)
  const [initialSyncStarted, setInitialSyncStarted] = useState(false)
  const [observedEnvironment, setObservedEnvironment] = useState<{
    weather: string | null
    time: TimeOfDay
  } | null>(null)
  const [handledRefreshTrigger, setHandledRefreshTrigger] = useState(0)
  // Effect の再接続でも、同じ生成要求を二重送信しない。
  const pendingGeneration = useRef<{
    request: PlaylistRequest
    promise: Promise<DashboardItem[]>
  } | null>(null)

  const isLoading = request !== null
  const loadingMode = request?.mode ?? null
  const displayPlaylists = useMemo(() => playlists ?? [], [playlists])
  const isLoadingOrEmpty = isLoading || displayPlaylists.length === 0
  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, displayPlaylists.length - 1))
  const currentPlaylist = displayPlaylists[safeCurrentIndex] ?? EMPTY_PLAYLIST

  const refreshPlaylists = useCallback((options?: { autoUpdate?: boolean }) => {
    if (selectedGenres.length === 0) return
    setRequest((current) => current ?? {
      weather: effectiveWeather,
      time: effectiveTimeOfDay,
      genres: selectedGenres,
      mode: options?.autoUpdate ? "auto" : "all",
    })
  }, [effectiveWeather, effectiveTimeOfDay, selectedGenres])

  const refreshPlaylistByGenre = useCallback((genre: Genre) => {
    if (!selectedGenres.includes(genre)) return
    setRequest((current) => current ?? {
      weather: effectiveWeather,
      time: effectiveTimeOfDay,
      genres: [genre],
      mode: "single",
    })
  }, [effectiveWeather, effectiveTimeOfDay, selectedGenres])

  const updatePlaylistsWithDiff = useCallback((
    currentGenres: string[],
    diff: { added: string[]; removed: string[]; unchanged: string[] },
    currentPlaylists: DashboardItem[] | null,
    isInitialSync = false
  ) => {
    if (currentGenres.length === 0) {
      setPlaylists([])
      setCurrentIndex(0)
      return
    }
    setRequest((current) => current ?? {
      weather: effectiveWeather,
      time: effectiveTimeOfDay,
      genres: diff.added as Genre[],
      previous: currentPlaylists,
      order: currentGenres,
      mode: isInitialSync ? "initial" : "added",
    })
  }, [effectiveWeather, effectiveTimeOfDay])

  // 初期同期・実環境の変更・明示的な再生成は、入力の変更時に一度だけ要求する。
  // loading は要求から導出し、Effect 内で同期的に立ち上げない。
  if (!request && !suspended && isGenresInitialized && !initialSyncStarted) {
    setInitialSyncStarted(true)
    const currentGenres = playlists?.map((item) => item.genre) ?? []
    if (hasGenresChanged(currentGenres, selectedGenres)) {
      updatePlaylistsWithDiff(selectedGenres, getGenresDiff(currentGenres, selectedGenres), playlists, true)
    }
  }

  if (!request && !suspended && !isMoodTuning && isGenresInitialized && selectedGenres.length > 0) {
    if (observedEnvironment?.time !== actualTimeOfDay || observedEnvironment?.weather !== actualWeatherType) {
      setObservedEnvironment({ weather: actualWeatherType, time: actualTimeOfDay })
      if (observedEnvironment && (
        observedEnvironment.time !== actualTimeOfDay ||
        (observedEnvironment.weather !== null && observedEnvironment.weather !== actualWeatherType)
      )) {
        refreshPlaylists({ autoUpdate: true })
      }
    }
  }

  if (!request && !suspended && !isGenrePanelOpen && isGenresInitialized && selectedGenres.length > 0 &&
      playlistRefreshTrigger !== handledRefreshTrigger) {
    setHandledRefreshTrigger(playlistRefreshTrigger)
    if (playlistRefreshTrigger > 0) refreshPlaylists()
  }

  useEffect(() => {
    if (!request) return
    let active = true
    if (pendingGeneration.current?.request !== request) {
      pendingGeneration.current = {
        request,
        promise: request.genres.length > 0
          ? generateDashboard(request.weather, request.time, request.genres)
          : Promise.resolve([]),
      }
    }
    pendingGeneration.current.promise.then((generated) => {
      if (!active) return
      if (request.mode === "single") {
        const newItem = generated[0]
        if (newItem) {
          setPlaylists((previous) => previous
            ? previous.map((item) => item.genre === newItem.genre ? newItem : item)
            : [newItem])
        }
      } else if (request.order) {
        const byGenre = new Map((request.previous ?? []).map((item) => [item.genre, item]))
        generated.forEach((item) => byGenre.set(item.genre, item))
        setPlaylists(request.order.map((genre) => byGenre.get(genre))
          .filter((item): item is DashboardItem => item !== undefined))
        setCurrentIndex(0)
      } else {
        setPlaylists(generated)
        setCurrentIndex((previous) => Math.min(previous, Math.max(0, generated.length - 1)))
      }
    }).catch((error) => {
      if (active) console.error("Failed to generate dashboard:", error)
    }).finally(() => {
      if (active) setRequest(null)
    })
    return () => { active = false }
  }, [request])

  return {
    playlists,
    currentIndex,
    setCurrentIndex,
    isLoading,
    loadingMode,
    displayPlaylists,
    isLoadingOrEmpty,
    safeCurrentIndex,
    currentPlaylist,
    refreshPlaylists,
    refreshPlaylistByGenre,
    updatePlaylistsWithDiff,
  }
}
