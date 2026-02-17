import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || "").replace(
        /\\n/g,
        "\n"
      ),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export type OrderData = {
  orderId: string;
  createdAt: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  customerEmail: string;
  postalCode: string;
  shippingAddress: string;
  customerName: string;
  phone: string;
  status: string;
  inventoryUpdated: boolean;
  notes: string;
  stripeUrl: string;
};

export async function addOrderToSheet(orderData: OrderData) {
  const sheets = getSheets();
  const spreadsheetId = import.meta.env.GOOGLE_SPREADSHEET_ID;

  // 商品情報を改行区切りで整形（複数商品対応）
  const productNames = orderData.items
    .map((item) => item.name)
    .join("\n");
  const quantities = orderData.items
    .map((item) => String(item.quantity))
    .join("\n");
  const prices = orderData.items
    .map((item) => String(item.price))
    .join("\n");

  const values = [
    [
      orderData.orderId,          // A: 注文ID
      orderData.createdAt,        // B: 注文日時
      productNames,               // C: 商品名
      quantities,                 // D: 数量
      prices,                     // E: 単価
      orderData.totalAmount,      // F: 合計金額
      orderData.customerEmail,    // G: メールアドレス
      orderData.postalCode,       // H: 郵便番号
      orderData.shippingAddress,  // I: 住所
      orderData.customerName,     // J: 氏名
      orderData.phone,            // K: 電話番号
      orderData.status,           // L: ステータス
      orderData.inventoryUpdated ? "TRUE" : "FALSE", // M: 在庫減算済みフラグ
      orderData.notes,            // N: 備考
      orderData.stripeUrl,        // O: Stripe URL
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "注文一覧!A:O",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function getOrderFromSheet(orderId: string) {
  const sheets = getSheets();
  const spreadsheetId = import.meta.env.GOOGLE_SPREADSHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "注文一覧!A:O",
  });

  const rows = response.data.values || [];
  return rows.find((row) => row[0] === orderId) || null;
}
