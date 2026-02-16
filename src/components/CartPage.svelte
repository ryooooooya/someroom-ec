<script>
  import { cart, removeCartItems, updateCartItem, isCartUpdating } from '../stores/cart.ts';
  import { onMount } from 'svelte';

  let cartItems = [];
  let isLoading = true;
  let totalPrice = 0;
  let isCheckingOut = false;

  onMount(() => {
    const unsubscribeCart = cart.subscribe(value => {
      cartItems = value?.items || [];
      totalPrice = value?.subtotal || 0;
      isLoading = false;
    });

    return unsubscribeCart;
  });

  async function updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }

    try {
      await updateCartItem(productId, quantity);
    } catch (error) {
      console.error('数量更新エラー:', error);
    }
  }

  async function removeItem(productId) {
    try {
      await removeCartItems([productId]);
    } catch (error) {
      console.error('商品削除エラー:', error);
    }
  }

  async function proceedToCheckout() {
    if (cartItems.length === 0 || isCheckingOut) return;

    isCheckingOut = true;
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'チェックアウトに失敗しました');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('チェックアウトエラー:', error);
      alert('チェックアウトに失敗しました。もう一度お試しください。');
    } finally {
      isCheckingOut = false;
    }
  }

  function formatPrice(amount) {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
    if (isNaN(numericAmount)) {
      return '0';
    }
    return new Intl.NumberFormat('ja-JP', {
      currency: 'JPY'
    }).format(numericAmount);
  }
</script>

<div class="w-full pt-10 pb-12">

  {#if $isCartUpdating}
    <div class="fixed top-4 right-4 bg-black text-white px-4 py-2 shadow-lg z-50">
      <div class="flex items-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span>カートを更新中...</span>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>

  {:else if cartItems.length === 0}
    <div class="">
      <h1 class="text-2xl my-[2px]">カートは空です</h1>
      <a
        href="/"
        class="block w-full py-1 text-black text-underline mt-8 hover:no-underline transition-colors"
      >
        ショッピングを続ける
      </a>
    </div>

  {:else}
    <div class="grid grid-cols-5 gap-10">
      <div class="col-span-3 max-lg:col-span-5">
        <h1 class="text-2xl my-[2px]">カート</h1>
        <div class="mt-9 flex flex-col gap-y-4">
          {#each cartItems as item (item.productId)}
            <div class="flex items-center gap-x-6 max-sm:items-start">
              <div class="flex-shrink-0 w-24 h-24">
                {#if item.image?.url}
                  <img
                    src={item.image.url}
                    alt={item.name}
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                {/if}
              </div>
              <div class="contents max-sm:flex max-sm:flex-col max-sm:gap-y-3">
                <div class="flex-1">
                  <h3 class="text-lg">
                    {item.name}
                  </h3>
                  <p class="text-lg font-medium text-gray-900 mt-2">
                    <span class="text-sm">¥</span>
                    {formatPrice(item.price)}
                  </p>
                </div>
                <div class="flex gap-x-4">
                  <div class="flex items-center space-x-3">
                    <button
                      onclick={() => updateQuantity(item.productId, item.quantity - 1)}
                      class="w-8 h-8 rounded-full text-white bg-black flex items-center justify-center hover:text-gray-500 transition-colors disabled:text-gray-700 disabled:cursor-not-allowed hover:cursor-pointer"
                      aria-label="数量を減らす"
                      disabled={item.quantity <= 1 || $isCartUpdating}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                      </svg>
                    </button>
                    <span class="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onclick={() => updateQuantity(item.productId, item.quantity + 1)}
                      class="w-8 h-8 rounded-full text-white bg-black flex items-center justify-center hover:text-gray-500 transition-colors disabled:text-gray-700 disabled:cursor-not-allowed hover:cursor-pointer"
                      aria-label="数量を増やす"
                      disabled={$isCartUpdating || item.quantity >= item.stock}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </button>
                  </div>
                  <button
                    onclick={() => removeItem(item.productId)}
                    class="w-8 h-8 rounded-full flex items-center justify-center ml-4 text-white bg-black hover:text-gray-500 transition-colors hover:cursor-pointer"
                    aria-label="商品を削除"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="col-span-2 max-lg:col-span-5">
        <div class="px-10 sticky top-6 max-lg:px-0">
          <h2 class="text-2xl">注文内容</h2>
          <div class="mt-9 flex flex-col gap-y-2">
            <div class="flex justify-between">
              <span>小計</span>
              <span>
                <span class="text-sm">¥</span>
                <span>{formatPrice(totalPrice)}</span>
              </span>
            </div>
            <div class="flex justify-between">
              <span>送料</span>
              <span>配送先住所入力後に計算</span>
            </div>
            <hr class="my-8">
            <div class="flex justify-between text-3xl">
              <span>合計</span>
              <span>
                <span class="text-2xl">¥</span>
                <span>{formatPrice(totalPrice)}</span>
              </span>
            </div>
            <div class="pt-4">
              <button
                onclick={proceedToCheckout}
                class="w-full bg-black text-white py-3 px-4 hover:text-gray-500 transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={cartItems.length === 0 || isCheckingOut}
              >
                {#if isCheckingOut}
                  処理中...
                {:else}
                  お会計に進む
                {/if}
              </button>
            </div>
            <a
              href="/"
              class="block w-full py-1 text-black text-underline mt-8 hover:no-underline transition-colors"
            >
              ショッピングを続ける
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .cart-page {
    position: static !important;
    background: transparent !important;
    padding: 0 !important;
    max-width: none !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
  }
</style>
