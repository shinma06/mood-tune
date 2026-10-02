# Progress

このファイルはハーネス導入前の製品実装の記録。現在の作業・受入・課題は [GitHub Issue](https://github.com/shinma06/mood-tune/issues) と [開発マップ](https://github.com/users/shinma06/projects/3) を参照する。

## 実装済み機能（現在の実装）

### コア機能
- ✅ 位置情報から天気データ取得（WxTech 優先: 日本は 1km メッシュ ピンポイント、海外は 5km メッシュ 世界天気予報。失敗時は OpenWeatherMap にフォールバック）。都市名は Google Geocoding API（逆ジオコーディング）で取得
- ✅ 天気タイプ対応（日本の主要気象に絞り: Clear, Clouds, Rain, Drizzle, Thunderstorm, Snow, Mist, Fog, Haze など）
- ✅ 時間帯（朝/昼/夕方/夜）の自動判定（displayHour で単一ソース、1分ごとに更新）
- ✅ 天気と時間帯に応じた背景色の動的変化（4色グラデーション）
- ✅ 天気アイコンの表示とテーマカラー
- ✅ Clear かつ夜の場合の月アイコン表示
- ✅ 暗い背景時のテキスト色自動調整（`isCanvasBackgroundDark` / `isOverlayThemeDark` の単一ソース）

### UI/UX
- ✅ レコード盤風のプレイリスト探索 UI
- ✅ スワイプ/ドラッグでプレイリスト切り替え（45° 閾値）
- ✅ **Select Genre パネル**（Settings 内）: 21 ジャンルから最大 4 個選択、選択解除で 0 件も許可（警告・パネル閉じ不可）
- ✅ **Mood Tuning パネル**（左下）: 天気・時間帯の手動設定、実際の天気・時間に戻すボタン（条件付き表示）
- ✅ **オンボーディングモーダル**: `login -> genre-select -> tutorial` の初回導線制御（PageClient + OnboardingOrchestrator）
- ✅ 天気モニター（日時、気温、都市名、天気アイコン）
- ✅ パネル展開ボタンは角丸・アイコン比率を維持したサイズ（2.8rem / rounded 1.1rem）

### プレイリスト生成・更新
- ✅ AI（OpenAI / Vercel AI SDK）によるジャンル別タイトル・検索クエリ生成
- ✅ Spotify API でカバー画像・トラック URI 取得（検索ヒットしない場合はフォールバック画像）
- ✅ ジャンル選択の localStorage 永続化（空配列は永続化として無効、読み込み時にデフォルトへ修復）
- ✅ パネル閉じ時のジャンル差分更新（追加ジャンルのみ API 呼び出し）
- ✅ レコード右 3 周で表示中ジャンル単体再生成、左 3 周で全件再生成
- ✅ 時間帯・天気の変化でプレイリスト自動更新（Mood Tuning 手動中は対象外）
- ✅ 初回読み込み後の localStorage と表示プレイリストの同期

### アニメーション
- ✅ 雨のアニメーション（Rain, Drizzle, Thunderstorm）
- ✅ 雪のアニメーション（Snow）
- ✅ 雲のアニメーション（Clouds）
- ✅ 霧/もやのアニメーション（Mist, Fog, Haze）
- ✅ 砂塵のアニメーション（Dust, Sand）
- ✅ 竜巻のアニメーション（Tornado）
- ✅ スコールのアニメーション（Squall）
- ✅ 雷のフラッシュ効果（Thunderstorm）
- ✅ 画面の水滴効果（Rain, Thunderstorm）
- ✅ レコードのアイドル時自動回転（12 秒/周）、ドラッグで停止

### 背景色・レコード色
- ✅ 全天気タイプ×全時間帯の背景色定義
- ✅ グラデーション上部の視認性確保（getTopColor で dusk 時など暗い扱いを拡張）
- ✅ レコード色: 初期同期時の stale J-POP と空状態は現実のレコード色、それ以外は表示中ジャンルのテーマカラー

### 認証・モード
- ✅ Spotify 認証（PKCE: Authorization Code with PKCE）。セッションは暗号化クッキー、トークンリフレッシュは spotify-session で自動
- ✅ プレイリストの Spotify 保存（saveToSpotify: MoodTune プレイリスト 1 本の上書き or 新規作成、PUT /items・100曲超はチャンク）

### 初期化・ポーリング
- ✅ 初回アクセス時の背景・時間帯の初期化（`isTimeInitialized`、`INITIAL_BACKGROUND_GRADIENT`）
- ✅ 天気の 10 分ポーリング（Mood Tuning 中はスキップ、バックグラウンド時はローディング表示なし）
- ✅ 天気・時間帯変化時のプレイリスト自動更新（非 Mood Tuning 時、LoadingMode `"auto"` 文言）

### コード品質・リファクタリング
- ✅ 背景・天気アイコン・テーマ色の静的定数化（`BACKGROUNDS`, `WEATHER_ICON_MAP`, `WEATHER_THEME_COLORS` 等）
- ✅ `generateDashboard` の try/catch によるエラーハンドリング（空配列返却）。Vercel AI SDK v6 `Output.array()` + zod で構造化出力に移行済み
- ✅ プレイリスト関連ユーティリティの集約（`playlist-utils.ts`: LoadingMode, getLoadingTitleText, getLoadingGenreText 等）
- ✅ **共通化**: `lib/validators.ts`（バリデーション）、`lib/overlay-theme.ts`（getOverlayStyles）、`components/shared/SpotifyIcon.tsx`
- ✅ **フック**: `usePlaylistManager`（プレイリスト状態・生成・更新）、`useSelectedGenres` を hooks に独立。GenreSelector は 3 モードを 1 コンポーネントに統一
- ✅ **API**: 天気取得は `lib/weather-fetch.ts` に抽出。`mapWithConcurrency` は `lib/utils.ts`。`findMoodTunePlaylist` にページネーション安全上限を付与
- ✅ **WeatherContext**: value を useMemo でメモ化
- ✅ 未使用パッケージ 38 個を削除

---

## 今後のビジョン（未実装）

- プレイリストの実際の音楽再生機能（アプリ内再生）
- ユーザー設定（位置情報の再取得、天気更新間隔など）
- オフライン対応
- プッシュ通知（天気変化の通知など）

## 既知のバグ・課題

- 重大な既知バグは未記録（軽微な不具合は都度 Issue/PR で管理）

## 技術的負債

- 追加時に記録する運用（現時点でブロッカー級の負債は未登録）

## パフォーマンス最適化の余地

- アニメーション要素数の最適化（必要に応じて）
- 画像の最適化（プレイリストカバー画像）
