export type TaxType = 'gst' | 'tds' | 'tcs' | 'cess' | 'none';
export type TaxAppliesTo = 'all' | 'goods' | 'services';
export type PlaceOfSupplyLogic = 'intra_state_cgst_sgst' | 'inter_state_igst' | 'exempt' | 'rcm';

export interface TaxProfile {
  id: string;
  name: string;
  taxType: TaxType;
  ratePercent: number;
  appliesTo: TaxAppliesTo;
  placeOfSupplyLogic: PlaceOfSupplyLogic;
  sacHsnDefault?: string;
  isInclusive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  isActive: boolean;
}

export interface TaxCalculationResult {
  taxableAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalWithTax: number;
  isRcm: boolean;
  isExempt: boolean;
  sacHsn: string;
}
