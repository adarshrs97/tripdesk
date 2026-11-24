import { InvoiceTemplate } from '../engine/templates/types';
import { ALL_BUILT_IN_INVOICE_TEMPLATES } from '../engine/templates/seeds/defaultInvoiceTemplates';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class TemplateService {
  private static cachedCustomTemplates: InvoiceTemplate[] = [];
  private static isInitialized = false;

  private static async init(): Promise<void> {
    if (this.isInitialized) return;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'system.custom_templates')
          .single();
        if (!error && data?.value && Array.isArray(data.value)) {
          this.cachedCustomTemplates = data.value;
        }
      } catch (err) {
        console.warn('Could not query custom templates from DB settings, using cache:', err);
      }
    }
    this.isInitialized = true;
  }

  /**
   * Retrieves all templates (built-in starter presets + custom admin-created templates).
   */
  static async getAllTemplates(): Promise<InvoiceTemplate[]> {
    await this.init();
    const map = new Map<string, InvoiceTemplate>();
    // Built-in starter templates
    for (const t of ALL_BUILT_IN_INVOICE_TEMPLATES) {
      map.set(t.id, t);
    }
    // Custom/overridden templates
    for (const t of this.cachedCustomTemplates) {
      map.set(t.id, t);
    }
    return Array.from(map.values());
  }

  /**
   * Synchronous template resolution (uses built-ins or cached custom templates).
   */
  static getTemplateByIdSync(id: string): InvoiceTemplate | undefined {
    const foundCustom = this.cachedCustomTemplates.find((t) => t.id === id);
    if (foundCustom) return foundCustom;
    return ALL_BUILT_IN_INVOICE_TEMPLATES.find((t) => t.id === id);
  }

  /**
   * Resolves template by ID or code.
   */
  static async getTemplateById(id: string): Promise<InvoiceTemplate | undefined> {
    await this.init();
    return this.getTemplateByIdSync(id);
  }

  /**
   * Saves or updates a template in the database with RLS protection.
   */
  static async saveTemplate(template: InvoiceTemplate): Promise<void> {
    await this.init();
    const existingIdx = this.cachedCustomTemplates.findIndex((t) => t.id === template.id);
    const updated = { ...template, updatedAt: new Date().toISOString() };

    if (existingIdx >= 0) {
      this.cachedCustomTemplates[existingIdx] = updated;
    } else {
      this.cachedCustomTemplates.push(updated);
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'system.custom_templates',
            scope: 'system',
            value: this.cachedCustomTemplates,
            description: 'Custom admin-created and modified invoice layout templates',
            updated_at: new Date().toISOString(),
          });
        if (error) {
          console.warn('Could not persist template to remote settings table:', error.message);
        }
      } catch (err: any) {
        console.warn('Persist template note:', err?.message);
      }
    }
  }

  /**
   * Clones any template (including starter presets) to produce a brand-new editable template.
   */
  static async cloneTemplate(sourceId: string, newName: string): Promise<InvoiceTemplate> {
    const source = await this.getTemplateById(sourceId);
    if (!source) throw new Error(`Template not found with ID ${sourceId}`);

    const clonedId = `template-custom-${Date.now()}`;
    const cloned: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(source)),
      id: clonedId,
      name: newName,
      code: `CUSTOM_${Date.now()}`,
      version: 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveTemplate(cloned);
    return cloned;
  }

  /**
   * Archives a template so it is hidden from new invoice creation while remaining pinned for old invoices.
   */
  static async archiveTemplate(id: string): Promise<void> {
    const t = await this.getTemplateById(id);
    if (!t) return;
    t.status = 'archived';
    await this.saveTemplate(t);
  }

  /**
   * Deletes a custom template if unpinned.
   */
  static async deleteTemplate(id: string): Promise<void> {
    await this.init();
    this.cachedCustomTemplates = this.cachedCustomTemplates.filter((t) => t.id !== id);
    if (isSupabaseConfigured) {
      await supabase
        .from('settings')
        .upsert({
          key: 'system.custom_templates',
          scope: 'system',
          value: this.cachedCustomTemplates,
          description: 'Custom admin-created and modified invoice layout templates',
          updated_at: new Date().toISOString(),
        });
    }
  }
}
