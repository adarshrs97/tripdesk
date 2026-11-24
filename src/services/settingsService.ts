import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface VocabularyItem {
  key: string;
  english: string;
  malayalam: string;
}

export interface SetupState {
  completed: boolean;
  completed_at: string | null;
  admin_email: string | null;
}

export interface TariffRateItem {
  baseKm: number;
  baseHours: number;
  baseAmount: number;
  extraKmRate: number;
  extraHourRate: number;
  bataPerDay: number;
  nightBata: number;
}

export type QuoteTariffsMap = Record<string, Record<string, TariffRateItem>>;

export const DEFAULT_OFFICE_VOCABULARY: VocabularyItem[] = [
  { key: 'trip', english: 'Trip / Duty', malayalam: 'യാത്ര' },
  { key: 'vehicle', english: 'Vehicle', malayalam: 'വാഹനം' },
  { key: 'driver', english: 'Driver', malayalam: 'ഡ്രൈവർ' },
  { key: 'customer', english: 'Customer / Client', malayalam: 'കസ്റ്റമർ' },
  { key: 'invoice', english: 'Invoice / Bill', malayalam: 'ഇൻവോയ്സ്' },
  { key: 'fuel', english: 'Fuel / Diesel', malayalam: 'ഇന്ധനം / ഡീസൽ' },
  { key: 'advance', english: 'Advance Payment', malayalam: 'അഡ്വാൻസ്' },
  { key: 'bata', english: 'Driver Bata', malayalam: 'ഡ്രൈവർ ബത്ത' },
  { key: 'opening_km', english: 'Opening KM', malayalam: 'ആരംഭ കി.മീ' },
  { key: 'closing_km', english: 'Closing KM', malayalam: 'അവസാന കി.മീ' },
  { key: 'hours', english: 'Total Hours', malayalam: 'മണിക്കൂർ' },
  { key: 'toll_parking', english: 'Toll & Parking', malayalam: 'ടോൾ / പാർക്കിംഗ്' },
];

export class SettingsService {
  private static cachedVocabulary: VocabularyItem[] = [...DEFAULT_OFFICE_VOCABULARY];
  private static cachedTariffs: QuoteTariffsMap = {};
  private static cachedSetupState: SetupState = {
    completed: false,
    completed_at: null,
    admin_email: null,
  };

  /**
   * Reads shared vocabulary from the database settings table.
   * RLS allows all roles (admin, staff, driver, customer) to read.
   */
  static async getVocabulary(): Promise<VocabularyItem[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'system.vocabulary')
          .single();

        if (!error && data?.value && Array.isArray(data.value)) {
          this.cachedVocabulary = data.value;
          return data.value;
        }
      } catch (err) {
        console.warn('Failed to load vocabulary from DB, using fallback cache:', err);
      }
    }
    return this.cachedVocabulary;
  }

  /**
   * Updates shared vocabulary in the database settings table.
   * RLS strictly enforces that only administrators can modify settings.
   */
  static async saveVocabulary(vocab: VocabularyItem[]): Promise<void> {
    this.cachedVocabulary = vocab;
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'system.vocabulary',
          scope: 'system',
          value: vocab,
          description: 'Shared English and Malayalam operational labels stored in database with RLS',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Database error saving vocabulary: ${error.message}`);
      }
    }
  }

  /**
   * Retrieves configured quote tariff rates. Starts completely empty (no seeded numbers).
   */
  static async getQuoteTariffs(): Promise<QuoteTariffsMap> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'system.quote_tariffs')
          .single();

        if (!error && data?.value && typeof data.value === 'object') {
          this.cachedTariffs = data.value;
          return data.value;
        }
      } catch (err) {
        console.warn('Failed to load quote tariffs from DB:', err);
      }
    }
    return this.cachedTariffs;
  }

  /**
   * Saves configured quote tariff rates in the database settings table (Admin only).
   */
  static async saveQuoteTariffs(tariffs: QuoteTariffsMap): Promise<void> {
    this.cachedTariffs = tariffs;
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'system.quote_tariffs',
          scope: 'operations',
          value: tariffs,
          description: 'Configured quote tariff rates per vehicle category and tariff model',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Database error saving quote tariffs: ${error.message}`);
      }
    }
  }

  /**
   * Retrieves the first-run wizard setup state from the database.
   * Stored in settings table key 'system.setup_state'.
   */
  static async getSetupState(): Promise<SetupState> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'system.setup_state')
          .single();

        if (!error && data?.value) {
          const val = data.value as SetupState;
          this.cachedSetupState = val;
          return val;
        }
      } catch (err) {
        console.warn('Failed to load setup state from DB:', err);
      }
    }
    return this.cachedSetupState;
  }

  /**
   * Permanently marks the first-run setup wizard as completed in the database.
   * Once locked, the wizard cannot be re-run on any device.
   */
  static async completeSetup(adminEmail: string): Promise<SetupState> {
    const updatedState: SetupState = {
      completed: true,
      completed_at: new Date().toISOString(),
      admin_email: adminEmail,
    };
    this.cachedSetupState = updatedState;

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'system.setup_state',
          scope: 'system',
          value: updatedState,
          description: 'Permanent lock state for the first-run setup wizard',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Failed to lock setup state in database: ${error.message}`);
      }
    }

    return updatedState;
  }
}
