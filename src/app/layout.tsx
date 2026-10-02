import type React from "react"
import type { Metadata, Viewport } from "next"
import { Cormorant_Garamond } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { WeatherProvider } from "@/contexts/WeatherContext"
import { INITIAL_BACKGROUND_GRADIENT } from "@/lib/weather-background-utils"
import "./globals.css"

const _cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: "MoodTune - 天気×時間でプレイリスト提案",
  description: "あなたの今にぴったりな音楽を",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        url: "/icon-dark.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  userScalable: false,
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`font-sans antialiased h-dvh min-h-0 overflow-hidden ${_cormorant.variable}`}
        style={{
          background: INITIAL_BACKGROUND_GRADIENT,
        }}
      >
        <WeatherProvider>
          {children}
          <Analytics />
        </WeatherProvider>
      </body>
    </html>
  )
}
