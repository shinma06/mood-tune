# Issue・Project・Milestone の管理

[MoodTune 開発マップ](https://github.com/users/shinma06/projects/3)を過去・現在・次の作業の入口にする。具体的な受入・担当・判断は Issue/PR、到達目標は Milestone、実際の分解と依存は GitHub の native Relationship を正本とする。

## 作成・着手

変更は単一の目的を持つ Issue にし、重複・関連 PR・既存 claim を確認する。分類だけの親 Issue は作らない。

| 軸 | 値 | 題名・用途 |
| --- | --- | --- |
| type | feature / bug / research / qa / maintenance / tracking | `[機能]` / `[修正]` / `[調査]` / `[試験] #元Issue` / `[運用]` / `[追跡]` |
| priority | P0 / P1 / P2 | 最優先 / 高 / 通常。題名には重ねない |
| status | ready / in-progress / review / blocked / deferred / done | 着手候補 / 実施中 / レビュー / 依存・環境待ち / 保留 / 完了 |

各軸のラベルをちょうど 1 つ付ける。closed は `status:done`、open はそれ以外。既存の標準ラベルを削除せず、必要なら補助として併用する。

作成・triage 時に全 Issue を Project に登録し、到達条件が合う Milestone を選ぶ。適合する目標が未決なら理由・判断担当・次の条件を記す。架空のリリース日を割り当てない。
実際の分解は parent/sub-issue、着手・完了に必要な別作業は blocked by/blocking を設定し、両端を取得して確認する。単なる関連・推奨順は依存にしない。

Project の `Relationship Status` は判定済みの `Standalone` / `Has Relationship` のみ。空欄は未判定であり、Standalone と推定しない。Priority は既存ラベルを表示し、別の値を二重管理しない。

## 表示と更新

| View | 対象 |
| --- | --- |
| Now — 進行中 | open / in-progress・review。tracking と QA を除く |
| Next — 着手候補 | open / ready。tracking と QA を除く |
| Later — 依存待ち・保留 | open / blocked・deferred。tracking と QA を除く |
| Past — 完了履歴 | closed |
| QA — 動作確認 | open / type:qa |
| 全体 — 全Issue | 親・子・QA を含む全件 |

Project Status は ready/blocked/deferred → Todo、in-progress/review → In Progress、closed/done → Done。
ラベル・open/closed は Issue の値、登録・Status・Relationship Status は更新後に読み戻す。Project 表示の更新と受入達成は別であり、PR が merged になっただけで Done にしない。

開始・scope 変更・レビュー待ち・blocked・引継ぎ・終了時に、Issue の owner、HEAD/base、次の操作を先に更新する。主要な計画変更では Project 概要の Past/Now/Next/Later も合わせる。同期失敗は対象・担当・再試行条件を Issue に記録する。

## 終了・QA・監査

main 一本の運用なので、必要な機能・GUI 受入は統合前に完了する。後続の任意改善と、今回の必須受入を混同しない。
実装・調査とは別に QA が必要な場合は、有限の QA Issue を作り、元 Issue と双方からリンクし、前提・手順・期待・対象 SHA/build・証拠・担当・再開条件を残す。実際の分解なら native sub-issue に設定する。子 PR だけで親や QA を閉じない。

終了時は Issue の受入、PR/merge/CI、親の現在表示、Project の登録・状態、Milestone と native 関係を対象範囲で確認する。Milestone は全到達条件が満たされたときだけ完了にする。ブランチ/worktree の cleanup は別に確認する。
大きな運用変更、Milestone 完了、実際の表示不整合を契機に必要範囲を監査する。全件監査・重複台帳を毎 PR に追加しない。
