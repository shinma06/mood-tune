"use client"

import { useState, useRef, useCallback } from "react"
import WeatherMonitor from "./WeatherMonitor"
import WeatherAnimation from "./WeatherAnimation"
import WeatherMoodTuningPanel from "./WeatherMoodTuningPanel"
import SettingsPanel from "./SettingsPanel"
import FloatingNoteEffect from "./FloatingNoteEffect"
import { useSelectedGenres } from "@/hooks/useSelectedGenres"
import { useWeather } from "@/contexts/WeatherContext"
import { usePlaylistManager } from "@/hooks/usePlaylistManager"
import { getWeatherBackground } from "@/lib/weather-background"
import { formatGradientBackground, INITIAL_BACKGROUND_GRADIENT } from "@/lib/weather-background-utils"
import {
    useVinylRotation,
    REGENERATE_THRESHOLD_DEG,
    REGENERATE_ZONE_ENTRY_DEG,
} from "@/hooks/useVinylRotation"
import { getGenreThemeColors, REALISTIC_VINYL_THEME } from "@/lib/constants"
import {
    hasGenresChanged,
    getGenresDiff,
    getImageUrl,
    LOADING_GENRE_TEXT,
    getLoadingTitleText,
} from "@/lib/playlist-utils"
import { useSettings } from "@/hooks/useSettings"
import { Music, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import SpotifyIcon from "@/components/shared/SpotifyIcon"
import { saveToSpotify } from "@/app/actions/saveToSpotify"
import type { DashboardItem } from "@/types/dashboard"
import type { Genre } from "@/lib/constants"

interface PlaylistExplorerProps {
    playlists?: DashboardItem[]
    suspended?: boolean
    isUnauthenticated?: boolean
    onRequestLoginModal?: () => void
}

export default function PlaylistExplorer({
    playlists: initialPlaylists,
    suspended = false,
    isUnauthenticated = true,
    onRequestLoginModal,
}: PlaylistExplorerProps) {
    const { isTimeInitialized, actualWeatherType, actualTimeOfDay, isMoodTuning, effectiveWeather, effectiveTimeOfDay, playlistRefreshTrigger, isCanvasBackgroundDark, isOverlayThemeDark, isMoodTuningApplied } = useWeather()
    const [openPanel, setOpenPanel] = useState<null | "mood" | "genre">(null)
    const [selectedGenres, , isGenresInitialized] = useSelectedGenres()
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const { autoRotationEnabled, tonearmVisible, noteEffectEnabled } = useSettings()

    const genresOnOpenRef = useRef<string[]>([])

    const {
        playlists,
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
    } = usePlaylistManager({
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
        isGenrePanelOpen: openPanel === "genre",
    })

    const isInitialSyncStaleJPop =
        isLoading &&
        playlists?.length === 1 &&
        currentPlaylist.genre === "J-POP" &&
        selectedGenres.length > 0 &&
        selectedGenres[0] !== "J-POP"
    const isEmpty = displayPlaylists.length === 0 || currentPlaylist.genre === "---"
    const useRealisticVinyl = isInitialSyncStaleJPop || isEmpty
    const vinylColors = useRealisticVinyl
        ? REALISTIC_VINYL_THEME
        : getGenreThemeColors(currentPlaylist.genre)

    /** モバイル端末かどうか（ネイティブSpotifyアプリへの遷移に使用） */
    const isMobile = useCallback(() => {
        if (typeof navigator === "undefined") return false
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
    }, [])

    const handleSaveToSpotify = useCallback(async () => {
        if (isUnauthenticated) {
            onRequestLoginModal?.()
            return
        }
        if (isLoadingOrEmpty || isSaving) return
        setSaveError(null)
        setIsSaving(true)
        try {
            const result = await saveToSpotify(currentPlaylist.title, currentPlaylist.trackUris)
            if (result.success) {
                const playlistUrl = result.playlistUrl
                const playlistId = playlistUrl.match(/\/playlist\/([a-zA-Z0-9]+)/)?.[1]

                if (isMobile() && playlistId) {
                    // モバイル: spotify: URI でネイティブアプリのプレイリスト画面を開く（未インストール時はウェブにフォールバック）
                    const spotifyUri = `spotify:playlist:${playlistId}`
                    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
                    const cancelFallback = () => {
                        if (fallbackTimer != null) {
                            clearTimeout(fallbackTimer)
                            fallbackTimer = null
                        }
                    }
                    const onVisibilityChange = () => {
                        if (document.hidden) {
                            cancelFallback()
                            document.removeEventListener("visibilitychange", onVisibilityChange)
                        }
                    }
                    fallbackTimer = setTimeout(() => {
                        fallbackTimer = null
                        document.removeEventListener("visibilitychange", onVisibilityChange)
                        window.open(playlistUrl, "_blank", "noopener,noreferrer")
                    }, 2500)
                    document.addEventListener("visibilitychange", onVisibilityChange)
                    window.location.href = spotifyUri
                } else {
                    window.open(playlistUrl, "_blank", "noopener,noreferrer")
                }
            } else {
                setSaveError(result.error)
            }
        } catch {
            setSaveError("Spotifyへの接続に失敗しました")
        } finally {
            setIsSaving(false)
        }
    }, [isUnauthenticated, onRequestLoginModal, isLoadingOrEmpty, isSaving, currentPlaylist, isMobile])

    const handleToggleSettings = useCallback(() => {
        if (openPanel !== "genre") {
            genresOnOpenRef.current = [...selectedGenres]
            setOpenPanel("genre")
        } else {
            if (selectedGenres.length === 0) return
            setOpenPanel(null)
            if (hasGenresChanged(genresOnOpenRef.current, selectedGenres)) {
                const diff = getGenresDiff(genresOnOpenRef.current, selectedGenres)
                updatePlaylistsWithDiff(selectedGenres, diff, playlists)
            }
        }
    }, [openPanel, selectedGenres, playlists, updatePlaylistsWithDiff])

    if (isLoading && openPanel !== null) {
        setOpenPanel(null)
    }

    const backgroundStyle = isTimeInitialized
      ? formatGradientBackground(getWeatherBackground(effectiveWeather, effectiveTimeOfDay))
      : INITIAL_BACKGROUND_GRADIENT
    const genreColorClass = isCanvasBackgroundDark ? "text-white/80" : "text-muted-foreground"
    const titleColorClass = isCanvasBackgroundDark ? "text-white" : "text-foreground"

    const {
        rotation,
        isDragging,
        cumulativeRotation,
        snapBackDurationMs,
        vinylRef,
        handleMouseDown,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    } = useVinylRotation({
        onRotationComplete: (direction) => {
            const length = displayPlaylists.length
            if (length === 0) return
            if (direction === "next") {
                setCurrentIndex((prev) => (prev + 1) % length)
            } else {
                setCurrentIndex((prev) => (prev - 1 + length) % length)
            }
        },
        canPaginate: displayPlaylists.length > 1,
        onRegenerateCurrent:
            displayPlaylists.length > 0 && currentPlaylist.genre !== "---"
                ? () => refreshPlaylistByGenre(currentPlaylist.genre as Genre)
                : undefined,
        onRegenerateAll:
            selectedGenres.length > 0 ? refreshPlaylists : undefined,
        idleEnabled: autoRotationEnabled,
    })

    const showRegenerateFeedback =
        isDragging &&
        snapBackDurationMs === null &&
        Math.abs(cumulativeRotation) > REGENERATE_ZONE_ENTRY_DEG
    const regenerateProgress = showRegenerateFeedback
        ? Math.min(1, Math.abs(cumulativeRotation) / REGENERATE_THRESHOLD_DEG)
        : 0
    const regenerateMessage = (() => {
        if (!showRegenerateFeedback) return null
        const abs = Math.abs(cumulativeRotation)
        if (cumulativeRotation >= REGENERATE_THRESHOLD_DEG) return "離すと再構築"
        if (cumulativeRotation <= -REGENERATE_THRESHOLD_DEG) return "離すと全件再構築"
        const remainingTurns = Math.ceil((REGENERATE_THRESHOLD_DEG - abs) / 360)
        return cumulativeRotation > 0
            ? `あと${remainingTurns}周で再構築`
            : `あと${remainingTurns}周で全件再構築`
    })()

    return (
        <div
            className="h-dvh min-h-0 flex flex-col items-center justify-between [@media(max-height:780px)]:justify-start p-4 pb-20 sm:p-6 sm:pb-8 [@media(max-height:780px)]:pb-6 overflow-hidden transition-all duration-1000 ease-in-out relative z-10"
            style={{ background: backgroundStyle }}
        >
            <WeatherAnimation />

            <WeatherMoodTuningPanel
                isOpen={openPanel === "mood" && !isLoading}
                onOpen={() => setOpenPanel("mood")}
                onClose={() => setOpenPanel(null)}
                hideToggleButton={openPanel === "genre" || isLoading}
            />

            {openPanel !== "mood" && !isLoading && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleSettings}
                    disabled={openPanel === "genre" && selectedGenres.length === 0}
                    className={`
                      fixed bottom-12 right-4 z-50 size-[3.1rem] rounded-[1.2rem] bg-background/80 backdrop-blur-sm
                      [&_svg]:size-6
                      ${openPanel === "genre"
                        ? isOverlayThemeDark
                          ? "bg-white/15 text-white border-white/40 hover:bg-white/25 hover:text-white"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                        : isOverlayThemeDark
                          ? "hover:bg-white/10 hover:text-white/90 hover:border-white/40"
                          : "hover:bg-background hover:text-foreground hover:border-border"
                      }
                    `}
                    aria-label={openPanel === "genre" && selectedGenres.length === 0 ? "1つ以上ジャンルを選択すると閉じられます" : openPanel === "genre" ? "設定パネルを閉じる" : "設定パネルを開く"}
                >
                    <Settings className="size-6" />
                </Button>
            )}

            {openPanel === "genre" && !isLoading && (
                <div className="fixed bottom-26 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
                    <SettingsPanel isUnauthenticated={isUnauthenticated} />
                </div>
            )}

            <div className="shrink-0 w-full flex justify-center">
                <WeatherMonitor />
            </div>

            {/* Vinyl Record Section */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full max-w-md relative z-10 py-2 [@media(max-height:780px)]:py-1 [@media(max-height:780px)]:flex-none record-section-gap">
                <div
                    className={`text-center space-y-0.5 shrink-0 h-14 ${isLoading || openPanel === "mood" || openPanel === "genre" ? "invisible" : ""}`}
                    aria-hidden={isLoading || openPanel === "mood" || openPanel === "genre"}
                >
                    <p className={`text-[10px] font-light whitespace-nowrap flex items-center justify-center gap-1 ${isCanvasBackgroundDark ? "text-white/80" : "text-muted-foreground/70"}`}>
                        {selectedGenres.length <= 1 ? (
                            <>
                                <Music className="w-3 h-3 shrink-0" aria-hidden />
                                お気に入りのジャンルを追加
                            </>
                        ) : (
                            "左右にスピンして他のプレイリストへ"
                        )}
                    </p>
                    <p className={`text-[9px] font-light whitespace-nowrap ${isCanvasBackgroundDark ? "text-white/60" : "text-muted-foreground/50"}`}>
                        {selectedGenres.length === 0
                            ? "1つ以上選択するとスピンで再構築できます"
                            : selectedGenres.length === 1
                                ? "右3周でプレイリストを再構築"
                                : "右3周でプレイリストを再構築・左3周で一括再構築"}
                    </p>
                    {isMoodTuningApplied && (
                        <p className="text-center">
                            <span className="text-base font-semibold text-rainbow whitespace-nowrap">Mood Tuning</span>
                        </p>
                    )}
                </div>

                <div className="flex flex-col items-center shrink-0">
                <div
                    className="relative w-[min(18rem,42vh)] h-[min(18rem,42vh)] [@media(max-height:780px)]:w-[min(15rem,36vh)] [@media(max-height:780px)]:h-[min(15rem,36vh)] rounded-full transition-shadow duration-200 shrink-0"
                    style={
                        showRegenerateFeedback
                            ? {
                                boxShadow: `0 0 ${29 + regenerateProgress * 58}px ${vinylColors.accentColor}90, 0 0 ${14 + regenerateProgress * 29}px ${vinylColors.accentColor}60`,
                            }
                            : undefined
                    }
                >
                    <div className="absolute inset-0 rounded-full shadow-2xl pointer-events-none" />

                    <div
                        ref={vinylRef}
                        className={`relative w-full h-full select-none touch-none ${isLoading || openPanel === "mood" || openPanel === "genre" ? "pointer-events-none cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: isDragging
                                ? "none"
                                : snapBackDurationMs != null
                                    ? `transform ${snapBackDurationMs}ms cubic-bezier(0.6, 0, 1, 1)`
                                    : "none",
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                    >
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                            <div className={`absolute inset-0 bg-linear-to-br ${vinylColors.vinylColor} opacity-92`} />
                            {[...Array(20)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute inset-0 rounded-full border border-white/5"
                                    style={{ transform: `scale(${1 - i * 0.04})` }}
                                />
                            ))}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-[33%] h-[33%] min-w-12 min-h-12 max-w-24 max-h-24 rounded-full bg-card shadow-xl flex items-center justify-center overflow-hidden">
                                    {isLoadingOrEmpty ? (
                                        <div className="w-[83%] h-[83%] rounded-full bg-muted/50 animate-pulse" />
                                    ) : (
                                        <img
                                            src={getImageUrl(currentPlaylist.imageUrl)}
                                            alt={currentPlaylist.title}
                                            className="w-full h-full rounded-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.src = "/placeholder.svg"
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-background shadow-inner" />
                            </div>
                        </div>
                    </div>

                    {noteEffectEnabled && openPanel === null && !isLoading && (
                        <FloatingNoteEffect
                            accentColor={vinylColors.accentColor}
                            isDarkText={isCanvasBackgroundDark}
                        />
                    )}

                    {tonearmVisible && (
                        <div
                            className="absolute inset-0 pointer-events-none overflow-visible"
                            aria-hidden
                            style={{ left: "57.06%", top: "-1.40%", width: "73.78%", height: "81.33%" }}
                        >
                            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 332 366" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                                <defs>
                                    <filter id="tonearm-pivot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="black" floodOpacity="0.35" />
                                    </filter>
                                </defs>
                                <circle cx="221.897" cy="63.7868" r="25" transform="rotate(-17.9996 221.897 63.7868)" fill={vinylColors.accentColor} filter="url(#tonearm-pivot-shadow)" />
                                <path d="M225.05 27.1963C225.797 24.1904 228.812 22.3346 231.832 23.021C234.902 23.7187 236.822 26.7769 236.116 29.8449L195.908 204.559C195.57 206.024 194.907 207.395 193.967 208.568L122.532 297.749C119.718 301.261 114.317 301.079 111.747 297.384C110.053 294.95 110.151 291.694 111.988 289.366L180.56 202.477C181.44 201.362 182.072 200.073 182.415 198.694L225.05 27.1963Z" fill="#D9D9D9" />
                                <path d="M104.424 330.4C102.784 332.775 99.4779 333.272 97.212 331.483L86.403 322.949C84.2033 321.213 83.8604 318.008 85.6428 315.845L116.761 278.088C118.499 275.979 121.609 275.656 123.743 277.364L131.256 283.374C133.306 285.014 133.739 287.96 132.247 290.12L104.424 330.4Z" fill={REALISTIC_VINYL_THEME.accentColor} />
                                <circle cx="140.805" cy="321.355" r="4.47665" transform="rotate(-56.8972 140.805 321.355)" fill={REALISTIC_VINYL_THEME.accentColor} />
                                <rect width="8.9533" height="25.5809" transform="translate(116.395 310.786) rotate(-56.8972)" fill={REALISTIC_VINYL_THEME.accentColor} />
                                <path d="M221.045 11.7671C221.513 9.02436 224.13 7.19152 226.868 7.68925L238.712 9.8427C241.53 10.355 243.342 13.125 242.683 15.9122L231.692 62.4163C231.212 64.4431 229.527 65.9607 227.461 66.2256L218.097 67.4262C214.764 67.8535 211.967 64.9374 212.532 61.6253L221.045 11.7671Z" fill={REALISTIC_VINYL_THEME.accentColor} />
                            </svg>
                        </div>
                    )}
                </div>

                <div
                    className={`mt-1.5 -mb-0.5 min-h-4 flex items-center justify-center w-full text-center shrink-0 transition-opacity duration-150 leading-none ${regenerateMessage ? "" : "invisible"}`}
                    style={regenerateMessage ? { opacity: 0.7 + regenerateProgress * 0.3 } : undefined}
                    aria-hidden={!regenerateMessage}
                >
                    <span className={`text-xs font-medium whitespace-nowrap ${isCanvasBackgroundDark ? "text-white/90" : "text-foreground/90"}`}>
                        {regenerateMessage ?? "\u00A0"}
                    </span>
                </div>
                </div>

                {/* Indicator dots */}
                <div className="flex gap-1.5 shrink-0">
                    {displayPlaylists.map((item, i) => {
                        const colors = (useRealisticVinyl && i === safeCurrentIndex) ? REALISTIC_VINYL_THEME : getGenreThemeColors(item.genre)
                        const isActive = i === safeCurrentIndex
                        const inactiveCount = Math.max(1, displayPlaylists.length - 1)
                        const inactiveIndex = i < safeCurrentIndex ? i : i - 1
                        const rainbowSliceStyle =
                          isMoodTuningApplied && !isActive
                            ? {
                                background: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #ec4899, #ef4444)",
                                backgroundSize: `${inactiveCount * 100}% 100%`,
                                backgroundPosition: `${-inactiveIndex * 100}% 0`,
                              }
                            : undefined
                        return (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? "w-6" : isMoodTuningApplied ? "" : "bg-border"}`}
                            style={isActive ? { backgroundColor: colors.accentColor } : rainbowSliceStyle}
                          />
                        )
                    })}
                </div>
            </div>

            {/* Playlist Info Section */}
            <div className="w-full max-w-md shrink-0 mt-5 sm:mt-6 [@media(max-height:780px)]:mt-3 space-y-4 sm:space-y-6 [@media(max-height:780px)]:space-y-3 pb-4 [@media(max-height:780px)]:pb-2 relative z-10">
                <div className="text-center space-y-2 sm:space-y-3">
                    <p className={`text-[10px] sm:text-xs uppercase tracking-widest font-light ${genreColorClass}`}>
                        {isLoadingOrEmpty ? LOADING_GENRE_TEXT : currentPlaylist.genre}
                    </p>
                    <h2 className={`text-xl sm:text-2xl font-serif leading-tight text-balance ${isMoodTuningApplied ? "text-rainbow" : titleColorClass}`}>
                        {isLoadingOrEmpty ? getLoadingTitleText(loadingMode) : currentPlaylist.title}
                    </h2>
                </div>

                <div className="flex items-center justify-center">
                    <div className={`p-[2px] rounded-lg shrink-0 w-[calc(6rem+4px)] h-[calc(6rem+4px)] sm:w-[calc(8rem+4px)] sm:h-[calc(8rem+4px)] ${isMoodTuningApplied ? "bg-rainbow" : ""}`}>
                        {isLoadingOrEmpty ? (
                            <div className={`w-24 h-24 sm:w-32 sm:h-32 bg-muted/50 animate-pulse flex items-center justify-center ${isMoodTuningApplied ? "rounded-[calc(1rem-2px)]" : "rounded-lg"}`}>
                                <Music className={`w-6 h-6 sm:w-8 sm:h-8 ${isCanvasBackgroundDark ? "text-white/30" : "text-muted-foreground/30"}`} />
                            </div>
                        ) : (
                            <img
                                src={getImageUrl(currentPlaylist.imageUrl)}
                                alt={currentPlaylist.title}
                                className={`w-24 h-24 sm:w-32 sm:h-32 shadow-lg object-cover ${isMoodTuningApplied ? "rounded-[calc(1rem-2px)]" : "rounded-lg"}`}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/placeholder.svg"
                                }}
                            />
                        )}
                    </div>
                </div>

                {(() => {
                    const needsSpotifyLogin = isUnauthenticated
                    const spotifyDisabled = isLoadingOrEmpty || isSaving || currentPlaylist.trackUris.length === 0
                    const disabledReason = needsSpotifyLogin
                        ? "Spotify機能はログインすると利用できます"
                        : isSaving
                            ? null
                            : isLoadingOrEmpty
                              ? "プレイリストを読み込み中です"
                              : currentPlaylist.trackUris.length === 0
                                ? "再生できる曲を取得できませんでした。しばらく経ってからお試しください。"
                                : null
                    const buttonLabel = needsSpotifyLogin
                        ? "Spotifyでログインして再生"
                        : isSaving ? "保存中..." : "Spotifyで再生"
                    return (
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                onClick={handleSaveToSpotify}
                                disabled={!needsSpotifyLogin && spotifyDisabled}
                                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold rounded-full px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <SpotifyIcon />
                                )}
                                {buttonLabel}
                            </Button>
                            {disabledReason && (
                                <p className="text-xs text-white/60 text-center max-w-[240px]" role="status">
                                    {disabledReason}
                                </p>
                            )}
                            {saveError && (
                                <p className="text-xs text-red-400">{saveError}</p>
                            )}
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
