import type { OrderData } from "./google-sheets";

export async function sendSlackNotification(
  message: string,
  blocks?: Record<string, unknown>[]
) {
  const webhookUrl = import.meta.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL is not set, skipping notification");
    return;
  }

  const payload: Record<string, unknown> = { text: message };
  if (blocks) {
    payload.blocks = blocks;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`Slack notification failed: ${response.status}`);
  }
}

export function formatOrderNotification(order: OrderData) {
  const itemsList = order.items
    .map((item) => `  - ${item.name} x${item.quantity} (¥${item.price.toLocaleString()})`)
    .join("\n");

  const message = [
    `🛒 新しい注文が入りました！`,
    `注文ID: ${order.orderId}`,
    `お客様: ${order.customerName} (${order.customerEmail})`,
    `配送先: 〒${order.postalCode} ${order.shippingAddress}`,
    ``,
    `【注文内容】`,
    itemsList,
    ``,
    `合計: ¥${order.totalAmount.toLocaleString()}`,
    `在庫減算: ${order.inventoryUpdated ? "完了" : "失敗あり"}`,
    `注文日時: ${order.createdAt}`,
    `Stripe: ${order.stripeUrl}`,
  ].join("\n");

  return message;
}

export async function sendErrorNotification(error: string, context: string) {
  await sendSlackNotification(
    `⚠️ エラーが発生しました\n\nコンテキスト: ${context}\nエラー: ${error}`
  );
}
