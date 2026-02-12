export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  defaultBarcode?: string;
  createdAt: number;
  expDate?: number;
  closeBoxCounter?: number;

  // Relations
  portionContainerId?: string | null;
  boxContainerId?: string | null;
  packLabelId?: string | null;
  boxLabelId?: string | null;

  // Display names (optional, from serializer)
  portionContainerName?: string;
  boxContainerName?: string;
  packLabelName?: string;
  boxLabelName?: string;
};

export type Packaging = {
  id: string;
  name: string;
  weightGrams?: number;
  createdAt?: number;
};

export type LabelTemplate = {
  id: string;
  name: string;
  width?: number;
  height?: number;
};

export type Station = {
  id: number;
  station_uuid: string;
  station_ip: string;
  is_online: boolean;
  name?: string; // If 'hostname' or 'name' exists
  station_number?: number;
};

export type ProductPackagingLink = {
  id: string;
  productId: string;
  packagingId: string;
  createdAt: number;
};

export type GlobalAttribute = {
  id: number;
  name: string;
  created: string;
};
