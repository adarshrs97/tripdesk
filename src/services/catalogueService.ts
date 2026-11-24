import { CatalogueItem } from '../types/catalogue';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const SEED_CATALOGUE_ITEMS: CatalogueItem[] = [
  {
    id: 'f1000000-0000-0000-0000-000000000001',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Fixed Monthly Rental (Sedan)',
    description: 'Monthly contract car rental with included km and hours',
    defaultUnit: 'month',
    defaultRate: 65000.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000002',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Airport Transfer (Trivandrum TRV)',
    description: 'One-way pickup or drop to Trivandrum International Airport',
    defaultUnit: 'trip',
    defaultRate: 1200.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000003',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'City Package (8h / 80km)',
    description: 'Trivandrum city local usage up to 8 hours and 80 km',
    defaultUnit: 'day',
    defaultRate: 2400.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000004',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Outstation Running per KM',
    description: 'Per kilometer rate for trips outside Trivandrum city limits',
    defaultUnit: 'km',
    defaultRate: 16.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000005',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Extra Hour Charges',
    description: 'Hourly detention / run charges beyond daily allowance (per minute pro-rata)',
    defaultUnit: 'hr',
    defaultRate: 150.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000006',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Night Bata Allowance',
    description: 'Driver night stay or early/late duty allowance',
    defaultUnit: 'day',
    defaultRate: 200.0,
    taxProfileId: 'e1000000-0000-0000-0000-000000000001',
    sacHsn: '996601',
    isActive: true,
  },
];

export class CatalogueService {
  private static localItems: CatalogueItem[] = [...SEED_CATALOGUE_ITEMS];

  public static async getItems(supplierId?: string): Promise<CatalogueItem[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('item_catalogue').select('*').eq('is_active', true);
        if (supplierId) {
          query = query.eq('supplier_id', supplierId);
        }
        const { data, error } = await query.order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            supplierId: d.supplier_id,
            name: d.name,
            description: d.description,
            defaultUnit: d.default_unit,
            defaultRate: parseFloat(d.default_rate),
            taxProfileId: d.tax_profile_id,
            sacHsn: d.sac_hsn,
            isActive: d.is_active,
          }));
        }
      } catch (err) {
        console.warn('Using local item catalogue cache:', err);
      }
    }

    if (supplierId) {
      return this.localItems.filter((i) => !i.supplierId || i.supplierId === supplierId);
    }
    return this.localItems;
  }

  public static async saveItem(item: CatalogueItem): Promise<CatalogueItem> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('item_catalogue')
        .upsert({
          id: item.id,
          supplier_id: item.supplierId,
          name: item.name,
          description: item.description,
          default_unit: item.defaultUnit,
          default_rate: item.defaultRate,
          tax_profile_id: item.taxProfileId,
          sac_hsn: item.sacHsn,
          is_active: item.isActive,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          supplierId: data.supplier_id,
          name: data.name,
          description: data.description,
          defaultUnit: data.default_unit,
          defaultRate: parseFloat(data.default_rate),
          taxProfileId: data.tax_profile_id,
          sacHsn: data.sac_hsn,
          isActive: data.is_active,
        };
      }
    }

    const idx = this.localItems.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      this.localItems[idx] = item;
    } else {
      this.localItems.push(item);
    }
    return item;
  }
}
