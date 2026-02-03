import type { Packaging, Product, ProductPackagingLink } from "./types";

const KEY_PRODUCTS = "lms_products_v1";
const KEY_PACKAGING = "lms_packaging_v1";
const KEY_LINKS = "lms_product_packaging_links_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadProducts(): Product[] {
  const parsed = safeParse<Product[]>(localStorage.getItem(KEY_PRODUCTS));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
}

export function loadPackaging(): Packaging[] {
  const parsed = safeParse<Packaging[]>(localStorage.getItem(KEY_PACKAGING));
  return Array.isArray(parsed) ? parsed : [];
}

export function savePackaging(packaging: Packaging[]) {
  localStorage.setItem(KEY_PACKAGING, JSON.stringify(packaging));
}

export function loadLinks(): ProductPackagingLink[] {
  const parsed = safeParse<ProductPackagingLink[]>(localStorage.getItem(KEY_LINKS));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLinks(links: ProductPackagingLink[]) {
  localStorage.setItem(KEY_LINKS, JSON.stringify(links));
}
