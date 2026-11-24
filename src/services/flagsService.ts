import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  InternalFlag,
  InternalFlagInput,
  FlagEntityType,
  FlagSeverity,
} from '../engine/flags';

export class FlagsService {
  private static mockFlags: InternalFlag[] = [
    {
      id: 'f0000000-0000-0000-0000-000000000001',
      entityType: 'driver',
      entityId: 'd0000000-0000-0000-0000-000000000001', // Hemanth Kumar
      severity: 'note',
      title: 'VIP & Corporate Route Specialist',
      description: 'Fluent in Malayalam, Tamil and English. Highly rated for corporate VIP transfers and Technopark campus schedules.',
      isActive: true,
      createdBy: 'admin',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-01T09:00:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000002',
      entityType: 'vehicle',
      entityId: '10000000-0000-0000-0000-000000000001', // KL 01 CP 3284
      severity: 'caution',
      title: 'Rear AC Blower Airflow Reduced',
      description: 'Rear third-row AC vents blow warm air during noon peak sun. Service scheduled with Popular Maruti; allocate 1st and 2nd row passengers for daytime trips.',
      isActive: true,
      createdBy: 'admin',
      createdAt: '2026-08-10T14:30:00Z',
      updatedAt: '2026-08-10T14:30:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000003',
      entityType: 'customer',
      entityId: 'c0000000-0000-0000-0000-000000000001', // VTL
      severity: 'caution',
      title: 'Factory Gate Security Clearance Required',
      description: 'Kollam factory & warehouse premises require gate pass clearance 24h in advance. Driver must carry original physical Aadhaar card and wear safety shoes.',
      isActive: true,
      createdBy: 'staff',
      createdAt: '2026-08-05T11:00:00Z',
      updatedAt: '2026-08-05T11:00:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000004',
      entityType: 'vendor',
      entityId: 'v-attached-tours-001',
      severity: 'avoid',
      title: 'GPS Discrepancy on High-Range Routes',
      description: 'GPS tracker intermittently disconnects on Munnar/Wayanad hill routes. Do not dispatch on outstation corporate packages until GPS replacement confirmed.',
      isActive: true,
      createdBy: 'admin',
      createdAt: '2026-08-12T16:00:00Z',
      updatedAt: '2026-08-12T16:00:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000005',
      entityType: 'hotel',
      entityId: 'h-apollo-dimora-001',
      severity: 'note',
      title: 'Driver Parking B2 & Front Desk Meal Vouchers',
      description: 'Basement B2 reserved for taxi parking. Driver complimentary meal coupon must be collected from reception before 21:30.',
      isActive: true,
      createdBy: 'staff',
      createdAt: '2026-08-14T10:15:00Z',
      updatedAt: '2026-08-14T10:15:00Z',
    },
  ];

  /**
   * Retrieves internal flags matching optional filters.
   * Access is strictly allowed for admin and staff roles.
   */
  public static async getFlags(filters?: {
    entityType?: FlagEntityType;
    entityId?: string;
    isActive?: boolean;
    severity?: FlagSeverity;
  }): Promise<InternalFlag[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('internal_flags')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.entityType) {
          query = query.eq('entity_type', filters.entityType);
        }
        if (filters?.entityId) {
          query = query.eq('entity_id', filters.entityId);
        }
        if (filters?.isActive !== undefined) {
          query = query.eq('is_active', filters.isActive);
        }
        if (filters?.severity) {
          query = query.eq('severity', filters.severity);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const dbFlags = data.map((d: any) => ({
            id: d.id,
            entityType: d.entity_type,
            entityId: d.entity_id,
            severity: d.severity,
            title: d.title,
            description: d.description,
            isActive: d.is_active,
            createdBy: d.created_by,
            createdByUserId: d.created_by_user_id,
            resolvedBy: d.resolved_by,
            resolvedAt: d.resolved_at,
            resolutionNotes: d.resolution_notes,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          const dbIds = new Set(dbFlags.map((f: any) => f.id));
          const localUnsynced = this.mockFlags.filter(
            (f) => !f.deletedAt && !dbIds.has(f.id)
          );
          return [...dbFlags, ...localUnsynced];
        }
      } catch (err) {
        console.warn('Falling back to local mock flags:', err);
      }
    }

    return this.mockFlags.filter((f) => {
      if (f.deletedAt) return false;
      if (filters?.entityType && f.entityType !== filters.entityType) return false;
      if (filters?.entityId && f.entityId !== filters.entityId) return false;
      if (filters?.isActive !== undefined && f.isActive !== filters.isActive) return false;
      if (filters?.severity && f.severity !== filters.severity) return false;
      return true;
    });
  }

