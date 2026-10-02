# MoodTune のプロジェクト情報

| 項目 | 正本・現在の値 |
| --- | --- |
| 目的・機能 | [README](../README.md)、[製品要件](../.cursor/memory/projectBrief.md)。天気・時間帯に合うプレイリスト探索 |
| 技術 | Next.js 16.0.10 / React 19.2 / TypeScript / Tailwind CSS 4 / Spotify PKCE |
| runtime | Node.js 22（`.node-version`、CI）、npm、ハーネスは Python 3.11 以上。GUI lease は macOS/Linux |
| 統合先 | `main`。既存 `feature/*` は他の作業として保全し、新しい変更は `codex\|claude\|cursor\|agent/<Issue>-<slug>` |
| 作業管理 | [開発マップ](https://github.com/users/shinma06/projects/3)、[Issue](https://github.com/shinma06/mood-tune/issues)、[Milestone](https://github.com/shinma06/mood-tune/milestones) |
| 設計 | [systemPatterns](../.cursor/memory/systemPatterns.md)、[decisionLog](../.cursor/memory/decisionLog.md)。全文を新たに複製しない |
| ソース配置 | `src/app/`（ページ・API・Server Actions）、`src/components/`、`src/contexts/`、`src/hooks/`、`src/lib/`、`src/types/` |
| 開発 URL | `http://127.0.0.1:3000`。Spotify の Redirect URI と origin/port を合わせる |
| CI・完了 | [検証と受入](verification/README.md)。CI・独立レビュー・該当受入の成功後に通常 PR で統合 |
| リリース | main 統合と本番反映は別。自動デプロイの有無・本番の設定は今回未確認。公開操作は依頼範囲に従う |

## セットアップと実行

```bash
npm ci
python3 scripts/bootstrap.py
npm run dev
```

非ログインの固定プレイリストは API キーなしで起動できる。天気や認証の実接続は別途設定・確認する。
環境変数の用途は [README](../README.md#環境変数) を参照する。現在の PKCE 実装は `AUTH_SPOTIFY_SECRET` を参照しない。

| 変更対象 | 実行する検証 |
| --- | --- |
| 指示・文書・Python・Git hooks・GitHub 設定 | `npm run check`（新規ファイルも検査） |
| TypeScript・React・依存関係・アプリ設定 | `npm run lint`、`npm run typecheck`、`npm run test:state`、`npm run build` |
| UI・認証・外部 API | 上記と、Issue に記載した再現手順・期待結果・対象 SHA の実操作 |
| 本番ビルド | `npm run build`。`next/font/google` が Google Fonts を取得するためネットワークが必要 |

`test:state` は既存の Node.js・TypeScript・React で、保存値の検証と同期、SSR、生成の待機・重複要求を確認する。ブラウザーの Effect・操作・描画や外部APIまで検証するものではなく、変更した経路は別途 GUI で確認する。
既存 lint エラー38件は [Issue #23](https://github.com/shinma06/mood-tune/issues/23) の修正で除去し、`eslint-suppressions.json` は空。`npm run lint:full` は空の抑制ファイルで全件を検査する。抑制の追加・全件再生成で失敗を隠さない。

残る `@next/next/no-img-element` 警告3件は、次の既存表示を維持するため保留する。ルールは無効化しない。

- `PlaylistExplorer` の2件: 外部プレイリスト画像の直接表示と `onError` のプレースホルダー切替を維持する。画像プロキシ・配信元許可設定の変更はこの lint 修正には含めない。
- `TutorialMediaPlaceholder` の1件: ローカル画像の既存の表示枠と、画像・動画を切り替える構成を維持する。画像最適化は読み込み性能を評価する変更で扱う。

## 安定した製品条件

- 未ログイン時は固定データ、ログイン時は OpenAI 生成と Spotify Search、保存は MoodTune のプレイリスト 1 本。
- 天気は WxTech 優先・OpenWeatherMap フォールバック、都市名は Google Geocoding と OWM。既存の入力検証・失敗時の処理を維持。
- `WeatherContext` が表示値を提供し、`isCanvasBackgroundDark` と `isOverlayThemeDark` を分離。
- ジャンル選択は最大 4 件。閉じるときは追加分だけ生成、Mood Tuning の変更では全件生成。
- オンボーディング、localStorage 修復、非同期更新・キャンセル、hydration と認証クッキーに影響する変更は該当経路を確認。

導入元・導入状態・参照先との差は [ハーネス導入記録](harness-adoption.md) に記載する。
