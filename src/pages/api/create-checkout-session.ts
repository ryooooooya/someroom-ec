import type { APIRoute } from "astro";
import Stripe from "stripe";
import { getProductDetail } from "../../utils/microcms";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { items } = body as {
      items: { productId: string; quantity: number }[];
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "カートが空です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // microCMSから最新の商品情報を取得して検証
    const products = await Promise.all(
      items.map(async (item) => {
        const product = await getProductDetail(item.productId);
        return { ...item, product };
      })
    );

    // 在庫チェック
    for (const { product, quantity } of products) {
      if (!product.isActive) {
        return new Response(
          JSON.stringify({
            error: `「${product.name}」は現在販売停止中です`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (product.stock < quantity) {
        return new Response(
          JSON.stringify({
            error: `「${product.name}」の在庫が不足しています（残り${product.stock}個）`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Stripe Checkout Session作成（line_itemsにprice_dataで商品情報を送信）
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      products.map(({ product, quantity }) => ({
        price_data: {
          currency: "jpy",
          product_data: {
            name: product.name,
            description: product.text?.[0]?.description || product.size || undefined,
            images: product.images?.[0]?.url ? [product.images[0].url] : [],
            metadata: {
              microCmsId: product.id,
            },
          },
          unit_amount: product.price,
        },
        quantity,
      }));

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      locale: "ja",
      shipping_address_collection: {
        allowed_countries: ["JP"],
      },
      metadata: {
        source: "web",
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout session error:", error);
    return new Response(
      JSON.stringify({ error: "チェックアウトセッションの作成に失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
