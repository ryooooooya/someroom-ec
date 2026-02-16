import { z } from "zod";

export const MoneyV2Result = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

export const ImageResult = z
  .object({
    altText: z.string().nullable().optional(),
    url: z.string(),
    width: z.number().positive().int(),
    height: z.number().positive().int(),
  })
  .nullable();

export const CartItemResult = z.object({
  id: z.string(),
  cost: z.object({
    amountPerQuantity: MoneyV2Result,
    subtotalAmount: MoneyV2Result,
    totalAmount: MoneyV2Result,
  }),
  merchandise: z.object({
    id: z.string(),
    title: z.string(),
    product: z.object({
      title: z.string(),
      handle: z.string(),
    }),
    image: ImageResult.nullable(),
  }),
  quantity: z.number().positive().int(),
});

export const CartResult = z
  .object({
    id: z.string(),
    cost: z.object({
      subtotalAmount: MoneyV2Result,
    }),
    checkoutUrl: z.string(),
    totalQuantity: z.number().int(),
    lines: z.object({
      nodes: z.array(CartItemResult),
    }),
  })
  .nullable();

export const VariantResult = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  quantityAvailable: z.number().int(),
  price: MoneyV2Result,
});

export const ProductResult = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    images: z.object({
      nodes: z.array(ImageResult),
    }),
    variants: z.object({
      nodes: z.array(VariantResult),
    }),
    featuredImage: ImageResult.nullable(),
  })
  .nullable();

// microCMS価格をMoney.svelteが受け取るMoneyV2形式に変換
export function priceToMoney(price: number): z.infer<typeof MoneyV2Result> {
  return {
    amount: String(price),
    currencyCode: "JPY",
  };
}
