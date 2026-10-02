# Decision Log

## 重要な技術的決定とその理由（ADR）

### ADR-001: Next.js App Router の採用

**決定**: Next.js App Router を使用（現在は Next.js 16）
**理由**:

- Server Components によるパフォーマンス向上
- ファイルベースルーティングの簡潔さ
- Vercel との統合によるデプロイの容易さ

**影響**: 全てのページは`app/`ディレクトリに配置

---

### ADR-002: shadcn/ui コンポーネントライブラリの採用

**決定**: カスタム UI コンポーネントではなく shadcn/ui を使用
**理由**:

- カスタマイズ可能
- アクセシビリティ対応済み
- メンテナンス不要（コピー&ペースト方式）

**影響**: UI コンポーネントは`src/components/ui/`に配置、必要時のみ追加

---

### ADR-003: React Context API による状態管理

**決定**: Redux や Zustand ではなく、React Context API を使用
**理由**:

- 状態が比較的シンプル（天気データのみ）
- 追加の依存関係が不要
- 学習コストが低い

**影響**: `WeatherContext`で天気データを管理

---

### ADR-004: CSS アニメーションによる天気エフェクト

**決定**: Canvas API や WebGL ではなく、CSS アニメーションを使用
**理由**:

- パフォーマンスが良い
- 実装がシンプル
- メンテナンスが容易

**影響**: `globals.css`にアニメーション定義、`WeatherAnimation`コンポーネントで適用

---

### ADR-005: 固定の top 色による UI 視認性確保

**決定**: 全グラデーションに固定色（#FAFAFA）を最上部に追加
**理由**:

- 上部 UI（WeatherMonitor）の視認性を常に確保
- 全天気パターンでアイコンの視認性を保証
- シンプルな実装

**影響**: `BackgroundGradient`インターフェースに`top`プロパティ追加

---

### ADR-006: Mood Tuning パネルのメイン UI 統合

**決定**: 開発専用ページを削除し、メイン UI 上に Mood Tuning パネルを配置（旧称: テストパネル）
**理由**:

- 実際の UI で直接天気・時間帯を切り替えてテストできる
- 開発フローが簡潔
- デプロイ時に不要なページを削除する必要がない
- ユーザーは「今は夜の雨の気分」などでプレビューにも利用可能

**影響**: `WeatherMoodTuningPanel` をメイン UI に統合。命名は Test → Mood Tuning に統一済み

---

### ADR-007: 選択時の自動適用

**決定**: 適用ボタンを削除し、選択時に即座に反映
**理由**:

- ユーザー体験の向上（1 タップで変更）
- 開発効率の向上

**影響**: `WeatherMoodTuningPanel`の実装を簡素化

---

### ADR-008: 時間帯判定のロジック

**決定**: 時間帯を 4 つに分類（朝: 6-9 時、昼: 9-17 時、夕方: 17-19 時、夜: その他）
**理由**:

- シンプルで理解しやすい
- 背景色の変化が明確

**影響**: `getTimeOfDay`関数の実装

---

### ADR-009: WeatherContext の単一ソース化（表示用天気・時間帯・暗さ）

**決定**: 背景・テキスト色・アニメーションの判定に使う値を Context で単一ソース化する
**理由**:

- 天気取得失敗/ローディング時や Mood Tuning 手動設定時の表示不整合を防ぐ
- `effectiveTimeOfDay`, `effectiveWeather`, `isCanvasBackgroundDark`, `isOverlayThemeDark`, `displayHour` を一箇所で管理し、全コンポーネントが同じ値を参照する

**影響**: `WeatherContext` に上記プロパティを追加。PlaylistExplorer, WeatherMonitor, WeatherMoodTuningPanel, WeatherAnimation が Context から取得

---

### ADR-010: Select Genre パネルとジャンル選択の永続化

**決定**: ジャンル選択を localStorage で永続化。空配列は「永続化として無効」とし、読み込み時はデフォルト（J-POP）に修復する
**理由**:

- パネルで全解除したままリロードしても意図せず 0 件で起動しない
- セッション中は 0 件の選択も許可し、警告表示・パネル閉じ不可で UX を維持

**影響**: `isValidGenreArray` で空配列を invalid に。初回読み込み・他タブ変更時のみ修復

---

### ADR-011: useLocalStorage の同一ページ内変更では無効値を修復しない

