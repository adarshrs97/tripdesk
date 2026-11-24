const { Client } = require('pg');
const crypto = require('crypto');

const contractId = 'b0000000-0000-0000-0000-000000000001';
const customerId = 'c0000000-0000-0000-0000-000000000001';
const vtlVehId = '10000000-0000-0000-0000-000000000001';
const subVehId = '10000000-0000-0000-0000-000000000003';
const hemanthDriverId = 'd0000000-0000-0000-0000-000000000001';
const afzalDriverId = 'd0000000-0000-0000-0000-000000000004';

// 31 days data exact from Aug sheet
const rows = [
  { day: 1, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 155622, clKm: 155670, usedKm: 48, stT: '05:00', clT: '18:00', dur: 780, nb: true, ob: false, permit: 0, rem: 'Kachani, Airport (AVP)' },
  { day: 2, status: 'SUNDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: null },
  { day: 3, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 155705, clKm: 155823, usedKm: 118, stT: '06:15', clT: '19:30', dur: 795, nb: false, ob: false, permit: 0, rem: 'Kattakada KSEB' },
  { day: 4, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 155833, clKm: 155881, usedKm: 48, stT: '08:45', clT: '20:00', dur: 675, nb: false, ob: false, permit: 0, rem: 'Site Trips' },
  { day: 5, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 155888, clKm: 156103, usedKm: 215, stT: '08:30', clT: '21:30', dur: 780, nb: false, ob: true, permit: 600, rem: 'Premit Kaushel Kanyakumari' },
  { day: 6, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156110, clKm: 156184, usedKm: 74, stT: '08:30', clT: '20:00', dur: 690, nb: false, ob: false, permit: 0, rem: 'Kattakada' },
  { day: 7, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156190, clKm: 156233, usedKm: 43, stT: '09:00', clT: '21:00', dur: 720, nb: false, ob: false, permit: 0, rem: 'P.H + V.B Trips' },
  { day: 8, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156239, clKm: 156285, usedKm: 46, stT: '08:45', clT: '18:30', dur: 585, nb: false, ob: false, permit: 0, rem: 'Kachani' },
  { day: 9, status: 'SUNDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: null },
  { day: 10, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156300, clKm: 156354, usedKm: 54, stT: '08:45', clT: '19:00', dur: 615, nb: false, ob: false, permit: 0, rem: 'VB, CE' },
  { day: 11, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156363, clKm: 156388, usedKm: 25, stT: '08:45', clT: '19:00', dur: 615, nb: false, ob: false, permit: 0, rem: 'VB, CE' },
  { day: 12, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156395, clKm: 156465, usedKm: 70, stT: '09:00', clT: '18:30', dur: 570, nb: false, ob: false, permit: 0, rem: 'Kachani, Airport VP' },
  { day: 13, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156472, clKm: 156505, usedKm: 33, stT: '08:30', clT: '19:00', dur: 630, nb: false, ob: false, permit: 0, rem: 'VB, CE' },
  { day: 14, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156510, clKm: 156565, usedKm: 55, stT: '09:00', clT: '19:00', dur: 600, nb: false, ob: false, permit: 0, rem: 'VP trips' },
  { day: 15, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156570, clKm: 156578, usedKm: 8, stT: '10:15', clT: '13:00', dur: 165, nb: false, ob: false, permit: 0, rem: 'Guest House' },
  { day: 16, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156632, clKm: 156829, usedKm: 197, stT: '08:00', clT: '20:30', dur: 750, nb: false, ob: true, permit: 600, rem: 'Premit Kanyakumari' },
  { day: 17, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156840, clKm: 156874, usedKm: 34, stT: '09:00', clT: '19:00', dur: 600, nb: false, ob: false, permit: 0, rem: null },
  { day: 18, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156880, clKm: 156905, usedKm: 25, stT: '08:45', clT: '19:00', dur: 615, nb: false, ob: false, permit: 0, rem: null },
  { day: 19, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 156911, clKm: 157101, usedKm: 190, stT: '09:00', clT: '22:00', dur: 780, nb: false, ob: true, permit: 0, rem: 'Kollam' },
  { day: 20, status: 'SUBSTITUTE', vId: subVehId, dId: afzalDriverId, stKm: 41834, clKm: 41884, usedKm: 50, stT: '09:00', clT: '18:00', dur: 540, nb: false, ob: false, permit: 0, rem: 'AVP Trips' },
  { day: 21, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157107, clKm: 157190, usedKm: 83, stT: '09:00', clT: '20:30', dur: 690, nb: false, ob: false, permit: 0, rem: 'AVP Trips' },
  { day: 22, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157197, clKm: 157338, usedKm: 141, stT: '05:00', clT: '20:30', dur: 930, nb: true, ob: false, permit: 0, rem: 'Kattakada' },
  { day: 23, status: 'SUNDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: null },
  { day: 24, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157344, clKm: 157437, usedKm: 93, stT: '07:00', clT: '18:00', dur: 660, nb: false, ob: false, permit: 0, rem: null },
  { day: 25, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157438, clKm: 157490, usedKm: 52, stT: '08:00', clT: '12:00', dur: 240, nb: false, ob: false, permit: 0, rem: null },
  { day: 26, status: 'HOLIDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: 'ONAM' },
  { day: 27, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157497, clKm: 157519, usedKm: 22, stT: '09:00', clT: '18:00', dur: 540, nb: false, ob: false, permit: 0, rem: null },
  { day: 28, status: 'HOLIDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: 'ONAM' },
  { day: 29, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157580, clKm: 157633, usedKm: 53, stT: '09:00', clT: '18:00', dur: 540, nb: false, ob: false, permit: 0, rem: 'AVP Trips' },
  { day: 30, status: 'SUNDAY', vId: null, dId: null, stKm: null, clKm: null, usedKm: 0, stT: null, clT: null, dur: null, nb: false, ob: false, permit: 0, rem: null },
  { day: 31, status: 'RUN', vId: vtlVehId, dId: hemanthDriverId, stKm: 157641, clKm: 157748, usedKm: 107, stT: '08:30', clT: '22:00', dur: 810, nb: false, ob: false, permit: 0, rem: null }
];

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5439/starciti' });
  await client.connect();

  await client.query('ALTER TABLE trip_ledger DISABLE TRIGGER ALL;');
  await client.query('DELETE FROM trip_ledger WHERE contract_id = $1;', [contractId]);

  for (const r of rows) {
    const dStr = '2026-08-' + String(r.day).padStart(2, '0');
    await client.query(`
      INSERT INTO trip_ledger (
        contract_id, vehicle_id, driver_id, trip_date, day_status,
        start_km, close_km, used_km, start_time, close_time, duration_minutes,
        night_bata, outstation_bata, permit_amount, remarks, extra
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
    `, [
      contractId, r.vId, r.dId, dStr, r.status,
      r.stKm, r.clKm, r.usedKm, r.stT, r.clT, r.dur,
      r.nb, r.ob, r.permit, r.rem, JSON.stringify({ verifiedFromXlsx: true })
    ]);
  }
  console.log('Successfully seeded 31 trip_ledger rows into starciti_postgres!');

  // Seed approval record with 128-bit token hash
  const rawToken = 'vtl-aug26-7f8a9b1c2d3e4f5a6b7c8d9e'; // 128-bit hex
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  await client.query('DELETE FROM approvals WHERE contract_id = $1 AND year_month = $2;', [contractId, '2026-08']);
  await client.query(`
    INSERT INTO approvals (
      contract_id, customer_id, year_month, token_hash, status, expires_at, is_revoked
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
  `, [contractId, customerId, '2026-08', tokenHash, 'pending_approval', expiresAt, false]);

  await client.query('ALTER TABLE trip_ledger ENABLE TRIGGER ALL;');
  console.log('Seeded approvals table with token_hash:', tokenHash);
  await client.end();
}

main().catch(err => {
  console.error('Error in seed:', err);
  process.exit(1);
});
