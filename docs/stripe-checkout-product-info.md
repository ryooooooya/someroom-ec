# Stripe Checkoutへの商品情報送信

## 概要

Stripe Checkoutセッション作成時に商品情報を送ることで、以下が実現できます:

- Stripe Checkoutページに商品名・画像・価格を表示
- Stripeダッシュボードに商品情報を記録
- Webhookで購入された商品情報を取得

## 実装方法

### 方法1: line_items で商品情報を送る(推奨)

最も標準的な方法。Stripe Checkoutページに商品情報が表示され、ダッシュボードでも確認できます。

#### 基本的な実装例

```typescript
// /src/pages/api/create-checkout-session.ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { items } = await request.json();

    // カート内容をStripe line_items形式に変換
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'jpy',
        product_data: {
          name: item.name,
          description: item.description,
          images: item.images ? [item.images[0]] : [],
          metadata: {
            product_id: item.id,
            sku: item.sku,
          },
        },
        unit_amount: item.price, // 価格(円単位)
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/cancel`,
      shipping_address_collection: {
        allowed_countries: ['JP'],
      },
      // 顧客メールアドレスの収集
      customer_email: undefined, // または事前に入力させた場合は指定
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

#### フロントエンド実装例(Svelteカートコンポーネント)

```typescript
// /src/stores/cart.ts または カートコンポーネント内
async function handleCheckout() {
  try {
    // カート内容を整形
    const items = $cart.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      quantity: item.quantity,
      images: item.images,
      sku: item.sku,
    }));

    // Stripe Checkout Session作成APIを呼び出し
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    const { url } = await response.json();

    // Stripe Checkoutページにリダイレクト
    window.location.href = url;
  } catch (error) {
    console.error('Checkout error:', error);
    alert('決済処理でエラーが発生しました');
  }
}
```

### 方法2: metadata で追加情報を送る

商品情報以外のカスタムデータを送りたい場合に使用。

```typescript
const session = await stripe.checkout.sessions.create({
  line_items: lineItems,
  mode: 'payment',
  metadata: {
    order_note: '配送時の注意事項など',
    source: 'web',
    campaign_id: 'spring_sale_2026',
  },
  success_url: '...',
  cancel_url: '...',
});
```

metadataの制限:

- キー: 最大40文字
- 値: 最大500文字
- 最大50個のキー・バリューペア

### 方法3: Stripe Productsを事前登録(オプション)

商品数が少なく、価格が固定の場合は、Stripe Dashboardで商品とPriceを事前登録しておく方法もあります。

#### Stripe Dashboardでの設定

1. Stripe Dashboard → Products → 商品を作成
1. 商品ごとにPrice IDが発行される(例: `price_1ABC...`)

#### 実装例

```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [
    {
      price: 'price_1ABC123...', // 事前登録したPrice ID
      quantity: 2,
    },
  ],
  mode: 'payment',
  success_url: '...',
  cancel_url: '...',
});
```

メリット:

- コードがシンプルになる
- Stripe Dashboardで商品管理が可能

デメリット:

- 商品追加のたびにStripe Dashboardで登録が必要
- 動的な価格変更に対応しづらい

小規模ECで商品数が少ない場合は方法3も選択肢ですが、柔軟性を考えると方法1(price_data)が推奨です。

## Webhookでの商品情報取得

決済完了後、webhookで購入された商品情報を取得します。

