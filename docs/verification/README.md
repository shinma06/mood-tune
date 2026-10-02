# 検証・独立レビュー・統合

| 必須 check | 役割 |
| --- | --- |
| `harness-checks` | 設定・リンク・秘密候補と Python 回帰テスト |
| `test` | `npm ci` → lint（既存抑制あり）→ 型チェック → 本番ビルド |
| `PR policy` | Issue の実在・open・題名・各1ラベル、branch、PR 必須項目 |
| `Agent review` | 現在の HEAD/base/Issue/PR 条件に一致する別セッションのレビュー記録 |
| `Acceptance gate` | 受入 JSON と GUI 要否、必要な全 Case の現在 HEAD での結果 |

ローカルのハーネス検証は `npm run check`、製品の確認範囲は [project.md](../project.md)。抑制なしの lint は `npm run lint:full`。
CLI・CI・GUI・本番反映は別の結果。未実施を pass にせず、pending / blocked / fail と理由・担当・次の操作を残す。

## PR の受入

PR は [テンプレート](../../.github/pull_request_template.md) の Issue / Integration / Verification / GUI / GUI reason / Writer を各1行持つ。
`docs/verification/changes/issue-N.json` に次を記録する。GUI 不要の場合も理由と実際の CLI コマンドは必須。

```json
{
  "schema": 1,
  "issue": 12,
  "gui_required": true,
  "reason": "ジャンル選択の表示と閉じたときの差分更新を変更する",
  "cli_checks": ["npm run check", "npm run lint", "npm run typecheck", "npm run build"],
  "cases": [{
    "id": "GENRE-1",
    "preconditions": "固定した候補build、非ログイン、既存ジャンルを保存済み",
    "steps": ["SettingsからSelect Genreを開く", "ジャンルを追加して閉じる"],
    "expected": "追加ジャンルだけ生成し、既存プレイリストを維持する"
  }]
}
```

GUI 不要は `gui_required: false` と `cases: []`。UI・CSS・hook の差分（rename 前も含む）は不要指定を拒否する。その他の動作影響・Case の十分性は独立レビューで確認する。
JSON 内のコマンドはデータとして検査し、自動実行しない。GUI の観察結果は commit 後のレビュー記録へ置き、証拠を更新するだけで対象 SHA が変わる循環を避ける。

## 独立レビュー

1. writer が実装を止め、HEAD/base・受入・実行した checks・残条件を [依頼文](../../prompts/review.md) とともに別セッションへ渡す。新しいセッションの利用は現在の実行権限に従う。
2. coordinator は trusted main の `python3 scripts/pr_policy.py --pr N` で現在の `head` / `base` / `input_digest` を取得する。レビューがない間の非0終了は正常な未達表示。
3. 実レビュー後、許可された owner/member/collaborator が PR コメントに下の記録と実際の報告を載せる。自己レビューや架空のセッション識別子では承認しない。

````markdown
<!-- moodtune-review -->
```json
{
  "head": "実際のPR HEAD SHA",
  "base": "実際のmain SHA",
  "input_digest": "取得したdigest",
  "reviewer_session": "writerと異なる公開可能なセッション識別子",
  "verdict": "approved",
  "unresolved_findings": [],
  "evidence": "実レビュー報告へのリンク、またはこのコメントに続く報告の要約",
  "cases": []
}
```
実レビューの対象・指摘・解決・確認したことをここへ記載する。
````

GUI 必須なら `cases` の各要素に `id`, `status: pass`, `head`, `observer`, `build`, `evidence` を記録する。全 Case を現在 HEAD と識別した同じ候補 build で観察する。Case不足、旧SHA、pending/fail/blockedは拒否する。
最新の権限あるレビュー記録だけを採用する。HEAD/base/PR本文/Issue題名・本文・ラベルの変更で旧記録は失効する。同じ GitHub アカウントでも独立セッションである必要があり、文字列の違いだけで実際の独立性を保証できるわけではない。coordinator は実セッションの報告を確認してから記録する。

## trusted main と初回導入

[policy workflow](../../.github/workflows/policy.yml) は常に main のコードで PR/Issue/コメントをデータとして読む。PR コードを checkout/実行せず、read権限と commit status の write だけを使用する。PR・レビュー記録・Issue条件・main の変更で再判定する。
取得・解析の前に古い gate 成功を pending に戻す。通信・所有・入力の不整合があれば成功へ進めず、担当が再実行する。更新後は実際の checks を読み戻す。

初回 #22 の base `c15251f127e60c571dba858a8a1d721308557e48` にはこの workflow がないため、CI の harness/test と別セッションレビューを先に完了する。その後、確認済みの導入コードを担当者が `python3 scripts/pr_policy.py --pr N --publish` で実行し、実結果の3 statusを発行する。成功した実在 check を ruleset に登録して通常 PR で統合する。成功の固定出力や一時的な保護解除は行わない。
導入後の `--publish` は trusted main を使う管理担当の復旧用。通常は GitHub Actions が発行する。これは自動 reviewer・fixer・merge engine ではない。

## 統合と終了

merge 直前に最新の HEAD/base/条件と5つの成功 check、会話解決、独立レビュー・全受入を確認する。strict base、PR必須、force/削除禁止、bypassなしは [.github/main-ruleset.json](../../.github/main-ruleset.json) に定義する。
通常の squash merge 後、Issue・Project・Milestone・native 関係と cleanup を [作業管理](../work-management.md) に従い読み戻す。本番公開は別の依頼範囲と実接続確認に従う。
