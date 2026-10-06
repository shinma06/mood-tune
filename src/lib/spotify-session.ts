import crypto from "node:crypto"
import { cookies } from "next/headers"

export const SESSION_COOKIE_NAME = "spotify_session"
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days
const REFRESH_MARGIN_MS = 60_000 // refresh if expires in < 1 min

export interface SpotifySession {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 chars")
  return crypto.createHash("sha256").update(secret).digest()
}

function encrypt(payload: SpotifySession): string {
  const iv = crypto.randomBytes(12)
  const key = getSecret()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, enc]).toString("base64url")
}

function decrypt(value: string): SpotifySession | null {
  try {
    const buf = Buffer.from(value, "base64url")
    if (buf.length < 12 + 16) return null
    const iv = buf.subarray(0, 12)
    const authTag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const key = getSecret()
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)
    const raw = decipher.update(enc) as Buffer
    const rest = decipher.final() as Buffer
    const json = Buffer.concat([raw, rest]).toString("utf8")
    const data = JSON.parse(json) as Record<string, unknown>
    if (
      typeof data.accessToken !== "string" ||
      typeof data.refreshToken !== "string" ||
      typeof data.expiresAt !== "number"
    )
      return null
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    }
  } catch {
    return null
  }
}

/** Refresh access token using PKCE-compatible refresh (client_id in body, no client_secret). */
async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifySession | null> {
  const clientId = process.env.AUTH_SPOTIFY_ID
  if (!clientId) return null
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    })
    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => "")
      console.warn(
        `[Spotify Session] WARN phase=refresh_token_response`,
        JSON.stringify({
          tag: "Spotify Session",
          phase: "refresh_token_response",
          at: new Date().toISOString(),
          message: `HTTP ${res.status}`,
          context: { status: res.status, bodyPreview: bodyPreview.slice(0, 200) },
        })
      )
      return null
    }
    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  } catch (e) {
    console.error("[Spotify Session] refresh token fetch error:", e)
    return null
  }
}

/**
 * Get current session from cookie. If expired, attempt refresh and update cookie.
 */
export async function getSession(): Promise<SpotifySession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!raw) return null
  const session = decrypt(raw)
  if (!session) return null
  if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS) return session
  const refreshed = await refreshSpotifyToken(session.refreshToken)
  if (!refreshed) {
    // Token expired and refresh failed (e.g. revoked) — clear stale cookie and treat as unauthenticated
    try { await clearSessionCookie() } catch { /* RSC context */ }
    return null
  }
  // Cookie can only be set in Server Action or Route Handler; avoid throwing during RSC render.
  try {
    await setSessionCookie(refreshed)
  } catch {
    // Ignore: this request still gets the refreshed session; cookie will be updated on next Route Handler/Server Action.
  }
  return refreshed
}

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
}

/** Build session cookie {name, value, options} for use on NextResponse. */
export function buildSessionCookie(session: SpotifySession) {
  return {
    name: SESSION_COOKIE_NAME,
    value: encrypt(session),
    options: SESSION_COOKIE_OPTIONS,
  } as const
}

/** Set session cookie via cookies() — only works in Server Action / Route Handler. */
export async function setSessionCookie(session: SpotifySession): Promise<void> {
  const cookieStore = await cookies()
  const { name, value, options } = buildSessionCookie(session)
  cookieStore.set(name, value, options)
}

/** Clear session cookie via cookies() — only works in Server Action / Route Handler. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
