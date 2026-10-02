# Contributing to MoodTune

MoodTune への貢献ありがとうございます。このドキュメントは、開発環境の準備からプルリクエストまでの流れと、プロジェクトのコーディング規約をまとめたものです。

---

## 開発環境の準備

1. リポジトリをクローンし、依存関係をインストールする
   ```bash
   git clone https://github.com/shinma06/mood-tune.git
   cd mood-tune
   npm ci
   python3 scripts/bootstrap.py
   ```
2. [README.md](./README.md) の「環境変数」に従い `.env.local` を用意する（非ログイン利用のみなら環境変数なしで起動可能です）
3. `npm run dev` で開発サーバーを起動し、動作を確認する

---

## 貢献の流れ

1. [作業管理](docs/work-management.md)に従って具体的な Issue を確認し、Project・Milestone・native 関係と担当 claim を記録する
2. `origin/main` から `codex/<Issue>-<slug>`（または claude/cursor/agent）の専用 branch/worktree を作る。既存の他担当の `feature/*` は保全する
3. [project.md](docs/project.md)の変更対象別チェックと、必要な GUI 受入を実行する
4. 最初の意味ある push で Draft PR を作り、[PR テンプレート](.github/pull_request_template.md)と Issue ごとの受入 JSON を記入する
5. 別セッションの固定 HEAD/base レビューを受け、[5つの必須 check](docs/verification/README.md)と受入を確認して通常 PR で squash merge する
6. Issue・Project・Milestone・native 関係と、所有 branch/worktree の cleanup を読み戻す。main 統合と本番反映は区別する

詳細と中断・再開は [start-work](.agents/skills/start-work/SKILL.md)、[finish-work](.agents/skills/finish-work/SKILL.md)、[開発フロー](docs/workflow.md)を参照してください。main への直接 push、force push、hooks/protection の迂回は行いません。

---

## コーディング規約

### 技術スタック・方針

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript（明示的な型定義を推奨、`any` は避ける）
- **Styling**: Tailwind CSS を優先。既存の天気アニメーション等の CSS は維持し、UI コンポーネントは既存 shadcn/ui を使う
- **Components**: 関数コンポーネント。デフォルトは Server Component、`useState` 等が必要な場合のみ `'use client'` を使用する

### ディレクトリ・ファイル

- ページ・ルーティング: `src/app/`
- UI コンポーネント: `src/components/`（shadcn は `components/ui/`）
- ビジネスロジック・API クライアント: `src/lib/`
- 型定義: `src/types/`
- カスタムフック: `src/hooks/`
- グローバル状態: `src/contexts/`

### 命名規則

- コンポーネント・ファイル: PascalCase（例: `PlaylistExplorer.tsx`）
- ユーティリティ・設定: kebab-case（例: `weather-utils.ts`）
- 定数: UPPER_SNAKE_CASE
- 関数・変数: camelCase

### 設計の心がけ

- **単一責任**: 1 つの関数・コンポーネントは 1 つの責務に絞る
- **DRY**: 同じロジックは 1 箇所にまとめる（`lib/` のユーティリティや Context を活用）
- **YAGNI**: 今の要件を満たす範囲で実装し、不要な抽象化を避ける
- **決定的なマッピング**: 入力→出力が一意に決まるものは、関数内オブジェクトではなく静的定数で定義する（例: `WEATHER_ICON_MAP`, `BACKGROUNDS`）

新機能・変更前には `.claude/rules/pre-implementation-check.md`（または `.cursor/rules/pre-implementation-check.md`）のチェックリストを参照し、実装後に複雑さを感じた場合は `.claude/rules/refactor-overcomplexity.md`（または `.cursor/rules/refactor-overcomplexity.md`）の手順を検討してください。

---

## 変更時の注意（機能連携）

以下の連携を壊さないよう、変更前に影響範囲を確認してください。

| 役割                                  | 役割の概要                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **WeatherContext**                    | 天気・時間帯・表示用の `effectiveWeather` / `effectiveTimeOfDay` / `isCanvasBackgroundDark` / `isOverlayThemeDark` の単一ソース。`isCanvasBackgroundDark` は天気×表示時間の静的テーブル、`themePreference` は overlay 専用として独立管理 |
| **useLocalStorage (selected-genres)** | ジャンル選択の永続化。空配列は無効として扱い、初回・他タブ時はデフォルトに修復                                             |
| **useSettings**                       | Settings パネル値（`themePreference` / `autoRotationEnabled` / `tonearmVisible` / `noteEffectEnabled` / `moodTuningWeatherDisplay`）の永続化 |
| **PlaylistExplorer**                  | Context とジャンルを統合し、プレイリスト表示・差分更新・全件再生成を担当                                                   |

- 天気・時間帯を表示に使うコンポーネントは、**WeatherContext** から取得した値を使う（ローカルで別計算しない）
- ジャンル一覧は **useLocalStorage** と **constants.ts** の `AVAILABLE_GENRES` / `GENRE_THEME_COLORS` を参照する
- プレイリストの生成・更新は **Server Action**（`generateDashboard`）と **PlaylistExplorer** のフローに沿って行う

---

## リント・ビルド

- ハーネス・文書・設定は `npm run check`、製品・依存関係は `npm run lint` / `npm run typecheck` / `npm run build` を実行する
- lint は既存違反の標準 suppressions を使う。全件は `npm run lint:full` で確認し、新規エラーを隠す抑制追加は行わない。既存修正時は `npm run lint -- --prune-suppressions` で不要分を減らす
- 本番ビルドは Google Fonts の取得にネットワークが必要。API キーなしのビルド成功は Spotify/天気の実接続を保証しない

---

## 質問・相談

- バグ報告や機能要望は GitHub の Issue でお願いします
- 実装の詳細は、リポジトリ内の `.cursor/memory/`（アーキテクチャ・データフロー等）を参照しています。メンテナに質問がある場合は Issue や PR のコメントでどうぞ。
