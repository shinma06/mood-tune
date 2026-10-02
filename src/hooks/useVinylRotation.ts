import { useState, useRef, useCallback, useEffect } from "react"

/** 3周 = 1080°（右回転で個別再構築の閾値） */
export const REGENERATE_THRESHOLD_DEG = 3 * 360
/** 1周 = 360°（この角度を超えると「個別再構築の域」に入り、3周未満で離したら戻り演出） */
export const REGENERATE_ZONE_ENTRY_DEG = 360
/** 戻り演出の基準時間（1周あたりの目安 ms）。回転量に比例して延長し角速度を一定にする */
const SNAPBACK_DURATION_PER_TURN_MS = 240
/** アイドル時は 1 周 12 秒で回転 */
const IDLE_REVOLUTION_MS = 12_000
const IDLE_ROTATION_DEG_PER_MS = 360 / IDLE_REVOLUTION_MS

interface UseVinylRotationOptions {
  onRotationComplete: (direction: "next" | "prev") => void
  /** 次の/前のプレイリストに切り替える閾値（度） */
  rotationThreshold?: number
  /** ページネーション可能か。false のとき 45°以上で離しても next/prev せず離した角度からアイドル回転を再開する */
  canPaginate?: boolean
  /** 右に3周以上回したときに呼ぶ（現在表示中のジャンルを個別再構築） */
  onRegenerateCurrent?: () => void
  /** 左に3周以上回したときに呼ぶ（全件再構築） */
  onRegenerateAll?: () => void
  /** アイドル時の自動回転を有効にするか */
  idleEnabled?: boolean
}

/**
 * レコード盤の回転操作を管理するカスタムフック
 * - 45°以上で next/prev（canPaginate が true のとき。false なら離した角度からアイドル再開）
* - 右に3周以上で onRegenerateCurrent（個別再構築）
   * - 左に3周以上で onRegenerateAll（全件再構築）
 */
