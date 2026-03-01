<script lang="ts">
  import { onMount } from "svelte";
  import { addCartItem, isCartUpdating, cart } from "../stores/cart";

  interface Props {
    productId: string;
    productName: string;
    productPrice: number;
    productImage: { url: string; width: number; height: number } | null;
    productSlug: string;
    stock: number;
    isActive: string;
  }

  let { productId, productName, productPrice, productImage, productSlug, stock, isActive }: Props = $props();

  let currentStock = $state(stock);
  let currentIsActive = $state(isActive);
  let errorMessage = $state("");
  let isStatusLoading = $state(true);

  let isPreOrder = $derived(currentIsActive === "予約受付中");
  let isStopped = $derived(currentIsActive === "販売停止中");
  let showPreOrderModal = $state(false);
  let emailCopied = $state(false);

  // マウント時に最新の在庫を確認
  onMount(async () => {
    try {
      const res = await fetch("/api/check-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        const data = await res.json();
        currentStock = data.stock;
        currentIsActive = data.isActive;
      }
    } catch {}
    isStatusLoading = false;
  });

  // カート内の同一商品の数量をチェック
  let quantityInCart = $derived(
    $cart?.items?.find((item) => item.productId === productId)?.quantity || 0
  );
  let noQuantityLeft = $derived(currentStock <= quantityInCart);

  function handleClick() {
    if (isPreOrder) {
      showPreOrderModal = true;
      return;
    }
    addToCart();
  }

  async function addToCart() {
    errorMessage = "";

    // APIで最新の在庫を確認
    try {
      const res = await fetch("/api/check-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();

      if (!res.ok) {
        errorMessage = data.error || "在庫確認に失敗しました";
        return;
      }

      currentStock = data.stock;
      currentIsActive = data.isActive;

      if (data.isActive === "販売停止中") {
        errorMessage = "この商品は現在販売停止中です";
        return;
      }
      if (data.stock <= quantityInCart) {
        errorMessage = "在庫がありません";
        return;
      }
    } catch {
      errorMessage = "在庫確認に失敗しました";
      return;
    }

    addCartItem({
      productId,
      name: productName,
      price: productPrice,
      image: productImage,
      slug: productSlug,
      stock: currentStock,
      salesStatus: currentIsActive,
    });
  }
</script>

<button
  type="button"
  class="button text-sm"
  disabled={isStatusLoading || (isPreOrder ? false : ($isCartUpdating || noQuantityLeft || isStopped || currentStock <= 0))}
  onclick={handleClick}
>
  {#if isStatusLoading}
    …
  {:else if $isCartUpdating}
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
  {:else if isStopped}
    販売停止中
  {:else if currentStock <= 0}
    売り切れ
  {:else if isPreOrder}
    予約注文する
  {:else}
    カートに入れる
  {/if}
</button>
{#if errorMessage}
  <div class="text-center text-red-600">
    <small>{errorMessage}</small>
  </div>
{:else if noQuantityLeft && !isStopped && !isPreOrder && currentStock > 0}
  <div class="text-center text-red-600">
    <small>在庫上限に達しています</small>
  </div>
{/if}

{#if showPreOrderModal}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    onclick={() => showPreOrderModal = false}
    role="dialog"
  >
    <div
      class="bg-white p-8 max-w-sm mx-4 relative"
      onclick={(e) => e.stopPropagation()}
    >
      <button
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        onclick={() => showPreOrderModal = false}
        aria-label="閉じる"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p class="text-lg font-medium mb-4">予約注文について</p>
      <p class="text-sm text-gray-700 leading-relaxed">
        こちらは受注生産品です。<br />
        ご注文は下記メールアドレスにてお受けしております。
      </p>
      <a
        href="mailto:info@someroom.net"
        class="block text-center mt-6 bg-black text-white py-3 px-4 hover:text-gray-400 transition-colors"
      >
        info@someroom.net にメール
      </a>
      <p class="text-center text-sm text-gray-500 mt-3">
        または <button
          class="underline hover:no-underline cursor-pointer"
          onclick={() => {
            navigator.clipboard.writeText('info@someroom.net');
            emailCopied = true;
            setTimeout(() => emailCopied = false, 2000);
          }}
        >{emailCopied ? 'コピーしました!' : 'info@someroom.net'}</button> をコピー
      </p>
    </div>
  </div>
{/if}
