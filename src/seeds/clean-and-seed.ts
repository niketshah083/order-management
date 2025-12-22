import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'oms-qa',
  entities: [],
  synchronize: false,
  logging: false,
});

const STATUSES = ['PENDING', 'CONFIRMED', 'DELIVERED'];
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

function getRandomDate(month: number): string {
  const maxDays = new Date(2025, month + 1, 0).getDate();
  const day = Math.floor(Math.random() * maxDays) + 1;
  const date = new Date(2025, month, day);
  return date.toISOString().split('T')[0];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedData() {
  try {
    await AppDataSource.initialize();
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();

    console.log('🧹 Cleaning old data...');
    await qr.query('SET FOREIGN_KEY_CHECKS=0');
    await qr.query('TRUNCATE TABLE purchase_order_items');
    await qr.query('TRUNCATE TABLE payment_requests');
    await qr.query('TRUNCATE TABLE billings');
    await qr.query('TRUNCATE TABLE purchase_order_master');
    await qr.query('TRUNCATE TABLE returns_purchase');
    await qr.query('TRUNCATE TABLE returns_sales');
    await qr.query('SET FOREIGN_KEY_CHECKS=1');

    const distributors = await qr.query('SELECT id FROM distributor_master LIMIT 5');
    const customers = await qr.query('SELECT id FROM customers LIMIT 15');
    const items = await qr.query('SELECT id, rate FROM item_master LIMIT 30');
    const users = await qr.query('SELECT id FROM user_master WHERE role IN ("manager", "super_admin") LIMIT 5');

    console.log(`📊 Found: ${distributors.length} distributors, ${customers.length} customers, ${items.length} items, ${users.length} users`);

    let poCount = 0, invoiceCount = 0;

    // Generate 8 POs per month
    for (let month = 0; month < 11; month++) {
      for (let orderIdx = 0; orderIdx < 8; orderIdx++) {
        const distributor = distributors[getRandomNumber(0, distributors.length - 1)];
        const user = users[getRandomNumber(0, users.length - 1)];
        const poDate = getRandomDate(month);
        const totalAmount = getRandomNumber(15000, 150000);
        const poNo = `PO-${String(month + 1).padStart(2, '0')}-${String(poCount++).padStart(5, '0')}`;

        await qr.query(
          `INSERT INTO purchase_order_master (poNo, distributorId, totalAmount, status, createdBy, approvalStatus, createdAt, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [poNo, distributor.id, totalAmount, STATUSES[getRandomNumber(0, 2)], user.id, APPROVAL_STATUSES[getRandomNumber(0, 2)], poDate, poDate]
        );

        const [poResult] = await qr.query(`SELECT id FROM purchase_order_master WHERE poNo = ?`, [poNo]);
        if (!poResult) continue;

        // Create invoice (75% chance)
        if (Math.random() > 0.25) {
          const customer = customers[getRandomNumber(0, customers.length - 1)];
          const billNo = `BILL-${String(month + 1).padStart(2, '0')}-${String(invoiceCount++).padStart(5, '0')}`;
          const items_json = JSON.stringify([{ itemName: 'Product Item', quantity: getRandomNumber(5, 50), totalAmount: totalAmount * 0.9 }]);
          
          await qr.query(
            `INSERT INTO billings (poNumber, customerId, billNo, subtotal, overallDiscount, cgstTotal, sgstTotal, igstTotal, finalAmount, paymentStatus, createdAt, updatedAt, items) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [poNo, customer.id, billNo, totalAmount * 0.85, totalAmount * 0.05, totalAmount * 0.045, totalAmount * 0.045, 0, totalAmount, 'pending', poDate, poDate, items_json]
          );
        }
      }
      console.log(`✅ Month ${month + 1}: Created records`);
    }

    console.log(`\n✅ Seeding complete! Created ${poCount} POs and ${invoiceCount} invoices`);
    await qr.release();
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error?.message || error);
    process.exit(1);
  }
}

seedData();
