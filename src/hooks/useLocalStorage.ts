"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

const STORAGE_CHANGE_EVENT = "local-storage-change"
// 同じページで明示的に保存した値だけ、一時的な全解除などを許可する。
const pageValues = new Map<string, string | null>()

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 同一ページ内での保存を通知。React の state updater 内では呼ばない。 */
export function dispatchStorageChange(key: string) {
  if (typeof window === "undefined") return
  pageValues.set(key, readStorage(key))
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }))
  })
}

export interface UseLocalStorageOptions<T> {
  /** 初回読み込み・他タブ変更時に検証し、不正な永続値を initialValue に修復する。 */
  validate?: (value: unknown) => value is T
}

/** localStorage の購読。SSR/初回は initialValue と未初期化状態を返す。 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const validate = options?.validate
  const getSnapshot = useCallback(() => readStorage(key), [key])
  const parseValue = useCallback((raw: string | null | undefined): T => {
    if (raw == null) return initialValue
    try {
      const value: unknown = JSON.parse(raw)
      if (validate && !validate(value) && pageValues.get(key) !== raw) return initialValue
      return value as T
    } catch {
      return initialValue
    }
  }, [key, initialValue, validate])

  const subscribe = useCallback((onChange: () => void) => {
    const repair = () => {
      const raw = getSnapshot()
      if (raw === null || pageValues.get(key) === raw || parseValue(raw) !== initialValue) return
      const fallback = JSON.stringify(initialValue)
      if (raw === fallback) return
      try {
        window.localStorage.setItem(key, fallback)
        dispatchStorageChange(key)
      } catch {
        // 保存不可でも表示は検証済みの初期値へフォールバックする。
      }
    }
    const handleLocalChange = (event: Event) => {
      if ((event as CustomEvent<{ key: string }>).detail?.key === key) onChange()
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return
      pageValues.delete(key)
      repair()
      onChange()
    }
    window.addEventListener(STORAGE_CHANGE_EVENT, handleLocalChange)
    window.addEventListener("storage", handleStorageChange)
    repair()
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, handleLocalChange)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [key, initialValue, getSnapshot, parseValue])

  const raw = useSyncExternalStore(subscribe, getSnapshot, () => undefined)
  const storedValue = useMemo(() => parseValue(raw), [raw, parseValue])
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const next = value instanceof Function ? value(parseValue(getSnapshot())) : value
      window.localStorage.setItem(key, JSON.stringify(next))
      dispatchStorageChange(key)
    } catch (error) {
      console.warn(`localStorage への保存に失敗しました (key: ${key}):`, error)
    }
  }, [key, getSnapshot, parseValue])

  return [storedValue, setValue, raw !== undefined]
}
