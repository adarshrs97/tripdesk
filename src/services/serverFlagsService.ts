import { Client } from 'pg';
import { InternalFlag, InternalFlagInput, FlagEntityType, FlagSeverity } from '../engine/flags';
import { TEST_PG_CONFIG } from '../test/testDbHelper';

export class ServerFlagsService {
  public static pgConfig = {
    host: TEST_PG_CONFIG.host as string,
    port: TEST_PG_CONFIG.port as number,
    user: TEST_PG_CONFIG.user as string,
    password: TEST_PG_CONFIG.password as string,
    database: 'test',
  };

  /**
   * Helper to execute queries under a specific Supabase JWT user context
   */
  public static async queryWithUser(
    userId: string | null,
    sql: string,
    params: any[] = []
  ): Promise<any> {
    const client = new Client(this.pgConfig);
    await client.connect();

    try {
      await client.query('SET ROLE starciti_app');
      if (userId) {
        await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', false);`);
      } else {
        await client.query(`SELECT set_config('request.jwt.claims', '', false);`);
      }

      return await client.query(sql, params);
    } finally {
      await client.end();
    }
  }

  /**
   * Retrieves flags from database
   */
  public static async getFlags(
    userId: string | null = null,
    filters?: {
      entityType?: FlagEntityType;
      entityId?: string;
      isActive?: boolean;
      severity?: FlagSeverity;
    }
  ): Promise<InternalFlag[]> {
    let whereClauses = ['deleted_at IS NULL'];
    const params: any[] = [];
    let pIdx = 1;

    if (filters?.entityType) {
      whereClauses.push(`entity_type = $${pIdx++}`);
      params.push(filters.entityType);
    }
    if (filters?.entityId) {
      whereClauses.push(`entity_id = $${pIdx++}`);
      params.push(filters.entityId);
    }
    if (filters?.isActive !== undefined) {
      whereClauses.push(`is_active = $${pIdx++}`);
      params.push(filters.isActive);
    }
    if (filters?.severity) {
      whereClauses.push(`severity = $${pIdx++}`);
      params.push(filters.severity);
    }

    const sql = `SELECT * FROM internal_flags WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC`;
    const res = await this.queryWithUser(userId, sql, params);

    return res.rows.map((r: any) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      severity: r.severity,
      title: r.title,
      description: r.description,
      isActive: r.is_active,
      createdBy: r.created_by,
      createdByUserId: r.created_by_user_id,
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at,
      resolutionNotes: r.resolution_notes,
      adminOverrideReason: r.admin_override_reason,
      overriddenBy: r.overridden_by,
      overriddenAt: r.overridden_at,
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by,
      retentionMonths: r.retention_months,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Overrides an 'avoid' flag with an administrator written justification
   */
  public static async overrideAvoidFlag(
    userId: string | null,
    flagId: string,
    reason: string,
    overriddenBy: string
  ): Promise<boolean> {
    const sql = `
      UPDATE internal_flags 
      SET admin_override_reason = $1, overridden_by = $2, overridden_at = NOW(), updated_at = NOW() 
      WHERE id = $3 AND deleted_at IS NULL
    `;
    const res = await this.queryWithUser(userId, sql, [reason, overriddenBy, flagId]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Inserts an internal flag under user context
   */
  public static async createFlag(
    userId: string | null,
    input: InternalFlagInput
  ): Promise<InternalFlag> {
    const recordId = crypto.randomUUID();
    const sql = `
      INSERT INTO internal_flags (
        id, entity_type, entity_id, severity, title, description, is_active, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
      RETURNING *;
    `;
    const res = await this.queryWithUser(userId, sql, [
      recordId,
      input.entityType,
      input.entityId,
      input.severity,
      input.title,
      input.description,
      userId,
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      severity: r.severity,
      title: r.title,
      description: r.description,
      isActive: r.is_active,
      createdBy: r.created_by,
      createdByUserId: r.created_by_user_id,
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at,
      resolutionNotes: r.resolution_notes,
      adminOverrideReason: r.admin_override_reason,
      overriddenBy: r.overridden_by,
      overriddenAt: r.overridden_at,
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by,
      retentionMonths: r.retention_months,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Soft-deletes a flag (Admin only). Rows are never physically destroyed.
   */
  public static async deleteFlag(userId: string | null, flagId: string): Promise<boolean> {
    try {
      const res = await this.queryWithUser(
        userId,
        `SELECT soft_delete_internal_flag($1)`,
        [flagId]
      );
      return res.rows[0]?.soft_delete_internal_flag === true;
    } catch {
      return false;
    }
  }
}
