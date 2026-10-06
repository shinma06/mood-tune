# ハーネス導入記録

導入日: 2026-10-02。管理対象は MoodTune。実行結果と最後の統合状態は [Issue #22](https://github.com/shinma06/mood-tune/issues/22) と関連 PR を正本とする。

## 取り込み元

- [agent-harness-template / e822318](https://github.com/shinma06/agent-harness-template/tree/e822318a6c0fa7175a89687b929197dfae879184): 共通指示、start/finish、Git guard、bootstrap、check/doctor、GUI lease、private registry、環境手順。
- [cursor-in-android-studio / a1e841c](https://github.com/shinma06/cursor-in-android-studio/tree/a1e841ccaeb113687d676536c2d13ae98fe77ef4): Issue/Project/Milestone/native Relationship の責務、3軸ラベル、固定レビュー・受入・引継ぎ・保護設定。

## MoodTune への適合

| 項目 | 対応 |
| --- | --- |
| 指示 | AGENTS を正本、CLAUDE を symlink、Cursor を参照入口に統一。古い Next.js 15 指示と毎回全体リファクタの要求を除去 |
| 製品知識 | 既存 `.cursor/memory/` の要件・設計・履歴を保持し、[project.md](project.md) から必要時に参照 |
| 作業管理 | [専用Project #3](https://github.com/users/shinma06/projects/3)、Issue、到達目標、native関係、Now/Next/Later/Past/QA/全体 |
| branch | 既存 main 運用を維持。参照先の develop/main 昇格、Android/Gradle/ZIP専用部分は移植しない |
| 検証 | template の Python テストに PR/受入/固定レビューの試験を追加。新規・未追跡ファイルも検査 |
| アプリ CI | 不足していた ESLint 依存を補い、lint・型チェック・本番ビルドを接続 |
| 既存 lint 課題 | 初回観測は38 errors / 11 warningsを標準 suppressions で記録。後続の[Issue #23](https://github.com/shinma06/mood-tune/issues/23)で38 errorsと不要な抑制を除去。残る画像警告3件の理由は[project.md](project.md)に記載 |
| gate | trusted main が PR policy / Agent review / Acceptance gate を検査。harness-checks/test と合わせ5 check |
| 所有と秘密 | 別worktree、未解放claim保持、GUI予約・private registryを再利用。個人設定・認証・他projectの状態は移植しない |
| 自動化 | GitHubイベントに対する gate 再評価を導入。元の専用自動fixer/merge engineや定期ジョブは起動しない |

## 検証の境界

参照先と揃えるのは作業の責務・担当・独立レビュー・受入・保護・引継ぎの管理水準であり、製品固有の二段階リリースや専用engineの同一化ではない。
CLI の有無、各クライアントでの実読込、GUI・外部APIの動作は別に確認する。今回の導入だけで全クライアントの新規セッション、Spotify/天気の実接続、本番デプロイ、GUI自動操作を検証済みにはしない。
GitHub ruleset・Project・CI の実適用は Issue/PR の readback 結果を参照する。速度・コスト・token削減効果は未測定。

将来の更新はこの固定refとの差分を専用 Issue/PR で比較し、導入先の規約とプロジェクト事実を保って必要分だけ取り込む。[更新と戻し方](adoption.md)を参照。
