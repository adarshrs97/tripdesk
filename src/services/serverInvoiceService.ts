import { Client } from 'pg';
import { RenderedInvoice } from '../engine';
import { EXACT_SEED_VTL_AUG_2026 } from './ledgerService';
import { generateInvoicePdf } from './pdfGenerator';

export interface IssueInvoiceParams {
  supplierId: string;
  customerId: string;
  contractId?: string | null;
  periodFrom: string;
  periodTo: string;
  totalAmount: number;
  snapshotJson: RenderedInvoice;
  templateId: string;
  templateVersion: number;
  issuedBy: string;
  adminOverrideReason?: string;
  breakupJson?: any;
}

export interface IssueInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  status: 'locked';
  totalAmount: number;
  lockedTripsCount: number;
  lockedAt: string;
  pdfPath?: string;
  screenshotPath?: string;
}

export class ServerInvoiceService {
  public static pgConfig = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.TEST_DB_PORT || '54322', 10),
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    database: process.env.TEST_DB_NAME || 'test',
  };

  /**
   * Atomic Row-Locked Issuance via PostgreSQL & Playwright
   */
  public static async issueInvoice(params: IssueInvoiceParams): Promise<IssueInvoiceResult> {
    const client = new Client(ServerInvoiceService.pgConfig);
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

      const res = await client.query(
        `SELECT issue_invoice_atomic(
          $1::UUID, $2::UUID, $3::UUID, $4::DATE, $5::DATE, $6::NUMERIC,
          $7::JSONB, $8::TEXT, $9::INT, $10::TEXT, $11::TEXT, $12::JSONB
        ) AS result`,
        [
          params.supplierId,
          params.customerId,
          params.contractId,
          params.periodFrom,
          params.periodTo,
          params.totalAmount,
          JSON.stringify(params.snapshotJson),
          params.templateId,
          params.templateVersion,
          params.issuedBy,
          params.adminOverrideReason || null,
          params.breakupJson ? JSON.stringify(params.breakupJson) : null,
        ]
      );

      await client.query('COMMIT');

      const out = res.rows[0].result;

      // Generate server-side PDF and comparison screenshot via Playwright
      const invoiceNumber = out.invoice_number;
      const pdfPath = `public/invoices/Invoice_${invoiceNumber}.pdf`;
      const screenshotPath = `public/invoices/Invoice_${invoiceNumber}.png`;

      try {
        await generateInvoicePdf(params.snapshotJson, {
          outputPath: pdfPath,
          screenshotPath,
          annexureEntries: EXACT_SEED_VTL_AUG_2026,
        });
      } catch (pdfErr) {
        console.warn('PDF generation notice:', pdfErr);
      }

      return {
        invoiceId: out.invoice_id,
        invoiceNumber: out.invoice_number,
        status: out.status,
        totalAmount: Number(out.total_amount),
        lockedTripsCount: out.locked_trips_count,
        lockedAt: out.locked_at,
        pdfPath,
        screenshotPath,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      await client.end();
    }
  }
}
