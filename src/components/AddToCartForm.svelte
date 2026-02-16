<script lang="ts">
  import { addCartItem, isCartUpdating, cart } from "../stores/cart";

  interface Props {
    productId: string;
    productName: string;
    productPrice: number;
    productImage: { url: string; width: number; height: number } | null;
    productSlug: string;
    stock: number;
    isActive: boolean;
  }

  let { productId, productName, productPrice, productImage, productSlug, stock, isActive }: Props = $props();

  // カート内の同一商品の数量をチェック
  let quantityInCart = $derived(
    $cart?.items?.find((item) => item.productId === productId)?.quantity || 0
  );
  let noQuantityLeft = $derived(stock <= quantityInCart);

  function addToCart() {
    addCartItem({
      productId,
      name: productName,
      price: productPrice,
      image: productImage,
      slug: productSlug,
      stock,
    });
  }
</script>

<button
  type="button"
  class="button text-sm"
  disabled={$isCartUpdating || noQuantityLeft || !isActive || stock <= 0}
  onclick={addToCart}
>
  {#if $isCartUpdating}
    <svg
      class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  {/if}
  {#if !isActive || stock <= 0}
    売り切れ
  {:else}
    カートに入れる
  {/if}
</button>
{#if noQuantityLeft && isActive && stock > 0}
  <div class="text-center text-red-600">
    <small>在庫上限に達しています</small>
  </div>
{/if}
