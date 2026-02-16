import type { MicroCMSQueries, MicroCMSListContent } from "microcms-js-sdk";
import { createClient } from "microcms-js-sdk";

const client = createClient({
  serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: import.meta.env.MICROCMS_API_KEY,
});


// 型定義
export type Designers = {
  image: {
    url: string;
    height: number;
    width: number;
  };
  nameJa: string;
  nameEn: string;
  profile: string;
  link: {
    url: string;
    text: string;
  }[];
} & MicroCMSListContent;

export type Series = {
  title: string;
  text: string;
  designers: Designers[];
  coverImage: {
    url: string;
    height: number;
    width: number;
  };
  otherImage: {
    url: string;
    height: number;
    width: number;
  }[];
} & MicroCMSListContent;

export type Products = {
  name: string;
  size: string;
  designers: Designers[];
  series: Series[];
  categories: Categories[];
  text: {
    title: string;
    description: string;
  }[];
  link: {
    url: string;
    text: string;
  }[];
  // EC用フィールド
  price: number;
  stock: number;
  images: {
    url: string;
    height: number;
    width: number;
  }[];
  isActive: boolean;
  slug?: string;
} & MicroCMSListContent;

export type Categories = {
  name: string;
} & MicroCMSListContent;


// APIの呼び出し
export const getProducts = async (queries?: MicroCMSQueries) => {
  return await client.getList<Products>({ endpoint: "products", queries });
};
export const getProductDetail = async (
  contentId: string,
  queries?: MicroCMSQueries
) => {
  return await client.getListDetail<Products>({
    endpoint: "products",
    contentId,
    queries,
  });
};

// slugフィルタで商品取得
export const getProductBySlug = async (slug: string, queries?: MicroCMSQueries) => {
  const response = await client.getList<Products>({
    endpoint: "products",
    queries: {
      ...queries,
      filters: `slug[equals]${slug}`,
      limit: 1,
    },
  });
  if (response.contents.length > 0) {
    return response.contents[0];
  }
  // slugで見つからない場合、IDとして検索
  try {
    return await client.getListDetail<Products>({
      endpoint: "products",
      contentId: slug,
      queries,
    });
  } catch {
    return null;
  }
};

// isActive=trueの商品一覧
export const getActiveProducts = async (queries?: MicroCMSQueries) => {
  return await client.getList<Products>({
    endpoint: "products",
    queries: {
      ...queries,
      filters: queries?.filters
        ? `${queries.filters}[and]isActive[equals]true`
        : "isActive[equals]true",
    },
  });
};

// 在庫更新（コンテンツAPIのPATCH使用）
export const updateProductStock = async (productId: string, newStock: number) => {
  const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = import.meta.env.MICROCMS_API_KEY;
  const response = await fetch(
    `https://${serviceDomain}.microcms.io/api/v1/products/${productId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-MICROCMS-API-KEY": apiKey,
      },
      body: JSON.stringify({ stock: newStock }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to update stock: ${response.status}`);
  }
  return await response.json();
};

export const getCategories = async (queries?: MicroCMSQueries) => {
  return await client.getList<Categories>({ endpoint: "categories", queries });
};
export const getCategoryDetail = async (
  contentId: string,
  queries?: MicroCMSQueries
) => {
  return await client.getListDetail<Categories>({
    endpoint: "categories",
    contentId,
    queries,
  });
};

export const getSeries = async (queries?: MicroCMSQueries) => {
  return await client.getList<Series>({ endpoint: "series", queries });
};
export const getSeriesDetail = async (
  contentId: string,
  queries?: MicroCMSQueries
) => {
  return await client.getListDetail<Series>({
    endpoint: "series",
    contentId,
    queries,
  });
};

export const getDesigners = async (queries?: MicroCMSQueries) => {
  return await client.getList<Designers>({ endpoint: "designers", queries });
};
export const getDesignerDetail = async (
  contentId: string,
  queries?: MicroCMSQueries
) => {
  return await client.getListDetail<Designers>({
    endpoint: "designers",
    contentId,
    queries,
  });
};
