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
| TypeScript・React・依存関係・アプリ設定 | `npm run lint`、`npm run typecheck`、`npm run build` |
| UI・認証・外部 API | 上記と、Issue に記載した再現手順・期待結果・対象 SHA の実操作 |
| 本番ビルド | `npm run build`。`next/font/google` が Google Fonts を取得するためネットワークが必要 |

アプリの unit/E2E テストスイートはまだない。`test` CI は lint・型チェック・本番ビルドであり、製品の全機能テストや GUI 合格を意味しない。
既存 lint エラーは ESLint 標準の `eslint-suppressions.json` で記録し、[Issue #23](https://github.com/shinma06/mood-tune/issues/23) で解消を追跡する。通常 lint は追加エラーを拒否し、`npm run lint:full` は空の抑制ファイルで既存分も含めて表示する。抑制の追加・全件再生成で失敗を隠さず、修正後は `npm run lint -- --prune-suppressions` で不要分を除く。

## 安定した製品条件

- 未ログイン時は固定データ、ログイン時は OpenAI 生成と Spotify Search、保存は MoodTune のプレイリスト 1 本。
- 天気は WxTech 優先・OpenWeatherMap フォールバック、都市名は Google Geocoding と OWM。既存の入力検証・失敗時の処理を維持。
- `WeatherContext` が表示値を提供し、`isCanvasBackgroundDark` と `isOverlayThemeDark` を分離。
- ジャンル選択は最大 4 件。閉じるときは追加分だけ生成、Mood Tuning の変更では全件生成。
- オンボーディング、localStorage 修復、非同期更新・キャンセル、hydration と認証クッキーに影響する変更は該当経路を確認。

導入元・導入状態・参照先との差は [ハーネス導入記録](harness-adoption.md) に記載する。
