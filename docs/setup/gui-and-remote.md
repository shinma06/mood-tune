# GUI・ブラウザー・リモート環境

GUIを操作する作業だけに適用します。コード編集やCLI検証にデスクトップ権限は不要です。

## セットアップ

1. 選んだクライアントの正式なComputer Use/browser連携を導入します。Codex Desktopの内部Node REPL、helper、socket、module pathはアプリが管理します。source configを複製しません。
2. OSの画面収録・アクセシビリティ等、実際に必要な許可を本人が確認します。アプリ更新後は再確認します。
3. ブラウザーは連携先の対応browser/profileを選び、対象tabだけを指定します。個人profile/cookieをtemplateへ移しません。
4. [共通lease](../operations.md)を取得した指定担当が、使い捨てfixtureで画面取得・対象表示・最小操作を確認します。対象アプリ、project、build SHA/hashを記録します。
5. GUI未接続、画面取得不能、認証切れはblockedです。CLI成功をGUI passにしません。

Computer Use必須の受入条件を人間操作で代替せず、人間に引き継ぐ場合は許された確認経路を明示します。ブラウザーとIDEを別worktreeから操作してもフォーカスは共有されます。

## リモートhost

元の会話環境にはローカルと別OSホストへの接続機能が提供されていましたが、遠隔機の設定・認証・実プロセスは今回調査していません。接続先一覧にあるだけでは操作可能としません。

導入先の公式remote connection手順で登録し、接続するユーザー・root・branch・worktree・runtime・対象画面を再照合します。ローカルの権限・PATH・MCP・trust・registryを遠隔機へ暗黙継承しません。同じ画面を複数クライアントから触る場合、全員で1つのlease運用を共有します。host名や実パスは非公開の運用記録に残します。

## テスト環境

使い捨てfixtureにはテスト用データだけを用意し、本番の個人会話や実tokenを採取しません。実modelへ送信する試験と、fake ACP/MCP serverを使う合成試験を分けます。合成fixtureは通信処理の確認であり、providerの実能力やGUI観察の代替にはなりません。
