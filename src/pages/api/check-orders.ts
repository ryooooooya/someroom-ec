import type { APIRoute } from "astro";
import Stripe from "stripe";
import { getOrderFromSheet } from "../../utils/google-sheets";
import { sendSlackNotification } from "../../utils/slack";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const GET: APIRoute = async ({ request }) => {
  // Vercel Cron認証ヘッダー検証
  const authHeader = request.headers.get("authorization");
  const cronSecret = import.meta.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 過去24時間のStripe決済を取得
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

    const sessions = await stripe.checkout.sessions.list({
      created: { gte: oneDayAgo },
      status: "complete",
      limit: 100,
    });

    const mismatches: string[] = [];

    for (const session of sessions.data) {
      const paymentIntentId = session.payment_intent as string;
      if (!paymentIntentId) continue;

      // Spreadsheetに注文が記録されているか確認
      const sheetOrder = await getOrderFromSheet(paymentIntentId);

      if (!sheetOrder) {
        mismatches.push(
          `未記録: session=${session.id}, payment=${paymentIntentId}, amount=¥${session.amount_total}`
        );
      }
    }

    if (mismatches.length > 0) {
      const message = [
        "⚠️ 注文データ整合性チェック - 不一致検出",
        "",
        `確認期間: 過去24時間`,
        `不一致件数: ${mismatches.length}件`,
        "",
        ...mismatches,
      ].join("\n");

      await sendSlackNotification(message);
    }

    return new Response(
      JSON.stringify({
        checked: sessions.data.length,
        mismatches: mismatches.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Order check error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