**決定**: 同一ページ内のストレージ変更イベントでは、バリデーションに失敗する値（例: 空配列）もそのまま state に反映し、ストレージを上書き修復しない
**理由**:

- ユーザーが「選択解除」や最後の 1 つを外して 0 件にした直後に、修復で即座にデフォルトに戻ると UX が悪い
- 初回読み込み・他タブ変更時のみ修復すれば、意図しない 0 件永続化は防げる

**影響**: `useLocalStorage` は `useSyncExternalStore` で保存値を購読する。同一ページの明示的な保存値だけ検証の例外として保持し、初回・他タブからの無効値は修復する（#23で実装更新）

---

### ADR-012: ジャンル変更時のプレイリスト更新は差分のみ API 呼び出し

**決定**: Select Genre パネルを閉じたとき、追加されたジャンル分だけ `generateDashboard` を呼び、既存ジャンルは現在のプレイリストを再利用する
**理由**:

- 全件再生成だと不要な API 呼び出しとローディングが増える
- 追加ジャンルのみ生成して既存とマージすれば効率的

**影響**: `updatePlaylistsWithDiff`, `getGenresDiff` で差分計算。Mood Tuning 閉じ時は全件再生成（天気・時間が変わるため）

---

### ADR-013: レコード右 3 周・左 3 周で個別/全件再生成

**決定**: レコードを右に 3 周以上回したら表示中ジャンル単体を再生成、左に 3 周以上で全件再生成。通常のスワイプ（45°）では next/prev のみ
**理由**:

- ジェスチャーで「このジャンルだけやり直したい」「全部やり直したい」を直感的に実行できる
- 誤操作を防ぐため 3 周という閾値を設ける

**影響**: `useVinylRotation` の `onRegenerateCurrent`, `onRegenerateAll`。PlaylistExplorer で `refreshPlaylistByGenre`, `refreshPlaylists` に接続

---

### ADR-014: 都市名取得に Google Geocoding API（逆ジオコーディング）を採用

**決定**: 天気モニターの都市名表示に、緯度経度から地名を取得する Google Geocoding API（逆ジオコーディング）を使用する。取得失敗・空の場合は OpenWeatherMap の `name` にフォールバックする
**理由**:

- より正確でローカルな地名表示（市区町村レベル）が可能
- 天気 API と並列取得することでレイテンシを増やさない
- 本番では API キーのウェブサイト制限に対応するため Referer を送信、開発では送らない

**影響**: `GET /api/geocode` を新設。`weather-api.ts` で天気と Geocoding を `Promise.all` で並列取得。表示は最もローカルな地名のみ（locality > administrative_area_level_2 > level_1）

---

### ADR-015: 天気取得に WxTech API を優先採用（OpenWeatherMap はフォールバック）

**決定**: 天気データの取得を WxTech 優先とする。日本域は 1km メッシュ ピンポイント、海外は 5km メッシュ 世界天気予報を使用。WxTech が失敗または未設定の場合は OpenWeatherMap にフォールバックする
**理由**:

- 日本では 1km メッシュで高精度、海外でも 5km で世界対応可能
- レスポンスを OpenWeatherMap 互換に正規化するためクライアント変更不要
- 既存の OpenWeatherMap キーはフォールバック用に維持

**影響**: `GET /api/weather` で WxTech を先に呼び出し、成功時は wx コードを WeatherType にマッピングして正規化レスポンスを返す。`lib/wxtech-weather.ts` で日本域判定と天気コードマッピングを集約。Base URL は `https://wxtech.weathernews.com`（api. サブドメインなし）

---

### ADR-016: 初回アクセス時の背景・時間帯の初期化（isTimeInitialized）

**決定**: SSR/初回はサーバー時刻に依存せず `displayHour` を 0 で初期化し、クライアントで現地時刻を設定したあと `isTimeInitialized = true` にする。未初期化時は `effectiveTimeOfDay = "day"`, `isCanvasBackgroundDark = false`, `isOverlayThemeDark = false` で中性背景を使う
**理由**:

- ハイドレーションのずれや一瞬の誤った時間帯表示を防ぐ
- コンテンツ到着前も白画面を避けるため、`INITIAL_BACKGROUND_GRADIENT` を layout/loading/PlaylistExplorer で統一

