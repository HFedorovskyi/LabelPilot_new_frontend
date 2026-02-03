export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  defaultBarcode?: string;
  createdAt: number;
};

export type Packaging = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  depthMm?: number;
  tareGrams?: number;
  createdAt: number;
};

export type ProductPackagingLink = {
  id: string;
  productId: string;
  packagingId: string;
  createdAt: number;
};