```typescript
// /src/pages/api/webhook.ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      import.meta.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook Error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // line_itemsを取得(expandが必要)
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
      session.id,
      { expand: ['line_items'] }
    );

    const lineItems = sessionWithLineItems.line_items?.data || [];

    // 商品情報を処理
    for (const item of lineItems) {
      console.log('商品名:', item.description);
      console.log('数量:', item.quantity);
      console.log('価格:', item.amount_total);

      // product_dataのmetadataから商品IDやSKUを取得
      if (item.price?.product && typeof item.price.product === 'object') {
        const product = item.price.product as Stripe.Product;
        const productId = product.metadata?.product_id;
        const sku = product.metadata?.sku;

        console.log('商品ID:', productId);
        console.log('SKU:', sku);

        // ここで在庫減算やGoogle Spreadsheet記録を行う
        // await updateInventory(productId, item.quantity);
        // await recordOrder(...);
      }
    }

    // 配送先情報を取得
    const shippingDetails = session.shipping_details;
    if (shippingDetails) {
      console.log('配送先:', shippingDetails.address);
      console.log('受取人:', shippingDetails.name);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

重要な注意点:

- `line_items`はデフォルトでは含まれないため、`expand: ['line_items']`で明示的に取得が必要
- webhookのペイロードサイズ制限があるため、商品数が非常に多い場合は別途APIで取得

## データ構造の例

### リクエスト(フロントエンド → API)

```json
{
  "items": [
    {
      "id": "prod_001",
      "name": "ハンドメイドポーチ",
      "description": "オリジナルデザインの手作りポーチ",
      "price": 3500,
      "quantity": 2,
      "images": ["https://example.com/image1.jpg"],
      "sku": "POUCH-001"
    },
    {
      "id": "prod_002",
      "name": "アクセサリー",
      "description": "ビーズアクセサリー",
      "price": 1200,
      "quantity": 1,
      "images": ["https://example.com/image2.jpg"],
      "sku": "ACC-002"
    }
  ]
}
```

### Stripe line_items形式

```typescript
[
  {
    price_data: {
      currency: 'jpy',
      product_data: {
        name: 'ハンドメイドポーチ',
        description: 'オリジナルデザインの手作りポーチ',
        images: ['https://example.com/image1.jpg'],
        metadata: {
          product_id: 'prod_001',
          sku: 'POUCH-001',
        },
      },
      unit_amount: 3500,
    },
    quantity: 2,
  },
  {
    price_data: {
      currency: 'jpy',
      product_data: {
        name: 'アクセサリー',
        description: 'ビーズアクセサリー',
        images: ['https://example.com/image2.jpg'],
        metadata: {
          product_id: 'prod_002',
          sku: 'ACC-002',
        },
      },
      unit_amount: 1200,
    },
    quantity: 1,
  },
]
```

## Google Spreadsheetへの記録

webhook内で取得した商品情報をGoogle Spreadsheetに記録する例:

```typescript
async function recordOrderToSheet(session: Stripe.Checkout.Session, lineItems: Stripe.LineItem[]) {
  const { google } = await import('googleapis');

  // 認証設定
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: import.meta.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 商品情報を整形(複数商品の場合は改行区切り)
  const productNames = lineItems.map(item => item.description).join('\n');
  const quantities = lineItems.map(item => item.quantity).join('\n');
  const prices = lineItems.map(item => (item.amount_total / 100).toFixed(0)).join('\n');

  const row = [
    session.payment_intent, // 注文ID
    new Date().toISOString(), // 注文日時
    productNames, // 商品名
    quantities, // 数量
    prices, // 単価
    (session.amount_total / 100).toFixed(0), // 合計金額
    session.customer_details?.email || '', // メールアドレス
    session.shipping_details?.address?.postal_code || '', // 郵便番号
    `${session.shipping_details?.address?.line1 || ''} ${session.shipping_details?.address?.line2 || ''}`, // 住所
    session.shipping_details?.name || '', // 氏名
    '', // 電話番号(optional)
    '未発送', // ステータス
    'TRUE', // 在庫減算済みフラグ
    '', // 備考
    `https://dashboard.stripe.com/payments/${session.payment_intent}`, // Stripe URL
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: import.meta.env.GOOGLE_SPREADSHEET_ID,
    range: '注文一覧!A:O',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  });
}
```

## テスト方法

### 1. ローカルでの動作確認

```bash
# Stripe CLIをインストール(未インストールの場合)
# brew install stripe/stripe-cli/stripe (macOS)

# Stripe CLIでログイン
stripe login

# Webhookをローカルにフォワード
stripe listen --forward-to localhost:4321/api/webhook

# 別ターミナルでAstro起動
npm run dev

# テスト決済を実行
# ブラウザで http://localhost:4321 にアクセスして決済テスト
```

### 2. Stripe Test Modeでのテスト

テスト用クレジットカード番号:

- カード番号: 4242 4242 4242 4242
- 有効期限: 任意の将来の日付(例: 12/34)
- CVC: 任意の3桁(例: 123)
- 郵便番号: 任意(例: 123-4567)

### 3. line_itemsの確認

Stripe Dashboard → Payments → 該当の決済 → Line items セクションで確認

## トラブルシューティング

### line_itemsがwebhookで取得できない

原因: デフォルトではline_itemsは含まれない

解決策:

```typescript
const session = await stripe.checkout.sessions.retrieve(
  sessionId,
  { expand: ['line_items'] } // これが必要
);
```

### 商品画像が表示されない

原因: 画像URLがHTTPSでない、またはアクセス制限がある

解決策:

- HTTPS URLを使用
- CORSが適切に設定されているか確認
- 画像サイズが大きすぎないか確認(推奨: 1000x1000px以下)

### metadataが取得できない

原因: metadata の階層が異なる

確認ポイント:

```typescript
// Session レベルの metadata
session.metadata.xxx

// Product レベルの metadata
item.price.product.metadata.xxx
```

## まとめ

推奨実装:

1. `price_data` でline_itemsを作成(方法1)
1. 商品IDやSKUは `product_data.metadata` に含める
1. Webhookで `expand: ['line_items']` を指定して取得
1. 取得した商品情報でGoogle Spreadsheet記録・在庫減算

この実装により:

- Stripe Checkoutに商品情報が表示される
- Stripeダッシュボードで注文内容を確認できる
- Webhookで確実に商品情報を取得できる
- Google Spreadsheetに詳細な注文履歴が残る
