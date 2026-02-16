import { atom } from "nanostores";
import { persistentAtom } from "@nanostores/persistent";

// カートアイテム型
export type LocalCartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: { url: string; width: number; height: number } | null;
  slug: string;
  stock: number;
};

// カート型
export type LocalCart = {
  items: LocalCartItem[];
  totalQuantity: number;
  subtotal: number;
};

const emptyCart: LocalCart = {
  items: [],
  totalQuantity: 0,
  subtotal: 0,
};

function recalcCart(items: LocalCartItem[]): LocalCart {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}

// Cart drawer state
export const isCartDrawerOpen = atom(false);

// Cart is updating state
export const isCartUpdating = atom(false);

// Cart store with persistent state (localStorage)
export const cart = persistentAtom<LocalCart>("cart", emptyCart, {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// セッション開始時のlocalStorage検証
export async function initCart() {
  const sessionStarted = sessionStorage.getItem("sessionStarted");
  if (!sessionStarted) {
    sessionStorage.setItem("sessionStarted", "true");
    // ローカルカートの整合性チェック（不正データのリセット）
    const localCart = cart.get();
    if (localCart && localCart.items) {
      // 再計算して整合性を保つ
      cart.set(recalcCart(localCart.items));
    } else {
      cart.set(emptyCart);
    }
  }
}

// カートに商品を追加
export async function addCartItem(item: {
  productId: string;
  name: string;
  price: number;
  image: { url: string; width: number; height: number } | null;
  slug: string;
  stock: number;
  quantity?: number;
}) {
  isCartUpdating.set(true);

  const localCart = cart.get();
  const existingIndex = localCart.items.findIndex(
    (i) => i.productId === item.productId
  );

  let newItems: LocalCartItem[];

  if (existingIndex >= 0) {
    // 既存アイテムの数量を増やす
    newItems = localCart.items.map((i, idx) =>
      idx === existingIndex
        ? { ...i, quantity: i.quantity + (item.quantity || 1) }
        : i
    );
  } else {
    // 新規アイテム追加
    newItems = [
      ...localCart.items,
      {
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image,
        slug: item.slug,
        stock: item.stock,
      },
    ];
  }

  cart.set(recalcCart(newItems));
  isCartUpdating.set(false);
  isCartDrawerOpen.set(true);
}

// カートアイテムの数量を更新
export async function updateCartItem(productId: string, quantity: number) {
  if (quantity <= 0) {
    return removeCartItems([productId]);
  }

  isCartUpdating.set(true);

  const localCart = cart.get();
  const newItems = localCart.items.map((item) =>
    item.productId === productId ? { ...item, quantity } : item
  );

  cart.set(recalcCart(newItems));
  isCartUpdating.set(false);
  return true;
}

// カートからアイテムを削除
export async function removeCartItems(productIds: string[]) {
  isCartUpdating.set(true);

  const localCart = cart.get();
  const newItems = localCart.items.filter(
    (item) => !productIds.includes(item.productId)
  );

  cart.set(recalcCart(newItems));
  isCartUpdating.set(false);
}

// カートをクリア（チェックアウト成功後）
export function clearCart() {
  cart.set(emptyCart);
}
