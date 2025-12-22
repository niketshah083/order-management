import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [],
  synchronize: false,
  logging: false,
});

async function seed() {
  try {
    await AppDataSource.initialize();
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();

    console.log('🧹 Cleaning tables...');
    await qr.query('SET FOREIGN_KEY_CHECKS=0');
    await qr.query('DELETE FROM purchase_order_items WHERE 1=1');
    await qr.query('DELETE FROM billings WHERE 1=1');
    await qr.query('DELETE FROM purchase_order_master WHERE 1=1');
    await qr.query('SET FOREIGN_KEY_CHECKS=1');

    const dists = await qr.query('SELECT id FROM distributor_master LIMIT 5');
    const custs = await qr.query('SELECT id FROM customers LIMIT 15');
    const itms = await qr.query('SELECT id, rate FROM item_master LIMIT 20');
    const usrs = await qr.query('SELECT id FROM user_master WHERE role="manager" LIMIT 5');

    let poCount = 0, billCount = 0;

    // Generate data for 11 months (Jan-Nov 2025)
    for (let m = 1; m <= 11; m++) {
      for (let o = 0; o < 8; o++) {
        const dist = dists[Math.floor(Math.random() * dists.length)];
        const usr = usrs[Math.floor(Math.random() * usrs.length)];
        const amt = Math.floor(Math.random() * 100000) + 20000;
        const poNo = `PO-${String(m).padStart(2,'0')}-${String(poCount).padStart(5,'0')}`;
        const dayInMonth = Math.floor(Math.random() * 28) + 1;
        const poDate = `2025-${String(m).padStart(2,'0')}-${String(dayInMonth).padStart(2,'0')}`;

        await qr.query(
          `INSERT INTO purchase_order_master (poNo, distributorId, totalAmount, status, createdBy, approvalStatus, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?)`,
          [poNo, dist.id, amt, 'DELIVERED', usr.id, 'APPROVED', poDate, poDate]
        );
        poCount++;

        // Create billing (80% of orders)
        if (Math.random() < 0.8) {
          const cust = custs[Math.floor(Math.random() * custs.length)];
          const billNo = `BILL-${String(m).padStart(2,'0')}-${String(billCount).padStart(5,'0')}`;
          const subtotal = amt * 0.92;
          const cgst = subtotal * 0.09;
          const sgst = subtotal * 0.09;
          const final = subtotal + cgst + sgst;

          await qr.query(
            `INSERT INTO billings (poNumber, customerId, billNo, subtotal, overallDiscount, cgstTotal, sgstTotal, igstTotal, finalAmount, paymentStatus, createdAt, updatedAt, items)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [poNo, cust.id, billNo, subtotal, 0, cgst, sgst, 0, final, 'pending', poDate, poDate, JSON.stringify([])]
          );
          billCount++;
        }
      }
      console.log(`✅ Month ${m}: ${8} POs`);
    }

    console.log(`\n✅ Done! Created ${poCount} POs & ${billCount} invoices`);
    await qr.release();
    process.exit(0);
  } catch (err: any) {
    console.error('❌', err?.message || err);
    process.exit(1);
  }
}

seed();