**影響**: `WeatherContext` に `isTimeInitialized` を追加。`weather-background-utils.ts` に `INITIAL_BACKGROUND_GRADIENT`。PlaylistExplorer は初期化完了後に天気・時間帯に応じた背景へ切り替え

---

### ADR-017: 天気 10 分ポーリングは Mood Tuning 中は実行しない

**決定**: WeatherMonitor の 10 分ごとの天気再取得は、`isMoodTuning` が true の間はスキップする
**理由**:

- 手動で天気・時間を設定している最中に実際の天気で上書きされないようにする
- バックグラウンド再取得時はローディング表示なし（初回成功後の同座標再取得）

**影響**: `WeatherMonitor` で `isMoodTuningRef.current` を参照してポーリングをスキップ。自動更新時は `refreshPlaylists({ autoUpdate: true })` で「天気・時間の変化に合わせて再生成中」を表示

---

### ADR-018: Spotify 認証を PKCE に統一、プレイリスト保存は直接 fetch

**決定**: NextAuth を使わず、Spotify の Authorization Code with PKCE で自前実装。認可は `GET /api/auth/spotify`、コールバックでトークン交換・セッションは暗号化クッキー（`spotify-session.ts`）、リフレッシュは同一モジュールで自動。プレイリスト保存（saveToSpotify）は spotify-web-api-node の一部エンドポイントで 403 が出るため、セッショントークンで Spotify Web API を直接 fetch し、既存プレイリストの上書きは `PUT /playlists/{id}/items`（非推奨の `/tracks` は 403）、100 曲超はチャンク送信

**理由**:

- PKCE でクライアントシークレットをフロントに露出せず、サーバー側でトークン交換・リフレッシュを一元管理できる
- プレイリスト replace で 403 を避けるため新エンドポイント（/items）と直接 fetch を採用

**影響**: `lib/spotify-pkce.ts`, `lib/spotify-session.ts`, `app/api/auth/spotify`, `app/api/auth/spotify/callback`, `app/api/auth/signout`, `auth.ts`（getSession のラップ）。`saveToSpotify` は getSession + fetch、PUT /items と 100 曲チャンク

---

### ADR-019: Overlay テーマとキャンバス視認性判定を分離

**決定**: `themePreference`（time/light/dark/system）はモーダル・パネル等の overlay UI にのみ適用し、メイン画面の視認性判定（`isCanvasBackgroundDark`）は天気×時間帯の静的テーブルで独立して管理する
**理由**:

- ユーザーのテーマ選好と、背景上テキストの可読性は目的が異なるため
- 単一の判定に混在させると、UI 視認性とデザイン意図の両方が崩れる

**影響**: `WeatherContext` で `isOverlayThemeDark` と `isCanvasBackgroundDark` を分離提供。PlaylistExplorer/WeatherMonitor/SettingsPanel は用途に応じて参照先を切り替える

---

### ADR-020: リファクタリングによる共通化・構造整理（実施済み）

**決定**: バリデーション・オーバーレイスタイル・プレイリストロジック・API 実装を整理し、単一ソースと再利用可能なユーティリティに集約する  
**理由**:

- 重複コードの削減と今後の開発効率向上
- 既存要件を変えずに構造と実装の一貫性を高める

**影響**:

- **共通化**: `lib/validators.ts`（isThemePreference, isValidGenreArray 等）、`lib/overlay-theme.ts`（getOverlayStyles）、`components/shared/SpotifyIcon.tsx`
- **フック分割**: `hooks/useSelectedGenres.ts`、`hooks/usePlaylistManager.ts`（プレイリスト状態・生成・差分更新・自動更新を PlaylistExplorer から抽出）
- **GenreSelector**: 3 表示モードを 1 コンポーネントに統一。GenreSelectModal は getOverlayStyles でスタイル統一
- **API**: `generateDashboard` は Vercel AI SDK v6 `Output.array()` + zod で構造化出力。`mapWithConcurrency` は `lib/utils.ts` に移動。天気取得は `lib/weather-fetch.ts` に抽出し route は薄く維持。`findMoodTunePlaylist` はページネーションに安全上限を付与
- **WeatherContext**: value を `useMemo` でメモ化
- **依存関係**: 未使用パッケージ 38 個を削除（使用中は @radix-ui/react-slot, react-label 等のみ）
