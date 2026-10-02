# 検証と未確認の扱い

## 実行するチェック

```bash
python3 scripts/check.py
python3 scripts/doctor.py
```

checkはGit追跡済みと未追跡・非ignoreファイルを対象に、設定構文・symlink・相対リンクの存在・既知secret形式・個人path・差分空白と、temporary directory内の回帰試験を確認します。新規ファイルも `git add` 前から対象です。全secret形式、意味の正しさ、外部サイトの将来の到達性は保証しません。

doctorは実行ファイルと入口の有無・選択hooksだけを表示し、個人configや認証値を読みません。認証/MCP/trust/GUI/ruleset/schedulerの成功確認はそれぞれ別に行います。

## 導入先smoke testの記録

| 項目 | 記録する証拠 |
| --- | --- |
| runtime | OS、CLI版、実行したcheckと結果 |
| context | 使用client、AGENTS/Skill検出、統合先/testコマンドの説明一致 |
| Git | Issue branch、hooks、禁止pushが拒否される使い捨て試験 |
| MCP | server名、read-only呼出し、認証/権限の結果（秘密は省く） |
| plugin/hook | 採用版、本人のtrust、実イベントの確認 |
| GUI | 担当、lease、fixture、識別build、期待/実際、観察者 |
| CI/review | PR、固定HEAD/base、checks、独立session、指摘処置 |
| scheduler | 単発実run、予算、停止、復旧、PAUSED維持 |

状態は `pending / pass / fail / blocked / not-required` を理由付きで使います。ファイルがあるだけなら「構成確認」、実際のtool呼出し成功なら「接続確認」、使い捨てタスクを通したら「操作確認」です。

## 導入後の確認

共通Pythonツールと MoodTune の PR gate はtemporary fixtureで検証し、GitHub CIでもPython 3.11の同じ入口を実行します。アプリの検証と gate の意味は [受入手順](verification/README.md)、実際の導入状態は [導入記録](harness-adoption.md) を参照します。最終の対象SHA・実チェック結果・独立レビュー・CIは作成Issue/PRが正本です。全client再install、modelの実行比較、GUI通知、MCPの再認証、remote host、scheduler起動をテンプレート取り込みの成功と混同しません。

実務の速度改善、コスト削減、token削減は未測定です。
