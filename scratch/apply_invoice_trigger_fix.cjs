const { Client } = require('pg');

const databases = [
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test' },
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'starciti' },
  { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres' },
];

const sql = `
CREATE OR REPLACE FUNCTION trg_check_invoice_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.locked_at IS NOT NULL OR OLD.status != 'draft') THEN
      RAISE EXCEPTION 'Invoice % is permanently locked and cannot be deleted. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND (OLD.locked_at IS NOT NULL OR OLD.status != 'draft')) THEN
    IF (OLD.invoice_number != NEW.invoice_number OR
        OLD.total_amount != NEW.total_amount OR
        OLD.supplier_id != NEW.supplier_id OR
        OLD.customer_id != NEW.customer_id OR
        OLD.contract_id != NEW.contract_id OR
        OLD.period_from != NEW.period_from OR
        OLD.period_to != NEW.period_to) THEN
      RAISE EXCEPTION 'Invoice % is permanently locked and cannot be modified: Core financial facts (number, amount, customer, supplier, contract, billing period) cannot be changed.', OLD.invoice_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_lock_guard ON invoices;
CREATE TRIGGER trg_invoice_lock_guard
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION trg_check_invoice_locked();
`;

async function apply() {
  for (const cfg of databases) {
    try {
      const client = new Client(cfg);
      await client.connect();
      await client.query(sql);
      console.log(`Applied updated trg_check_invoice_locked to ${cfg.port}/${cfg.database}`);
      await client.end();
    } catch (e) {
      console.log(`Could not connect to ${cfg.port}/${cfg.database}: ${e.message}`);
    }
  }
}

apply();
