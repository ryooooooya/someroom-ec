# Claude Code への移行指示書

## プロジェクト概要

既存のastro-shopify ECサイトを、Shopifyから microCMS + Stripe + Google Spreadsheet 構成に移行する。
UIやデザインは現状を維持し、バックエンドとデータフローのみを変更する。

## 前提条件

- リポジトリ: https://github.com/ryooooooya/astro-shopify
- 要件定義書: ec-requirements.md (別途提供)
- 現在の構成: Astro + Shopify Storefront API + Svelte
- 移行後の構成: Astro SSR + microCMS + Stripe Checkout + Google Spreadsheet

## 移行方針

### 保持する要素
- 現在のUI/UXデザイン
- Tailwind CSSのスタイリング
- コンポーネント構造
- ページレイアウト
- カートドロワー等のSvelteコンポーネント

### 変更する要素
- Shopify Storefront API → microCMS REST API
- Shopify Checkout → Stripe Checkout
- 在庫管理: Shopify管理画面 → microCMSフィールド
- 注文管理: Shopify Admin → Google Spreadsheet + Google Apps Script

## 段階的な移行手順

### Phase 0: 準備

1. 現在のリポジトリをclone
2. 要件定義書(ec-requirements.md)を確認
3. 以下のディレクトリ・ファイル構造を把握:
   ```
   /src/components/  (Svelteコンポーネント)
   /src/layouts/     (Astroレイアウト)
   /src/pages/       (Astroページ)
   /src/stores/      (Svelte store - cart.ts等)
   /src/utils/       (ユーティリティ - shopify.ts等)
   /src/styles/      (CSSファイル)
   ```

### Phase 1: microCMS連携実装

#### 1-1. microCMS用ユーティリティ作成

`/src/utils/microcms.ts` を新規作成:
- microCMS REST APIクライアント実装
- 商品一覧取得関数
- 商品詳細取得関数
- 在庫更新関数
- TypeScript型定義

参考: 現在の `/src/utils/shopify.ts` の構造を踏襲

#### 1-2. 商品データ型の変更

現在のShopify型定義を microCMS型定義に置き換え:
```typescript
// 変更前: Shopify Product型
// 変更後: microCMS Product型 (要件定義書参照)
```

#### 1-3. ページファイルの書き換え

以下のページファイルを microCMS対応に書き換え:
- `/src/pages/index.astro` (トップページ)
- `/src/pages/products/index.astro` (商品一覧)
- `/src/pages/products/[slug].astro` (商品詳細)

変更内容:
- Shopify API呼び出し → microCMS API呼び出し
- データ構造の変更に対応
- UIコンポーネントへのpropsは変更しない(または最小限に)

### Phase 2: Stripe Checkout実装

#### 2-1. Stripe API Route作成

`/src/pages/api/create-checkout-session.ts` を新規作成:
- カート内容を受け取る
- microCMSで在庫確認
- Stripe Checkout Session作成
- セッションURLを返却

要件定義書のセクション「3.3.3 API Route実装」を参照

#### 2-2. カート機能の改修

`/src/stores/cart.ts` を修正:
- Shopify Checkout呼び出し → Stripe Checkout呼び出しに変更
- チェックアウトボタンクリック時の処理変更
- それ以外のカート操作(追加/削除/数量変更)は維持

#### 2-3. 決済完了・キャンセルページ作成

- `/src/pages/success.astro` (決済成功ページ)
- `/src/pages/cancel.astro` (決済キャンセルページ)

### Phase 3: Webhook・在庫管理実装

#### 3-1. Stripe Webhook API Route作成

`/src/pages/api/webhook.ts` を新規作成:
- Webhook署名検証
- checkout.session.completed イベント処理
- 在庫減算処理
- Google Spreadsheet連携
- Slack通知

要件定義書のセクション「3.4 在庫管理機能」を参照

#### 3-2. Google Sheets連携実装

Webhook内でGoogle Sheets APIを使用して注文データを記録:
- googleapis ライブラリ使用
- サービスアカウント認証
- スプレッドシートへの書き込み

要件定義書のセクション「3.5 注文データ管理」を参照

#### 3-3. Slack通知実装

Incoming Webhook経由でSlackに通知:
- 注文情報
- エラー情報

### Phase 4: 特商法対応

#### 4-1. 法律ページ作成

- `/src/pages/legal/tokusho.astro` (特定商取引法ページ)
- `/src/pages/legal/privacy.astro` (プライバシーポリシーページ)

要件定義書のセクション「17.4 特商法ページの実装」を参照

#### 4-2. フッター修正

既存のフッターコンポーネントに法律ページへのリンクを追加

### Phase 5: Astro SSRへの移行

#### 5-1. astro.config.mjs 修正

```javascript
export default defineConfig({
  output: 'server', // hybrid から server へ
  adapter: vercel(),
  // その他の設定は維持
});
```

#### 5-2. ページファイルの調整

必要に応じてSSR対応:
- getStaticPaths の削除
- SSR用のデータフェッチ実装

### Phase 6: 環境変数・設定

#### 6-1. .env.example 更新

```
# microCMS
MICROCMS_SERVICE_DOMAIN=your-service-domain
MICROCMS_API_KEY=your-api-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_SPREADSHEET_ID=...

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

#### 6-2. 不要なファイル削除

Shopify関連の不要ファイルを削除:
- `/src/utils/shopify.ts` (microCMS版に置き換え済み)
- Shopify固有の型定義
- その他Shopify依存ファイル

### Phase 7: テスト・検証

1. ローカル環境での動作確認
2. Stripe Test Modeでの決済テスト
3. Webhook受信テスト
4. Google Spreadsheet連携テスト
5. Slack通知テスト

## 重要な注意点

### UIを壊さない

- 既存のコンポーネントpropsインターフェースをできるだけ維持
- Tailwind CSSクラスは変更しない
- レイアウト構造は維持
- コンポーネントの見た目は変更しない

### データ構造のマッピング

Shopify → microCMS のデータ構造変換を適切に行う:
```typescript
// Shopify
product.title → product.name
product.variants[0].price → product.price
product.handle → product.slug
// etc.
```

### エラーハンドリング

各API呼び出しで適切なエラーハンドリングを実装:
- microCMS API エラー
- Stripe API エラー
- Google Sheets API エラー
- Slack通知エラー

### 型安全性

TypeScript型定義を適切に行う:
- microCMS レスポンス型
- Stripe オブジェクト型
- API Route リクエスト/レスポンス型

## 依存パッケージの追加

以下のパッケージを追加インストール:

```bash
npm install stripe googleapis
npm install --save-dev @types/node
```

## vercel.json の設定

Vercel Cron Jobs用の設定追加(Phase後半で実装):
```json
{
  "crons": [{
    "path": "/api/check-orders",
    "schedule": "0 0 * * *"
  }]
}
```

## Claude Code への最終指示

以下の順序で進めてください:

1. 要件定義書(ec-requirements.md)を熟読
2. 現在のリポジトリ構造を把握
3. Phase 0から順番に実装
4. 各Phaseごとに動作確認
5. 既存のUI/デザインを絶対に壊さない
6. 質問があれば実装前に確認

特に重要:
- 現在のUIコンポーネント構造は維持する
- Tailwind CSSのクラス名は変更しない
- Svelteコンポーネントのインターフェースは最小限の変更に留める
- データフェッチ部分のみを Shopify API → microCMS API に置き換える

段階的に進めて、各Phaseごとにコミットして動作確認してください。
