import type { APIRoute } from "astro";
import { getProductDetail } from "../../utils/microcms";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { productId } = (await request.json()) as { productId: string };

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const product = await getProductDetail(productId);

    return new Response(
      JSON.stringify({
        stock: product.stock,
        isActive: product.isActive,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "商品情報の取得に失敗しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
