# MCP・認証・IDE接続

MCPはエージェントが外部ツールを呼ぶ接続口です。設定に存在するだけでは、認証やツール実行が成功している証拠になりません。必要なserverだけ追加します。

## Context7

元環境ではCodexとClaudeの個人設定に `npx -y @upstash/context7-mcp` がありました。テンプレートでは特定機の実行パスを省き、[設定例](../../examples/codex-config.toml)を用意しています。再現性を求める環境は採用時にpackage版を検証して固定し、更新時にread-onlyクエリーを再試験します。[公式Context7](https://github.com/upstash/context7)

Claudeのstdio登録例:

```bash
claude mcp add --transport stdio context7 -- npx -y @upstash/context7-mcp
```

コマンドを実行する前に `claude mcp add --help` でインストール版の引数を確認します。クライアントの一覧から発見し、公開ライブラリを1件解決→ドキュメント1件取得を確認してください。設定一覧にキーがあるだけで合格にしません。

## GitHub

Git操作とIssue/PR操作だけなら既存の `git` / `gh` で足ります。MCPが必要なときだけ[公式GitHub MCP](https://github.com/github/github-mcp-server)を接続します。HTTP endpointは `https://api.githubcopilot.com/mcp/`。クライアントが対応するOAuthまたは本人の限定tokenを正規手順で設定します。

Codex設定例:

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_MCP_TOKEN"
```

`GITHUB_MCP_TOKEN`は環境変数の**名前**です。値や `Bearer ...` をこの欄へ書きません。secret storeからクライアントの実プロセスへ注入し、設定やログへ展開しないでください。Desktopがshellの環境を継承するかも確認します。[公式MCP設定](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

初回は導入先のrepository概要をread-only取得します。操作権限を狭くし、実装担当とGitHub更新担当の権限を分ける運用では、レビュー実行環境へwrite tokenを渡しません。

## Claude / Cursorの設定例

`examples/mcp.json`は秘密情報のないstdio Context7例です。Claudeはproject `.mcp.json`、Cursorは使用版のMCP設定画面から適用します。個人設定の上書きや重複server登録を避けてください。Claudeは[scopeと認証](https://code.claude.com/docs/en/mcp)、Cursorは[公式MCP](https://cursor.com/docs/context/mcp)を確認します。

## IDE側MCP・ACP

IDEの実行・索引・選択editor・debuggerへアクセスする場合だけ、導入先IDEが提供するMCPを追加します。JetBrains系ではTools → MCP Serverから有効化し、IDEが生成するclient設定を使い、対象projectと公開toolを読み戻します。固定portやJARのパスを他機へ転記しません。[JetBrains公式](https://www.jetbrains.com/help/idea/mcp-server.html)

ACPはエージェントとの会話・実行を接続する別のプロトコルです。MCPを設定しただけでACP接続にはなりません。元製品のACP fixture、stdio wire記録、会話の保存ID、専用CLI flagsは共通ハーネスへ移植せず、その製品/IDEの導入資料で扱います。

## 復旧

server未表示→scopeと設定構文、起動失敗→実プロセスのPATH/runtime、401/403→本人の認証と権限、toolは見えるが実行失敗→対象project/ネットワーク/許可を順に確認します。raw configやtokenを報告せず、server名・失敗段階・安全な要約を残します。認証の再設定で既存処理を中断する場合は所有者と調整します。
