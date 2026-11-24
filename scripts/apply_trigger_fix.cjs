const { Client } = require('pg');

const sql = `
CREATE OR REPLACE FUNCTION trg_check_trip_ledger_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.is_locked = TRUE) THEN
      RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be deleted.', OLD.trip_date, OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.is_locked = TRUE) THEN
    IF (NEW.is_locked = FALSE AND NEW.invoice_id IS NULL) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be modified.', OLD.trip_date, OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const targets = [
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test' },
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'starciti' },
  { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'test' },
  { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres' },
];

(async () => {
  for (const t of targets) {
    try {
      const c = new Client(t);
      await c.connect();
      await c.query(sql);
      const del = await c.query("DELETE FROM trip_ledger WHERE remarks LIKE 'BENCH%'");
      const cnt = await c.query('SELECT COUNT(*) FROM trip_ledger');
      console.log('Fixed trigger and cleaned', t.port, t.database, 'Deleted:', del.rowCount, 'Remaining:', cnt.rows[0].count);
      await c.end();
    } catch (e) {
      console.log('Error for', t.port, t.database, e.message);
    }
  }
})();