  /**
   * Retrieves active flags for a single entity
   */
  public static async getFlagsForEntity(
    entityType: FlagEntityType,
    entityId: string
  ): Promise<InternalFlag[]> {
    return this.getFlags({ entityType, entityId, isActive: true });
  }

  /**
   * Records an admin override on an 'avoid' flag with written justification
   */
  public static async overrideAvoidFlag(
    flagId: string,
    reason: string,
    overriddenBy: string
  ): Promise<InternalFlag> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('internal_flags')
          .update({
            admin_override_reason: reason,
            overridden_by: overriddenBy,
            overridden_at: now,
            updated_at: now,
          })
          .eq('id', flagId)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            entityType: data.entity_type,
            entityId: data.entity_id,
            severity: data.severity,
            title: data.title,
            description: data.description,
            isActive: data.is_active,
            createdBy: data.created_by,
            createdByUserId: data.created_by_user_id,
            resolvedBy: data.resolved_by,
            resolvedAt: data.resolved_at,
            resolutionNotes: data.resolution_notes,
            adminOverrideReason: data.admin_override_reason,
            overriddenBy: data.overridden_by,
            overriddenAt: data.overridden_at,
            deletedAt: data.deleted_at,
            deletedBy: data.deleted_by,
            retentionMonths: data.retention_months,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Fallback overriding local flag:', err);
      }
    }

    const flag = this.mockFlags.find((f) => f.id === flagId);
    if (flag) {
      flag.adminOverrideReason = reason;
      flag.overriddenBy = overriddenBy;
      flag.overriddenAt = now;
      flag.updatedAt = now;
      return flag;
    }
    throw new Error(`Flag with id ${flagId} not found`);
  }

  /**
   * Soft-deletes an internal flag (Admin only). Rows are NEVER physically destroyed.
   */
  public static async deleteFlag(id: string, deletedBy: string = 'admin'): Promise<boolean> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('internal_flags')
          .update({
            deleted_at: now,
            deleted_by: deletedBy,
            is_active: false,
            updated_at: now,
          })
          .eq('id', id);

        if (!error) return true;
      } catch (err) {
        console.warn('Fallback soft-deleting local flag:', err);
      }
    }

    const flag = this.mockFlags.find((f) => f.id === id);
    if (flag) {
      flag.deletedAt = now;
      flag.deletedBy = deletedBy;
      flag.isActive = false;
      flag.updatedAt = now;
      return true;
    }
    return false;
  }

  public static async createFlag(input: InternalFlagInput): Promise<InternalFlag> {
    const newFlag: InternalFlag = {
      id: crypto.randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      severity: input.severity,
      title: input.title,
      description: input.description,
      isActive: true,
      createdBy: input.createdBy || 'staff',
      createdByUserId: input.createdByUserId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('internal_flags')
          .insert({
            id: newFlag.id,
            entity_type: newFlag.entityType,
            entity_id: newFlag.entityId,
            severity: newFlag.severity,
            title: newFlag.title,
            description: newFlag.description,
            is_active: true,
            created_by: newFlag.createdBy,
            created_by_user_id: newFlag.createdByUserId,
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            entityType: data.entity_type,
            entityId: data.entity_id,
            severity: data.severity,
            title: data.title,
            description: data.description,
            isActive: data.is_active,
            createdBy: data.created_by,
            createdByUserId: data.created_by_user_id,
            resolvedBy: data.resolved_by,
            resolvedAt: data.resolved_at,
            resolutionNotes: data.resolution_notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Fallback saving local flag:', err);
      }
    }

    this.mockFlags.unshift(newFlag);
    return newFlag;
  }

  /**
   * Resolves an internal flag
   */
  public static async resolveFlag(
    id: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<InternalFlag> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('internal_flags')
          .update({
            is_active: false,
            resolved_by: resolvedBy,
            resolved_at: now,
            resolution_notes: resolutionNotes || null,
            updated_at: now,
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            entityType: data.entity_type,
            entityId: data.entity_id,
            severity: data.severity,
            title: data.title,
            description: data.description,
            isActive: data.is_active,
            createdBy: data.created_by,
            createdByUserId: data.created_by_user_id,
            resolvedBy: data.resolved_by,
            resolvedAt: data.resolved_at,
            resolutionNotes: data.resolution_notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Fallback resolving local flag:', err);
      }
    }

    const flag = this.mockFlags.find((f) => f.id === id);
    if (flag) {
      flag.isActive = false;
      flag.resolvedBy = resolvedBy;
      flag.resolvedAt = now;
      flag.resolutionNotes = resolutionNotes || null;
      flag.updatedAt = now;
      return flag;
    }
    throw new Error(`Flag with id ${id} not found`);
  }


}
