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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'];
const REASONS = ['Defective item', 'Quality issue', 'Wrong shipment', 'Customer request', 'Damage in transit'];
const STATUSES = ['PENDING', 'CONFIRMED', 'DELIVERED'];
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const PO_STATUSES = ['pending', 'partial', 'completed'];

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
    console.log('✅ Database connected!');
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // Fetch existing IDs
    const distributors = await queryRunner.query('SELECT id, userId FROM distributor_master LIMIT 10');
    const customers = await queryRunner.query('SELECT id FROM customers LIMIT 20');
    const items = await queryRunner.query('SELECT id, rate FROM item_master LIMIT 30');
    const users = await queryRunner.query('SELECT id FROM user_master WHERE role IN ("manager", "super_admin") LIMIT 10');

    if (!distributors.length || !customers.length || !items.length || !users.length) {
      console.log('❌ Missing required base data. Ensure users, distributors, customers, and items exist first.');
      await queryRunner.release();
      await AppDataSource.destroy();
      process.exit(1);
    }

    console.log(`📊 Found: ${distributors.length} distributors, ${customers.length} customers, ${items.length} items`);

    let poCount = 0;
    let invoiceCount = 0;
    let prCount = 0;
    let srCount = 0;

    for (let month = 0; month < 11; month++) {
      console.log(`\n📅 ${MONTHS[month]} 2025...`);

      // Generate 15 POs per month
      for (let orderIdx = 0; orderIdx < 15; orderIdx++) {
        const distributor = distributors[getRandomNumber(0, distributors.length - 1)];
        const user = users[getRandomNumber(0, users.length - 1)];
        const poDate = getRandomDate(month);
        const totalAmount = getRandomNumber(10000, 100000);
        const poNo = `PO-${String(month + 1).padStart(2, '0')}-${String(orderIdx).padStart(5, '0')}`;

        // Insert PO
        await queryRunner.query(
          `INSERT INTO purchase_order_master (poNo, distributorId, totalAmount, status, createdBy, approvalStatus, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poNo,
            distributor.id,
            totalAmount,
            STATUSES[getRandomNumber(0, 2)],
            user.id,
            APPROVAL_STATUSES[getRandomNumber(0, 2)],
            poDate,
            poDate,
          ],
        );
        poCount++;

        // Get the PO ID
        const [poResult] = await queryRunner.query(`SELECT id FROM purchase_order_master WHERE poNo = ?`, [poNo]);
        if (!poResult) continue;

        const poId = poResult.id;

        // Add 3-5 items to the PO
        for (let itemIdx = 0; itemIdx < getRandomNumber(3, 5); itemIdx++) {
          const item = items[getRandomNumber(0, items.length - 1)];
          const quantity = getRandomNumber(10, 100);
          const unitPrice = item.rate || getRandomNumber(500, 5000);

          await queryRunner.query(
            `INSERT INTO purchase_order_items (purchaseOrderId, itemId, quantity, unitPrice)
             VALUES (?, ?, ?, ?)`,
            [poId, item.id, quantity, unitPrice],
          );
        }

        // Create invoice (70% chance)
        if (Math.random() > 0.3) {
          const customer = customers[getRandomNumber(0, customers.length - 1)];
          const billDate = poDate;
          const billNo = `BILL-${String(month + 1).padStart(2, '0')}-${String(orderIdx).padStart(5, '0')}`;

          const billItems = JSON.stringify([
            {
              itemId: '1',
              itemName: 'Sample Item',
              unit: 'pcs',
              quantity: getRandomNumber(5, 50),
              rate: getRandomNumber(500, 5000),
              discount: getRandomNumber(0, 10),
              discountType: 'percentage',
              taxableAmount: totalAmount,
              cgst: totalAmount * 0.09,
              sgst: totalAmount * 0.09,
              igst: 0,
              totalAmount: totalAmount * 1.18,
            },
          ]);

          const grandTotal = totalAmount * 1.18;

          await queryRunner.query(
            `INSERT INTO billings (billNo, billDate, customerId, items, subtotal, overallDiscount, overallDiscountType, 
                                   totalAfterDiscount, cgstTotal, sgstTotal, igstTotal, grandTotal, roundOff, finalAmount,
                                   status, invoiceNo, invoiceDate, poNumber, paymentStatus, amountDue, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              billNo,
              billDate,
              customer.id,
              billItems,
              totalAmount,
              0,
              'percentage',
              totalAmount,
              totalAmount * 0.09,
              totalAmount * 0.09,
              0,
              grandTotal,
              0,
              grandTotal,
              'completed',
              billNo,
              billDate,
              poNo,
              PO_STATUSES[getRandomNumber(0, 2)],
              grandTotal,
              billDate,
              billDate,
            ],
          );
          invoiceCount++;
        }

        // Create purchase return (30% chance)
        if (Math.random() > 0.7) {
          const item = items[getRandomNumber(0, items.length - 1)];
          const returnQty = getRandomNumber(2, 15);
          const rate = item.rate || getRandomNumber(500, 5000);
          const returnAmount = returnQty * rate;
          const returnDate = getRandomDate(month);
          const returnNo = `PR-${String(month + 1).padStart(2, '0')}-${String(orderIdx).padStart(5, '0')}`;

          await queryRunner.query(
            `INSERT INTO purchase_returns (returnNo, returnDate, distributorId, itemId, quantity, rate, totalAmount, reason, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              returnNo,
              returnDate,
              distributor.id,
              item.id,
              returnQty,
              rate,
              returnAmount,
              REASONS[getRandomNumber(0, 4)],
              APPROVAL_STATUSES[getRandomNumber(0, 2)],
              returnDate,
              returnDate,
            ],
          );
          prCount++;
        }

        // Create sales return (25% chance)
        if (Math.random() > 0.75) {
          const item = items[getRandomNumber(0, items.length - 1)];
          const returnQty = getRandomNumber(2, 15);
          const rate = item.rate || getRandomNumber(500, 5000);
          const returnAmount = returnQty * rate;
          const returnDate = getRandomDate(month);
          const returnNo = `SR-${String(month + 1).padStart(2, '0')}-${String(orderIdx).padStart(5, '0')}`;

          await queryRunner.query(
            `INSERT INTO sales_returns (returnNo, returnDate, distributorId, itemId, quantity, rate, totalAmount, reason, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              returnNo,
              returnDate,
              distributor.id,
              item.id,
              returnQty,
              rate,
              returnAmount,
              REASONS[getRandomNumber(0, 4)],
              APPROVAL_STATUSES[getRandomNumber(0, 2)],
              returnDate,
              returnDate,
            ],
          );
          srCount++;
        }
      }
    }

    console.log('\n✅ SEED DATA GENERATION COMPLETE!');
    console.log(`\n📊 Created Statistics:`);
    console.log(`   🛒 Purchase Orders: ${poCount}`);
    console.log(`   📄 Invoices: ${invoiceCount}`);
    console.log(`   📦 Purchase Returns: ${prCount}`);
    console.log(`   📤 Sales Returns: ${srCount}`);
    console.log(`   ✅ Total Records: ${poCount + invoiceCount + prCount + srCount}`);

    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedData();