export function useVinylRotation({
  onRotationComplete,
  rotationThreshold = 45,
  canPaginate = true,
  onRegenerateCurrent,
  onRegenerateAll,
  idleEnabled = true,
}: UseVinylRotationOptions) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [startRotation, setStartRotation] = useState(0)
  const [totalRotation, setTotalRotation] = useState(0)
  /** 1ジェスチャー内の累積回転（度）。右プラス・左マイナス。3周フィードバック表示用 */
  const [cumulativeRotation, setCumulativeRotation] = useState(0)
  /** 戻り演出中の transition 時間（ms）。null のときは通常の transition を使用 */
  const [snapBackDurationMs, setSnapBackDurationMs] = useState<number | null>(null)
  const vinylRef = useRef<HTMLDivElement>(null)
  /** 1ジェスチャー内の累積回転（度）。3周検知用 */
  const cumulativeRotationRef = useRef(0)
  /** 前回の接触点の角度（度）。累積計算用 */
  const lastAngleRef = useRef(0)
  /** アイドル時の累積回転（度）。自動回転用 */
  const idleRotationRef = useRef(0)
  /** 前回の rAF 時刻（ms）。アイドル回転の delta 計算用 */
  const lastIdleTimeRef = useRef<number | null>(null)

  /** 2つの角度の最短差を -180〜180 の範囲で返す */
  const getAngleDifference = useCallback((angle1: number, angle2: number): number => {
    let diff = angle2 - angle1
    if (diff > 180) {
      diff -= 360
    } else if (diff < -180) {
      diff += 360
    }
    return diff
  }, [])

  /** 中心から (clientX, clientY) への角度を度で返す（-180〜180） */
  const getAngleFromCenter = useCallback((clientX: number, clientY: number): number => {
    if (!vinylRef.current) return 0
    const rect = vinylRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rad = Math.atan2(clientY - centerY, clientX - centerX)
    return (rad * 180) / Math.PI
  }, [])

  const calculateRotationFromDrag = useCallback(
    (clientX: number, clientY: number): number => {
      return getAngleDifference(getAngleFromCenter(startX, startY), getAngleFromCenter(clientX, clientY))
    },
    [startX, startY, getAngleFromCenter, getAngleDifference]
  )

  const resetRotation = useCallback(() => {
    setRotation(0)
    setStartRotation(0)
    setTotalRotation(0)
    setCumulativeRotation(0)
    cumulativeRotationRef.current = 0
    idleRotationRef.current = 0
  }, [])

  /** 指を離した角度を維持し、その角度からアイドル回転を再開する。releaseAngle は startRotation + cumulativeRotationRef で計算した「離した瞬間の角度」を渡すこと。 */
  const syncIdleToCurrentAndResetGesture = useCallback((releaseAngle: number) => {
    idleRotationRef.current = releaseAngle
    lastIdleTimeRef.current = null
    setTotalRotation(0)
    setCumulativeRotation(0)
    setStartRotation(0)
    cumulativeRotationRef.current = 0
  }, [])

  /** 指定角度から 0° まで、CSS transition（linear）で回した角度分を逆方向に戻す。角速度一定で滑らかに一貫した制御。 */
  const runSnapBackAnimation = useCallback(
    (fromRotationDeg: number) => {
      const durationMs = Math.max(
        200,
        SNAPBACK_DURATION_PER_TURN_MS * (Math.abs(fromRotationDeg) / 360)
      )
      setSnapBackDurationMs(durationMs)
      setRotation(fromRotationDeg)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRotation(0)
        })
      })
    },
    []
  )

  /** アイドル時は 33⅓ RPM で常に回転。ドラッグ・スナップバック中は停止 */
  useEffect(() => {
    if (!idleEnabled || isDragging || snapBackDurationMs !== null) {
      lastIdleTimeRef.current = null
      return
    }
    let rafId: number
    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop)
      if (lastIdleTimeRef.current === null) lastIdleTimeRef.current = now
      const dt = now - lastIdleTimeRef.current
      lastIdleTimeRef.current = now
      idleRotationRef.current += IDLE_ROTATION_DEG_PER_MS * dt
      setRotation(idleRotationRef.current)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [idleEnabled, isDragging, snapBackDurationMs])

  /** 戻り演出の transitionend で状態をクリア */
  useEffect(() => {
    if (snapBackDurationMs === null || !vinylRef.current) return
    const el = vinylRef.current
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return
      setSnapBackDurationMs(null)
      resetRotation()
    }
    el.addEventListener("transitionend", onTransitionEnd)
    return () => el.removeEventListener("transitionend", onTransitionEnd)
  }, [snapBackDurationMs, resetRotation])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const cumulative = cumulativeRotationRef.current
    const rotationDiff = totalRotation

    if (onRegenerateCurrent && cumulative >= REGENERATE_THRESHOLD_DEG) {
      onRegenerateCurrent()
      resetRotation()
      return
    }
    if (onRegenerateAll && cumulative <= -REGENERATE_THRESHOLD_DEG) {
      onRegenerateAll()
      resetRotation()
      return
    }
    // 個別再構築の域（1周超）に入っているが3周未満で離した → 回した角度分を逆方向に戻す演出（左右どちらも）
    const absCumulative = Math.abs(cumulative)
    if (
      absCumulative > REGENERATE_ZONE_ENTRY_DEG &&
      absCumulative < REGENERATE_THRESHOLD_DEG
    ) {
      runSnapBackAnimation(rotation)
      return
    }
    const releaseAngle = startRotation + cumulativeRotationRef.current
    if (rotationDiff >= rotationThreshold) {
      if (canPaginate) {
        onRotationComplete("next")
        resetRotation()
      } else {
        syncIdleToCurrentAndResetGesture(releaseAngle)
      }
    } else if (rotationDiff <= -rotationThreshold) {
      if (canPaginate) {
        onRotationComplete("prev")
        resetRotation()
      } else {
        syncIdleToCurrentAndResetGesture(releaseAngle)
      }
    } else {
      // 指を離した瞬間の角度（ref で同期的に取得）からアイドル回転を再開。state の rotation は非同期で古い可能性があるため使わない
      syncIdleToCurrentAndResetGesture(releaseAngle)
    }
  }, [
    isDragging,
    rotation,
    startRotation,
    totalRotation,
    rotationThreshold,
    canPaginate,
    onRotationComplete,
    onRegenerateCurrent,
    onRegenerateAll,
    resetRotation,
    runSnapBackAnimation,
    syncIdleToCurrentAndResetGesture,
  ])

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (snapBackDurationMs !== null) {
        setSnapBackDurationMs(null)
        resetRotation()
      }
      setIsDragging(true)
      setStartX(clientX)
      setStartY(clientY)
      setStartRotation(rotation)
      setTotalRotation(0)
      setCumulativeRotation(0)
      cumulativeRotationRef.current = 0
      lastAngleRef.current = getAngleFromCenter(clientX, clientY)
    },
    [rotation, snapBackDurationMs, getAngleFromCenter, resetRotation]
  )

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return
      const angleDiff = calculateRotationFromDrag(clientX, clientY)
      const currentAngle = getAngleFromCenter(clientX, clientY)
      const delta = getAngleDifference(lastAngleRef.current, currentAngle)
      cumulativeRotationRef.current += delta
      lastAngleRef.current = currentAngle
      setCumulativeRotation(cumulativeRotationRef.current)
      // 表示は累積回転で更新（何周しても正しく追従し、戻り演出で「回した角度分」逆回転できる）
      setRotation(startRotation + cumulativeRotationRef.current)
      setTotalRotation(angleDiff)
    },
    [isDragging, startRotation, calculateRotationFromDrag, getAngleFromCenter, getAngleDifference]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY)
    },
    [handleStart]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientX, e.touches[0].clientY)
    },
    [handleStart]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    },
    [handleMove]
  )

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleTouchEnd()
      }
    }
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY)
      }
    }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    window.addEventListener("mousemove", handleGlobalMouseMove)
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp)
      window.removeEventListener("mousemove", handleGlobalMouseMove)
    }
  }, [isDragging, handleMove, handleTouchEnd])

  return {
    rotation,
    isDragging,
    cumulativeRotation,
    snapBackDurationMs,
    vinylRef,
    handleMouseDown,
    handleMouseUp: handleTouchEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
