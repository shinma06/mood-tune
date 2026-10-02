# Plugins・Skills・通知hooks

## 移植単位

Skillsは手順、PluginsはSkills/MCP/hooksなどの配布単位、hooksはイベント時に実際に動く処理です。インストール・有効化・信頼・発火は別段階です。plugin cache全体をコピーせず、配布元から必要なものだけ再導入します。

元環境ではPonytail、Warp連携、Codex app tools、Computer Use/browser、文書系、visualize等が設定されていました。文書系やSwift LSPを通常の開発必須にはしません。個人のharness-improve / instruction-audit / tune-agent-instructionsも発見されましたが、内容の全配布はせず、共通の監査原則をcontext.mdと棚卸しへ取り込みました。

## Ponytail（任意）

AGENTS.mdに最小実装の判断順序を持つので、plugin未導入でも共通方針は適用できます。pluginが必要なら[公式配布元](https://github.com/DietrichGebert/ponytail)の現在のinstall手順を使い、選んだref、実際のversion、manifest、hookスクリプトを確認します。

元環境の調査時は4.10.0のcacheと、SessionStart / UserPromptSubmit / SubagentStartのhook定義を確認しました。過去資料の4.9.0・trust未設定という記録を現行状態としてコピーしていません。hookにSubagentStartがあることは子agent起動の許可ではありません。

Codexはインストール版のplugin管理画面/CLI helpを入口にし、`/hooks` 等の正規経路で実行内容を確認して信頼を設定します。trusted_hashを手書きしたり他機からコピーしません。[公式Hooks](https://learn.chatgpt.com/docs/hooks)

## Vibe IslandとWarp（任意・ホスト固有）

元環境では個人Codex hooksとClaude hooksが `~/.vibe-island/bin/vibe-island-bridge` を呼び、sourceをcodex/claudeで分けていました。launcherはVibe Island.appのhelperへ渡すもので、共有repositoryには含まれていません。[Vibe Island公式配布](https://vibeisland.app/)から導入します。Homebrewを使う場合は `brew install --cask vibe-island`。起動後の連携設定でbridgeを再生成し、通知のOS権限を設定します。手製のコピーではアプリ移動・更新後のhelper解決を保証できません。

WarpのCodex/Claude向けpluginにもhook設定がありました。[Codex向け公式plugin](https://github.com/warpdotdev/codex-warp)と[Claude向け公式手順](https://docs.warp.dev/agents/cli-agents/claude-code)を確認し、採用するterminalに必要な連携だけ有効にし、同じSessionStart/Stop/PermissionRequest/PostToolUseを複数箇所から重複通知しないか、使い捨てタスク1回で確認します。既存hookを一括削除しません。

Codex側には別途notify設定もあり、アプリ管理のComputer Use helperを指していました。Vibe Islandと同一の通知経路とは断定せず、installer管理設定として再生成します。CLIに成功を返す通知launcherは、通知の表示成功を保証しません。

これらのアプリ固有installer手順・通知表示は今回の新環境で実行していません。導入できない場合は通知なしで開発を開始でき、任意連携だけを未確認として残します。

## 管理者設定と個人設定

管理配布の設定がある場合は優先順位を確認します。元環境で確認した候補ファイルが存在しなかったことは、他のMDMや組織制約がない証明ではありません。認証、許可、trust、モデル、experimental flagを元機の値で統一せず、導入先の実要件へ合わせます。
