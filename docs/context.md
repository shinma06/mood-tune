# コンテキストの置き方

| 内容 | 正本・形式 | 読込条件 |
| --- | --- | --- |
| 常時制約と入口 | AGENTS.md、英語 | セッション開始 |
| Claude入口 | CLAUDE.md → AGENTS.md | Claude読込。独立規約を作らない |
| 作業手順 | `.agents/skills/*/SKILL.md`、英語 | 該当作業時。Claude経路はsymlink |
| Cursor入口 | `.cursor/rules/harness.mdc` | projectで常時適用 |
| プロジェクト事実 | project.md、共有docs、日本語 | 判断に必要な範囲 |
| 作業の進行・受入 | Issue/PR | 開始、再開、レビュー、終了 |
| 全体表示・到達目標 | Project / Milestone、[作業管理](work-management.md) | 作成、triage、引継ぎ、終了 |
| 既存の製品知識・設計判断 | `.cursor/memory/` | 該当する製品変更時。進捗はIssueへ |
| 証拠 | SHA/版/観察者付きの記録 | 該当Case |
| 個人設定・認証・一時状態 | Git管理外 | 初期化・復旧 |

セッション経緯は当該Issueへ残します。文章だけで内部推論保存や自動compactionを保証しません。ファイルの存在、実読込、実行成功は別です。リンク検査は存在だけ、意味・優先順位・client検出はレビューとsmoke testで確認します。

制約を移す際は適用条件、承認範囲、所有権、完了条件、互換性、原証拠を保ちます。個人の専門領域・モデル固有制限は全利用者へ自動適用せず、必要な導入先だけで設定します。
