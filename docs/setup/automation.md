# PR自動進行・scheduled taskのセットアップ

## 同梱するものと元環境との差

元環境にはtrusted mainの専用coordinator、read-only reviewer / 限定fixer、private registry、受入gate、QA引継ぎ、成果物配布cleanupがありました。repository、Issue形式、製品Case JSON、develop/main、配布物へ深く結合しています。

本templateは共通の所有・停止・固定revisionレビュー・受入・引継ぎ・cleanup手順を[coordinator依頼文](../../prompts/coordinator.md)に抽出しました。実行可能なGit guard / GUI lease / private registryは付属しますが、専用engineや自動fixerを汎用化したものではありません。エージェントの通常toolsで進める運用が基準です。単なるpromptの配布で自動処理が起動したとは扱いません。

MoodTune では GitHub の PR/Issue/レビュー記録の変更時に [policy workflow](../../.github/workflows/policy.yml) が gate を再判定します。これは検査の自動化であり、レビュー本文の生成、自動修正、自動merge、Project表示同期を行うものではありません。現行 main 運用・完了条件は [プロジェクト情報](../project.md) と [受入手順](../verification/README.md) を優先します。

## 最初は単発実行

1. 開始済みIssue/PR、停止済みwriter、scope、HEAD/base、必要checks、受入、次のownerを明示します。
2. ユーザーが許可した独立top-levelセッションをcoordinatorに指定し、依頼文の対象を埋めます。子agent禁止環境ではCLI workerをspawnして迂回しません。
3. read-onlyの1回目で対象、check、claim、状態、次の操作だけを照合します。権限のあるGitHub tool/CLIと実際のreview経路があるか確認します。
4. 明示的に登録された対象だけで、review→必要なら修正→再review→checks→merge判定を1回通します。レビュー役はソース/GitHub/GUIを変更しません。
5. API障害、認証切れ、writer再開、dirty、SHA不一致、review経路なしは停止条件。既存状態をreset/stashで捨てません。

これは元の専用scriptの `enroll/tick/resume` コマンドを再現するCLIではありません。元scriptを流用する場合は、repository/owner、Issue/PR schema、check名、branch戦略、CaseとQA、model起動、認証隔離、artifactとcleanupを導入先へ適合させる独立作業にし、その境界の回帰試験が完了するまで本番起動しません。

## 定期実行は必要なときだけ

Codexのscheduled taskやクライアント側schedulerは、実行環境・保存先・実行権限を確認して正規UI/APIで作成します。[公式Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)

このtemplateはautomation.toml、cron、LaunchAgentをインストールしません。元のheartbeatはPAUSEDで、内容に旧実行方針との不一致もあるためコピーしません。新しいtaskへ現在の依頼文・実パス・対象PR・予算を設定し、ユーザーの定期実行依頼がある場合だけ有効にします。

| 設定 | 決める内容 |
| --- | --- |
| 対象 | repository、明示登録PR、統合先、担当 |
| 実行 | trustedな作業directory、必要tools/認証、別session reviewの実経路 |
| 予算 | 1回の時間、修正回数、再試行回数、終了時刻 |
| 停止 | 競合、dirty、不明process、権限不足、API障害、受入変更 |
| 通知 | 進展・完了・新しい障害。変化なしは静かに終了 |
| 復旧 | handle/状態を読み戻し、旧処理停止と同じowner/HEADを確認 |

scheduler登録だけで完了せず、実run/結果/次ownerを追います。PC/アプリ停止時に実行されるかは選んだ環境に依存します。PAUSEDは勝手に解除せず、timeoutを終了の証拠にしません。

## develop/mainの二段階運用（必要な導入先のみ）

実装統合とrelease検証を分ける場合、developは必要テスト・独立review・全受入追跡で統合し、未実施GUI等をQAへ引き継ぎます。main promotionは固定candidateの全対象commit/必要Caseを同じ識別buildで確認してから行います。導入先がmain一本なら架空のdevelopや二重QA台帳を追加せず、実際のrelease条件をproject.mdへ定義します。
