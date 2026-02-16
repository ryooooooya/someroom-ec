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
  sessionId: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export async function addOrderToSheet(orderData: OrderData) {
  const sheets = getSheets();
  const spreadsheetId = import.meta.env.GOOGLE_SPREADSHEET_ID;

  const itemsSummary = orderData.items
    .map((item) => `${item.name} x${item.quantity} (¥${item.price})`)
    .join(", ");

  const values = [
    [
      orderData.orderId,
      orderData.sessionId,
      orderData.customerEmail,
      orderData.customerName,
      orderData.shippingAddress,
      itemsSummary,
      orderData.totalAmount,
      orderData.currency,
      orderData.status,
      orderData.createdAt,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "注文一覧!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function getOrderFromSheet(orderId: string) {
  const sheets = getSheets();
  const spreadsheetId = import.meta.env.GOOGLE_SPREADSHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "注文一覧!A:J",
  });

  const rows = response.data.values || [];
  return rows.find((row) => row[0] === orderId) || null;
}
