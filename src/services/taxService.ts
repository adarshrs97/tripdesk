import { TaxProfile, TaxCalculationResult } from '../types/tax';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const SEED_TAX_PROFILES: TaxProfile[] = [
  {
    id: 'e1000000-0000-0000-0000-000000000001',
    name: 'No Tax',
    taxType: 'none',
    ratePercent: 0.0,
    appliesTo: 'all',
    placeOfSupplyLogic: 'exempt',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
  {
    id: 'e1000000-0000-0000-0000-000000000002',
    name: 'GST 5% (CGST 2.5 + SGST 2.5)',
    taxType: 'gst',
    ratePercent: 5.0,
    appliesTo: 'services',
    placeOfSupplyLogic: 'intra_state_cgst_sgst',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
  {
    id: 'e1000000-0000-0000-0000-000000000003',
    name: 'GST 12% (CGST 6 + SGST 6)',
    taxType: 'gst',
    ratePercent: 12.0,
    appliesTo: 'services',
    placeOfSupplyLogic: 'intra_state_cgst_sgst',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
  {
    id: 'e1000000-0000-0000-0000-000000000004',
    name: 'GST 18% (CGST 9 + SGST 9)',
    taxType: 'gst',
    ratePercent: 18.0,
    appliesTo: 'services',
    placeOfSupplyLogic: 'intra_state_cgst_sgst',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
  {
    id: 'e1000000-0000-0000-0000-000000000005',
    name: 'TDS 194C 1% (Individual/Proprietor)',
    taxType: 'tds',
    ratePercent: 1.0,
    appliesTo: 'services',
    placeOfSupplyLogic: 'exempt',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
  {
    id: 'e1000000-0000-0000-0000-000000000006',
    name: 'TDS 194C 2% (Company/Corporate)',
    taxType: 'tds',
    ratePercent: 2.0,
    appliesTo: 'services',
    placeOfSupplyLogic: 'exempt',
    sacHsnDefault: '996601',
    isInclusive: false,
    notes: 'Confirm with your CA',
    isActive: true,
  },
];

export class TaxService {
  private static localProfiles: TaxProfile[] = [...SEED_TAX_PROFILES];

  /**
   * Retrieves all active tax profiles
   */
  public static async getTaxProfiles(): Promise<TaxProfile[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('tax_profiles')
          .select('*')
          .eq('is_active', true)
          .order('rate_percent', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            taxType: d.tax_type,
            ratePercent: parseFloat(d.rate_percent),
            appliesTo: d.applies_to,
            placeOfSupplyLogic: d.place_of_supply_logic,
            sacHsnDefault: d.sac_hsn_default,
            isInclusive: d.is_inclusive,
            effectiveFrom: d.effective_from,
            effectiveTo: d.effective_to,
            notes: d.notes,
            isActive: d.is_active,
          }));
        }
      } catch (err) {
        console.warn('Using local tax profiles cache:', err);
      }
    }
    return this.localProfiles;
  }

  /**
   * Resolves effective tax profile following the Scope Ladder:
   * lineProfile > invoiceProfile > contractProfile > customerDefaultProfile > supplierDefaultProfile > globalDefault ("No tax")
   */
  public static resolveEffectiveTaxProfile(
    ladder: {
      lineProfileId?: string;
      invoiceProfileId?: string;
      contractProfileId?: string;
      customerProfileId?: string;
      supplierProfileId?: string;
    },
    availableProfiles: TaxProfile[] = this.localProfiles
  ): TaxProfile {
    const targetId =
      ladder.lineProfileId ||
      ladder.invoiceProfileId ||
      ladder.contractProfileId ||
      ladder.customerProfileId ||
      ladder.supplierProfileId;

    if (targetId) {
      const found = availableProfiles.find((p) => p.id === targetId);
      if (found) return found;
    }

    // Default fallback: "No Tax"
    return availableProfiles.find((p) => p.ratePercent === 0) || this.localProfiles[0];
  }

  /**
   * Computes GST/TDS breakup based on place of supply and tax profile
   */
  public static calculateTax(
    taxableAmount: number,
    profile: TaxProfile,
    options: {
      supplierState?: string;
      customerState?: string;
    } = {}
  ): TaxCalculationResult {
    const rate = profile.ratePercent || 0;
    const sacHsn = profile.sacHsnDefault || '996601';

    if (rate <= 0 || profile.placeOfSupplyLogic === 'exempt' || profile.taxType === 'none') {
      return {
        taxableAmount,
        taxRatePercent: 0,
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalWithTax: taxableAmount,
        isRcm: profile.placeOfSupplyLogic === 'rcm',
        isExempt: true,
        sacHsn,
      };
    }

    let calculatedTax = 0;
    let baseAmount = taxableAmount;

    if (profile.isInclusive) {
      // Inclusive tax: Total includes tax => Base = Total / (1 + r)
      baseAmount = Math.round((taxableAmount / (1 + rate / 100)) * 100) / 100;
      calculatedTax = Math.round((taxableAmount - baseAmount) * 100) / 100;
    } else {
      // Exclusive tax: Tax = Base * r
      calculatedTax = Math.round(baseAmount * (rate / 100) * 100) / 100;
    }

    const supplierState = (options.supplierState || 'Kerala').trim().toLowerCase();
    const customerState = (options.customerState || 'Kerala').trim().toLowerCase();
    const isInterState = supplierState !== customerState;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (profile.placeOfSupplyLogic === 'inter_state_igst' || isInterState) {
      igst = calculatedTax;
    } else {
      // Intra-state split 50:50 (e.g. 5% => 2.5% CGST + 2.5% SGST)
      cgst = Math.round((calculatedTax / 2) * 100) / 100;
      sgst = Math.round((calculatedTax - cgst) * 100) / 100; // avoid rounding drift
    }

    return {
      taxableAmount: baseAmount,
      taxRatePercent: rate,
      taxAmount: calculatedTax,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalWithTax: baseAmount + calculatedTax,
      isRcm: profile.placeOfSupplyLogic === 'rcm',
      isExempt: false,
      sacHsn,
    };
  }

  /**
   * Saves or updates a tax profile
   */
  public static async saveTaxProfile(profile: TaxProfile): Promise<TaxProfile> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tax_profiles')
        .upsert({
          id: profile.id,
          name: profile.name,
          tax_type: profile.taxType,
          rate_percent: profile.ratePercent,
          applies_to: profile.appliesTo,
          place_of_supply_logic: profile.placeOfSupplyLogic,
          sac_hsn_default: profile.sacHsnDefault,
          is_inclusive: profile.isInclusive,
          notes: profile.notes,
          is_active: profile.isActive,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          taxType: data.tax_type,
          ratePercent: parseFloat(data.rate_percent),
          appliesTo: data.applies_to,
          placeOfSupplyLogic: data.place_of_supply_logic,
          sacHsnDefault: data.sac_hsn_default,
          isInclusive: data.is_inclusive,
          notes: data.notes,
          isActive: data.is_active,
        };
      }
    }

    // Local fallback
    const idx = this.localProfiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      this.localProfiles[idx] = profile;
    } else {
      this.localProfiles.push(profile);
    }
    return profile;
  }
}
