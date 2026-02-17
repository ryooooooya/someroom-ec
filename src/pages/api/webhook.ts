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
      // line_itemsをexpandで取得（ドキュメント推奨方式）
      const session = await stripe.checkout.sessions.retrieve(sessionRaw.id, {
        expand: ["line_items", "line_items.data.price.product"],
      });

      const lineItems = session.line_items?.data || [];

      // line_itemsから商品情報を抽出
      const cartItems: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
      }[] = [];

      for (const item of lineItems) {
        // product_dataのmetadataからmicroCmsIdを取得
        let microCmsId = "";
        if (item.price?.product && typeof item.price.product === "object") {
          const product = item.price.product as Stripe.Product;
          microCmsId = product.metadata?.microCmsId || "";
        }

        cartItems.push({
          productId: microCmsId,
          name: item.description || "",
          price: item.price?.unit_amount || 0,
          quantity: item.quantity || 0,
        });
      }

      // microCMS在庫減算
      let inventoryUpdated = true;
      for (const item of cartItems) {
        if (!item.productId) continue;
        try {
          const product = await getProductDetail(item.productId);
          const newStock = Math.max(0, product.stock - item.quantity);
          await updateProductStock(item.productId, newStock);
        } catch (stockError) {
          console.error(
            `Stock update failed for ${item.productId}:`,
            stockError
          );
          inventoryUpdated = false;
          await sendErrorNotification(
            String(stockError),
            `在庫更新失敗: ${item.name} (${item.productId})`
          );
        }
      }

      // 配送先情報（API v2026-01-28以降はcollected_informationに格納）
      const sessionAny = session as any;
      const shipping =
        sessionAny.collected_information?.shipping_details ||
        sessionAny.shipping_details;
      const address = shipping?.address;
      const postalCode = address?.postal_code || "";
      const shippingAddress = address
        ? `${address.state || ""}${address.city || ""}${address.line1 || ""}${address.line2 || ""}`
        : "";

      // Google Spreadsheet注文記録（ドキュメント15列フォーマット）
      const orderData: OrderData = {
        orderId: session.payment_intent as string,
        createdAt: new Date(session.created * 1000).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        }),
        items: cartItems,
        totalAmount: session.amount_total || 0,
        customerEmail: session.customer_details?.email || "",
        postalCode,
        shippingAddress,
        customerName: shipping?.name || session.customer_details?.name || "",
        phone: session.customer_details?.phone || "",
        status: "未発送",
        inventoryUpdated,
        notes: "",
        stripeUrl: `https://dashboard.stripe.com/payments/${session.payment_intent}`,
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
        `Webhook処理エラー: session ${sessionRaw.id}`
      );
      return new Response("Processing error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
