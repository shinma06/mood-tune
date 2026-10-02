# 開発と終了の手順

## 開始

MoodTune の統合先は `main`。Issue・Project・Milestone・native関係は [作業管理](work-management.md)、PR の必須項目・固定レビュー・受入は [検証と受入](verification/README.md) を使います。以下の共通手順をそれらへ接続します。

1. Issueとコメント、関連PR、実際の依存、既存claim、branch/worktree/dirtyを確認。
2. 目的と受入を具体化し、重複がなければIssueを作成。必要なProject/Milestoneを設定し、関係なしはStandalone。
3. owner、scope、base SHA、target、reviewer、GUI要否、次の操作をclaimして読み戻す。未解放claimは時間だけで失効しない。
4. 設定済み統合branchをfetchし、Issue専用branch/worktreeを作る。初期upstreamが統合branchなら解除。

```bash
git status --short --branch
git worktree list
git fetch --prune origin
# 例: Issue 12、main運用。導入先に合わせる
git worktree add -b agent/12-example ../worktrees/issue-12 origin/main
cd ../worktrees/issue-12
git branch --unset-upstream
python3 scripts/bootstrap.py
```

claim例（実パス・host・tokenは公開しない）:

```text
status: in-progress
owner: implementation-session; issue: #12; parent: none
base: <full SHA>; target: main
branch: agent/12-example; worktree: isolated (private record)
scope: <files and acceptance>; excluded: <out of scope>
dependencies: none; reviewer: separate session pending
gui: not-required (<reason>)
next: <concrete action>
```

## 実装と検証

要件と呼出しを読み、必要十分な変更を行います。harnessの検証は `python3 scripts/check.py`、導入先アプリはproject.mdの実コマンドです。コード以外の変更でもruntime/buildへ影響する場合はその検証を含めます。未知の影響を文書だけとしてskipしません。

最初の意味あるpushでDraft PRを作り、目的、Issue、検証、GUI理由、残条件を書きます。公開範囲はユーザーの承認どおりにします。read-only相談ではIssue/claim/PRを新設しません。

## 独立レビューと統合

別セッションへ固定HEAD/baseと受入を渡します。[レビュー依頼文](../prompts/review.md)。providerが同じでも別セッションならよく、自己レビューは代替しません。子agentの利用可否は実環境の規約で判断します。実レビュー経路がなければpacketを完成させて担当へ引き継ぎます。

解消していない欠陥、失敗した必須test、受入未達を隠してmergeしません。HEAD/base/target/受入の変更で旧レビューが適用できなくなれば再確認します。現行CIと会話解決を読み戻し、保護付きの通常PR経路で統合します。main/developへ直接pushしません。

MoodTune では main 統合前に今回必要な GUI 受入も満たします。別の QA が必要なら初期条件、操作、期待、証拠、owner、再開条件を付けて双方向linkを読み戻します。子PR mergeだけで親IssueやQAを閉じません。

## 中断・終了・cleanup

停止/引継ぎはowner、状態、branch/target、HEAD、PR、dirty、検証、残条件、次操作、claimの継続/解放を記録。新ownerは旧writer停止・解放または明示再割当後に別worktreeで開始します。

mergeとcleanupを分けて確認します。remote実ref、local branch、tracking ref、worktreeを照合し、自分の停止済みclean資源だけ整理します。squash後の `--merged` や `[gone]` だけで削除せず、PR HEADと統合結果を確認します。main/master/develop、他owner、不明process、GUI使用中、未保存成果物を保全します。保留は理由/owner/再開条件をIssueへ残します。

運用が重くなったときは、主要な管理方式変更・構造的な問題・一定の実merge件数を契機に既存Issueで監査します。毎PRに全体監査を追加せず、重複台帳・不要なfield・古い基準・未登録QA等の実問題に絞ります。
