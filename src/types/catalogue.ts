export type ItemUnit = 'trip' | 'km' | 'hr' | 'day' | 'month' | 'fixed' | 'item';

export interface CatalogueItem {
  id: string;
  supplierId?: string;
  name: string;
  description?: string;
  defaultUnit: ItemUnit;
  defaultRate: number;
  taxProfileId?: string;
  sacHsn?: string;
  isActive: boolean;
}

export interface AdHocLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: ItemUnit;
  rate: number;
  discountAmount: number;
  discountType: 'flat' | 'percent';
  taxProfileId?: string;
  sacHsn?: string;
  lineTotal: number;
  taxAmount: number;
  netTotal: number;
}
