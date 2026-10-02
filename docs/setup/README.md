# 外部環境のセットアップ

リポジトリをcloneするだけでは、ログイン、MCP、Plugins、OS権限、GitHub保護、schedulerは移りません。必要な層だけを下の順序で設定します。

| 順番 | 設定するもの | 完了の確認 |
| --- | --- | --- |
| 1 | Git、Python 3.11以上、Bash、GitHub CLI | `git --version` / `python3 --version` / `gh --version` |
| 2 | [選んだ開発クライアント](clients.md) | ログイン、新規セッション、指示とSkillsの検出 |
| 3 | [MCPと認証](mcp.md) | server一覧、必要なread-only呼出し、権限範囲 |
| 4 | [Plugins・通知](plugins-and-hooks.md) | manifest/実行内容、重複、実イベントの確認 |
| 5 | [GitHub](github.md) | repository、CI、保護ルール、Issue/PR経路 |
| 6 | [GUI・リモート環境](gui-and-remote.md) | 必要な場合だけ、画面取得・対象識別・共通lease |
| 7 | [自動進行](automation.md) | 単発のdry-run、その後明示起動・停止・復旧 |

## runtimeと配置

Python標準ライブラリだけで共通ツールが動きます。Node/npmはContext7のstdio版やPonytail等、選んだ外部ツールが必要とする場合に導入します。アプリのJDK/SDK/Gradle/ブラウザーなどは導入先のproject.mdへ記載し、ハーネスの依存と分けます。

macOS/Linuxが共通CLIの対象です。GUI leaseは `fcntl` と同一OSユーザーのPOSIX権限を利用します。Windows nativeの動作は未確認です。WSLでコード検証する場合も、Windowsデスクトップ操作とは別ホスト扱いにせず、実際に共有する画面の操作者・予約を一本化してください。WSLのlockファイルがWindows側の操作を強制禁止するわけではありません。

新しい環境で自分のPATHを確認します。GUIアプリから起動するCLIは対話shellとPATHが異なる場合があります。既存機のNode絶対パス、app bundle内部の実行ファイル、socket、trusted code pathsは移植せず、正式なinstallerが再生成する値を使います。

## 秘密情報とセットアップ記録

設定全体や環境変数一覧をチャットへ貼らず、項目の有無・環境変数名・接続結果だけ記録します。認証は正規ログイン/secret storeを使い、外部サービスごとに導入先repositoryと必要操作へ権限を限定します。`gh auth status` 等を確認しても、tokenを表示するコマンドは使いません。

個人の `~/.codex` / `~/.claude` / `~/.cursor`、ブラウザープロファイル、credential storeを丸ごと同期しません。`.harness-local/`はGit管理外ですが暗号化保管庫ではありません。ログにもtokenを残さず、共有時に読み直してください。

[確認記録の形式](../validation.md)に、導入日・クライアント版・実model選択・検出・接続・未確認・解除担当を記録します。modelの選択値や料金プランをこのテンプレートで固定しません。
