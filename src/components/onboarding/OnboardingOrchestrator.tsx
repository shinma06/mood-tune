"use client"

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react"
import {
  AVAILABLE_GENRES,
  AUTH_CHOICE_STORAGE_KEY,
  DEFAULT_SELECTED_GENRES,
  ONBOARDING_COMPLETED_KEY,
  GENRE_STORAGE_KEY,
  LOGIN_MODAL_SESSION_SUPPRESSED_KEY,
  type AuthChoice,
  type Genre,
} from "@/lib/constants"
import LoginModal from "./LoginModal"
import TutorialModal from "./TutorialModal"
import GenreSelectModal from "./GenreSelectModal"

type ModalType = "login" | "genre-select" | "tutorial" | null

function isDefaultGenres(genres: Genre[]): boolean {
  if (genres.length === 0) return true
  if (genres.length !== DEFAULT_SELECTED_GENRES.length) return false
  const defaultSet = new Set<Genre>(DEFAULT_SELECTED_GENRES)
  return genres.every((g) => defaultSet.has(g))
}

/** LocalStorage からジャンルを読み込み、AVAILABLE_GENRES で照合してサニタイズ */
function readGenresFromStorage(): Genre[] {
  try {
    const raw = localStorage.getItem(GENRE_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is Genre =>
      typeof v === "string" && AVAILABLE_GENRES.includes(v as Genre)
    )
  } catch {
    return []
  }
}

/** フロー: login → genre-select（スキップ不可）→ tutorial（スキップ可）→ null */
function determineInitialModal(isUnauthenticated: boolean): ModalType {
  if (isUnauthenticated) return "login"

  const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true"
  if (completed) return null

  const genres = readGenresFromStorage()
  if (isDefaultGenres(genres)) return "genre-select"

  return "tutorial"
}

interface Props {
  isUnauthenticated: boolean
  loginModalTrigger?: number
  /** 初期化完了時に呼ばれる。needsGenreSelect: ジャンル選択モーダルが必要か */
  onInitialized?: (needsGenreSelect: boolean) => void
  /** ジャンル選択モーダルが完了したときに呼ばれる */
  onGenreSelectDone?: () => void
}

function readAuthChoice(): AuthChoice {
  try {
    const raw = localStorage.getItem(AUTH_CHOICE_STORAGE_KEY)
    return raw === "guest" ? "guest" : "undecided"
  } catch {
    return "undecided"
  }
}

function isLoginModalSuppressedInSession(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_MODAL_SESSION_SUPPRESSED_KEY) === "true"
  } catch {
    return false
  }
}

function subscribeToClient() {
  return () => {}
}

export default function OnboardingOrchestrator(props: Props) {
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false)
  return isClient ? <OnboardingFlow key={String(props.isUnauthenticated)} {...props} /> : null
}

function OnboardingFlow({
  isUnauthenticated,
  loginModalTrigger = 0,
  onInitialized,
  onGenreSelectDone,
}: Props) {
  const [initialModal] = useState<ModalType>(() => {
    const shouldShowLoginFirst =
      isUnauthenticated &&
      !isLoginModalSuppressedInSession() &&
      readAuthChoice() !== "guest"
    return shouldShowLoginFirst ? "login" : determineInitialModal(false)
  })
  const [modal, setModal] = useState(initialModal)
  const [seenLoginTrigger, setSeenLoginTrigger] = useState(0)
  const notifyInitialized = useEffectEvent(() =>
    onInitialized?.(initialModal === "login" || initialModal === "genre-select")
  )

  useEffect(() => {
    notifyInitialized()
  }, [])

  if (loginModalTrigger !== seenLoginTrigger) {
    setSeenLoginTrigger(loginModalTrigger)
    if (isUnauthenticated && loginModalTrigger > 0) setModal("login")
  }

  const handleGenreSelectComplete = () => {
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true"
    setModal(completed ? null : "tutorial")
    onGenreSelectDone?.()
  }

  const handleTutorialComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true")
    setModal(null)
  }

  const handleContinueWithoutLogin = () => {
    try {
      localStorage.setItem(AUTH_CHOICE_STORAGE_KEY, "guest")
      sessionStorage.setItem(LOGIN_MODAL_SESSION_SUPPRESSED_KEY, "true")
    } catch {
      // no-op: storage unavailable environments fallback to current behavior
    }

    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true"
    if (completed) {
      setModal(null)
      onInitialized?.(false)
      return
    }

    const genres = readGenresFromStorage()
    if (isDefaultGenres(genres)) {
      setModal("genre-select")
      onInitialized?.(true)
      return
    }

    setModal("tutorial")
    onInitialized?.(false)
  }

  if (modal === "login") {
    return <LoginModal onContinueWithoutLogin={handleContinueWithoutLogin} />
  }

  if (modal === "genre-select") {
    return <GenreSelectModal onComplete={handleGenreSelectComplete} />
  }

  if (modal === "tutorial") {
    return <TutorialModal onComplete={handleTutorialComplete} />
  }

  return null
}
