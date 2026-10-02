# Codex・Claude Code・Cursor

3種類を併用する必要はありません。実装担当とレビュアーはprovider名でなく能力・権限・所有範囲で決め、独立レビューは別セッションにします。

## Codex

1. [公式CLI案内](https://developers.openai.com/codex/cli)からCLIまたは公式Desktopを導入し、正規のログインを完了します。既存の認証ファイルをコピーしません。
2. repositoryを開き、AGENTS.mdと `.agents/skills/start-work/SKILL.md` を発見できるか新規セッションで確認します。Skillsはname/descriptionを入口として必要時に本文を読み込む形式です。[公式Skills](https://learn.chatgpt.com/docs/build-skills)
3. 個人設定とproject設定を分けます。`examples/codex-config.toml` は抜粋例で、既存config全体を上書きしません。modelは現在のUI/CLIで使えるものを選びます。
4. sandbox・ネットワーク・追加ディレクトリは実際の作業先に限定します。`approval_policy = "on-request"`、`sandbox_mode = "workspace-write"` は例で、管理者ポリシーを上書きするものではありません。[公式設定](https://learn.chatgpt.com/docs/config-file/config-reference)
5. Desktop内蔵のapp tools、browser、Computer Use、Node REPLはアプリ管理の導入経路を使います。設定に書かれた内部実行パスを別環境へ配布しません。

導入済みの個人AGENTS、rules、Skills、Pluginsがprojectより広い範囲へ作用します。既存の技術前提や実行ポリシーを確認し、無関係な個人のAndroid前提や特定model禁止をテンプレートへコピーしません。必要な実行制約は導入先に明記します。

## Claude Code

1. [公式setup](https://code.claude.com/docs/en/setup)に従い導入し、`claude --version` と正規ログインを確認します。
2. CLAUDE.mdはAGENTS.mdへのsymlink、`.claude/skills`は共通Skillフォルダーへのsymlinkです。symlink対応のcheckoutを使い、読込を新規セッションで確認します。Claudeのproject Skillsは `.claude/skills/<name>/SKILL.md` に配置できます。[公式Skills](https://code.claude.com/docs/en/skills)
3. 共有設定 `.claude/settings.json` と、本人用 `.claude/settings.local.json` / `~/.claude/settings.json` を分けます。初期状態では一括許可を配布しません。既存環境のauto modeを全員へ強制しないでください。[公式設定](https://code.claude.com/docs/en/settings)
4. `/start-work`、`/finish-work` の発見、MCP、必要なshellコマンドの許可を確認します。

symlinkを使えない環境ではCLAUDE.mdを `@AGENTS.md` の参照入口に置換し、Skillsは共通正本から同期します。同期後の差分と実検出を確かめ、2つの本文を独立保守しません。

## Cursor

1. Cursor IDEまたは[公式CLI](https://cursor.com/docs/cli/overview)を導入し、`agent --version`、正規ログインを確認します。IDEとCLIの認証が同じとは仮定しません。
2. repositoryをprojectとして開き、`.cursor/rules/harness.mdc` がAGENTS.mdを読むことを確認します。alwaysApplyと適用範囲は[公式rules](https://cursor.com/docs/rules)に従います。
3. MCPは[接続手順](mcp.md)。個人のCLI設定、model履歴、allow/deny、cacheはコピーしません。
4. IDEとCLIそれぞれで「このprojectの統合先・testコマンド・作業開始手順をファイル根拠付きで答えて」と依頼し、project.mdとの一致を確認します。Skill自動検出がない環境でもrule経由で明示的に読めるようにしています。

## 共通smoke test

編集前に統合先・検証コマンド・一人writer・別session review・GUI要否を説明できるか確認し、小さな使い捨てIssueでbranch→変更→チェック→PRを1回通します。ファイルの構文検査と、実際のmodelが手順を守ることは別です。
