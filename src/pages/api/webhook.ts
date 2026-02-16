import type { APIRoute } from "astro";
import Stripe from "stripe";
import { getProductDetail, updateProductStock } from "../../utils/microcms";
import { addOrderToSheet, type OrderData } from "../../utils/google-sheets";
import {
  sendSlackNotification,
  formatOrderNotification,
  sendErrorNotification,
} from "../../utils/slack";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const sessionRaw = event.data.object as Stripe.Checkout.Session;

    try {
      // セッション詳細を再取得
      const session = await stripe.checkout.sessions.retrieve(sessionRaw.id);

      // line_items取得
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );

      // metadataからカートデータ取得
      const cartData = JSON.parse(session.metadata?.cartData || "[]") as {
        productId: string;
        name: string;
        price: number;
        quantity: number;
      }[];

      // microCMS在庫減算
      for (const item of cartData) {
        try {
          const product = await getProductDetail(item.productId);
          const newStock = Math.max(0, product.stock - item.quantity);
          await updateProductStock(item.productId, newStock);
        } catch (stockError) {
          console.error(
            `Stock update failed for ${item.productId}:`,
            stockError
          );
          await sendErrorNotification(
            String(stockError),
            `在庫更新失敗: ${item.name} (${item.productId})`
          );
        }
      }

      // 配送先情報
      const shipping = session.shipping_details;
      const address = shipping?.address;
      const shippingAddress = address
        ? `〒${address.postal_code || ""} ${address.state || ""}${address.city || ""}${address.line1 || ""}${address.line2 || ""}`
        : "";

      // Google Spreadsheet注文記録
      const orderData: OrderData = {
        orderId: session.payment_intent as string,
        sessionId: session.id,
        customerEmail: session.customer_details?.email || "",
        customerName: shipping?.name || session.customer_details?.name || "",
        shippingAddress,
        items: cartData,
        totalAmount: session.amount_total ? session.amount_total : 0,
        currency: session.currency || "jpy",
        status: "paid",
        createdAt: new Date(session.created * 1000).toISOString(),
      };

      try {
        await addOrderToSheet(orderData);
      } catch (sheetError) {
        console.error("Spreadsheet error:", sheetError);
        await sendErrorNotification(
          String(sheetError),
          "Spreadsheet注文記録失敗"
        );
      }

      // Slack注文通知
      try {
        const message = formatOrderNotification(orderData);
        await sendSlackNotification(message);
      } catch (slackError) {
        console.error("Slack notification error:", slackError);
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
      await sendErrorNotification(
        String(error),
        `Webhook処理エラー: session ${session.id}`
      );
      return new Response("Processing error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
