# Active Context

## 現在の作業管理

進行中の作業・担当・次の操作は [GitHub Issue](https://github.com/shinma06/mood-tune/issues) と [開発マップ](https://github.com/users/shinma06/projects/3) を正本とする。[AGENTS.md](../../AGENTS.md) と [project.md](../../docs/project.md) から共通の作業手順・検証へ進む。
以下はハーネス導入前の製品知識・リファクタリング記録であり、新しい作業の受入を満たした証拠として流用しない。

## これまでの製品整備

プロジェクト全体のリファクタリングを完了。構造と実装の両面から整理し、今後の開発をスムーズにする。

## リファクタリング完了内容

### 共通化・重複排除
- `lib/validators.ts`: バリデーション関数を一元化（isThemePreference, isValidGenreArray 等）
- `lib/overlay-theme.ts`: オーバーレイのダーク/ライトスタイルを `getOverlayStyles()` で共通化
- `components/shared/SpotifyIcon.tsx`: Spotify SVG アイコンを共有コンポーネント化

### コンポーネント分割
- `hooks/usePlaylistManager.ts`: PlaylistExplorer からプレイリスト状態・生成・更新ロジックを抽出（PlaylistExplorer 661行 → 473行）
- `hooks/useSelectedGenres.ts`: GenreSelector 内の `useSelectedGenres` を独立フックに移動
- GenreSelector: 3つの表示モードを1つのコンポーネントに統一
- GenreSelectModal: 重複スタイル定義を `getOverlayStyles` に移行

### API 実装の最新化
- `generateDashboard`: Vercel AI SDK v6 `Output.array()` + zod スキーマに移行（regex JSON 抽出を廃止）
- `mapWithConcurrency`: `lib/utils.ts` に移動し再利用可能に
- `lib/weather-fetch.ts`: Weather Route から fetch ロジックを抽出（route handler 162行 → 52行）
- `findMoodTunePlaylist`: while(true) → for ループに変更、ページネーション安全上限追加

### パフォーマンス最適化
- `WeatherContext`: value オブジェクトを `useMemo` でメモ化し不要な再レンダリングを削減

### 依存関係整理
- 38 の未使用パッケージを削除（26 の @radix-ui コンポーネント、form 関連、chart 関連等）

## 現在の実装状態（要点）

- Next.js 16 / React 19 / TypeScript で App Router 構成
- 未ログイン利用を正式サポート（固定データでプレイリスト表示）
- ログイン時のみ OpenAI 生成 + Spotify Search でトラック URI を解決
- Spotify 認証は PKCE（スコープ: `playlist-read-private`, `playlist-modify-public`, `playlist-modify-private`）、セッションは暗号化クッキー + PKCE 準拠トークンリフレッシュ（client_id in body, no secret）
- Spotify API 呼び出しは共通 `spotifyFetch`（`lib/spotify-server.ts`）を使用。2026年2月改定対応済み（`POST /me/playlists`, `/playlists/{id}/items`）
- Route Handler のクッキー操作は `NextResponse.cookies` に統一（`cookies()` + redirect の不整合を解消）
- 天気は WxTech 優先（日本 1km / 海外 5km）、失敗時 OWM にフォールバック。天気取得は `lib/weather-fetch.ts` を利用
- 都市名は Google Geocoding の逆ジオコーディング（失敗時は OWM 名称）

## UI/UX の確定方針

- `SettingsPanel` は一覧（menu）→ 詳細（Select Genre / Appearance / Playback）構成
- Select Genre は最大 4 件。パネル閉じ時に追加ジャンル分のみ再生成
- Mood Tuning は即時プレビュー、閉じ時に変更があれば全件再生成
- レコード操作は 45° でページング、右 3 周で単体再生成、左 3 周で全件再生成
- 非ログイン時の保存導線は「Spotifyでログインして再生」
- Onboarding のチュートリアルモーダルはモバイルで `80dvh` を基準にし、メディアは `object-cover` でトリミング表示して余白を抑える

## データフローの単一ソース

- `WeatherContext` が `effectiveWeather` / `effectiveTimeOfDay` / `displayHour` を提供
- 視認性判定は `isCanvasBackgroundDark`（天気×時間帯）を使用
- オーバーレイテーマは `themePreference` と `isOverlayThemeDark` で独立管理
- プレイリスト管理は `usePlaylistManager` フックに集約

## 直近で注意すること

- `themePreference` と `isCanvasBackgroundDark` を混同しない
- 既存ロジックの再利用を優先し、重複導出を追加しない
- 新しいオーバーレイコンポーネントは `getOverlayStyles()` を使う
- バリデーション追加時は `lib/validators.ts` に集約する

## 参照先

- アーキテクチャと連携: `.cursor/memory/systemPatterns.md`
- ADR と設計判断: `.cursor/memory/decisionLog.md`
- 実装前チェック: `.cursor/rules/pre-implementation-check.md`
- 複雑化時の整理: `.cursor/rules/refactor-overcomplexity.md`
