import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { PurchaseOrderEntity } from '../orders/entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from '../orders/entities/purchase-order-item.entity';
import { BillingEntity } from '../billing/entities/billing.entity';
import { PurchaseReturnEntity } from '../returns/entities/purchase-return.entity';
import { SalesReturnEntity } from '../returns/entities/sales-return.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'oms-qa',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'];
const REASONS = ['Defective item', 'Quality issue', 'Wrong shipment', 'Customer request', 'Damage in transit', 'Expired product'];

function getRandomDate(month: number, year: number = 2025): Date {
  const maxDays = new Date(year, month + 1, 0).getDate();
  const day = Math.floor(Math.random() * maxDays) + 1;
  return new Date(year, month, day);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generatePoNo(month: number, index: number): string {
  return `PO-${String(month + 1).padStart(2, '0')}-${String(index).padStart(5, '0')}`;
}

function generateReturnNo(type: string, month: number, index: number): string {
  const prefix = type === 'purchase' ? 'PR' : 'SR';
  return `${prefix}-${String(month + 1).padStart(2, '0')}-${String(index).padStart(5, '0')}`;
}

function generateBillNo(month: number, index: number): string {
  return `BILL-${String(month + 1).padStart(2, '0')}-${String(index).padStart(5, '0')}`;
}

async function seedData() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    // Fetch all required data
    const distributors = await AppDataSource.query(`
      SELECT id, userId FROM distributor_master LIMIT 10
    `);
    
    const customers = await AppDataSource.query(`
      SELECT id FROM customer_master LIMIT 20
    `);

    const items = await AppDataSource.query(`
      SELECT id, rate FROM item_master LIMIT 30
    `);

    const users = await AppDataSource.query(`
      SELECT id FROM user_master WHERE role = 'manager' LIMIT 5
    `);

    if (!distributors.length) {
      console.log('❌ No distributors found. Please seed users first.');
      return;
    }

    if (!customers.length) {
      console.log('❌ No customers found. Please seed customers first.');
      return;
    }

    if (!items.length) {
      console.log('❌ No items found. Please seed items first.');
      return;
    }

    console.log(`📊 Found: ${distributors.length} distributors, ${customers.length} customers, ${items.length} items, ${users.length} managers`);

    let purchaseOrdersCreated = 0;
    let invoicesCreated = 0;
    let purchaseReturnsCreated = 0;
    let salesReturnsCreated = 0;

    // Generate data for each month (January to November 2025)
    for (let month = 0; month < 11; month++) {
      console.log(`\n📅 Processing ${MONTHS[month]} 2025...`);

      // Generate 12-15 purchase orders per month
      for (let orderIdx = 0; orderIdx < 15; orderIdx++) {
        try {
          const distributor = distributors[Math.floor(Math.random() * distributors.length)];
          const poDate = getRandomDate(month);
          
          // Generate 2-5 items per order
          const itemCount = Math.floor(Math.random() * 4) + 2;
          const orderItems = [];
          let totalAmount = 0;

          for (let i = 0; i < itemCount; i++) {
            const item = items[Math.floor(Math.random() * items.length)];
            const quantity = Math.floor(Math.random() * 100) + 10;
            const unitPrice = parseFloat(item.rate) || (Math.floor(Math.random() * 5000) + 100);
            const itemTotal = quantity * unitPrice;
            totalAmount += itemTotal;

            const poItem = new PurchaseOrderItemEntity();
            poItem.itemId = item.id;
            poItem.quantity = quantity;
            poItem.unitPrice = unitPrice;
            orderItems.push(poItem);
          }

          const po = new PurchaseOrderEntity();
          po.poNo = generatePoNo(month, orderIdx);
          po.distributorId = distributor.id;
          po.totalAmount = totalAmount;
          po.status = ['PENDING', 'CONFIRMED', 'DELIVERED'][Math.floor(Math.random() * 3)];
          po.createdBy = distributor.userId;
          po.approvalStatus = ['PENDING', 'APPROVED', 'REJECTED'][Math.floor(Math.random() * 3)];
          po.approvedBy = users.length ? users[Math.floor(Math.random() * users.length)].id : null;
          po.approvedAt = po.approvalStatus === 'APPROVED' ? poDate : null;
          po.creditWarning = Math.random() > 0.7 ? 'Credit limit approaching' : null;
          po.createdAt = poDate;
          po.updatedAt = poDate;

          await AppDataSource.manager.save(po);
          
          for (const item of orderItems) {
            item.purchaseOrderId = po.id;
            await AppDataSource.manager.save(item);
          }

          purchaseOrdersCreated++;

          // Create invoice from this purchase order
          if (po.status === 'DELIVERED' || Math.random() > 0.3) {
            const customer = customers[Math.floor(Math.random() * customers.length)];
            const billDate = new Date(poDate);
            billDate.setDate(billDate.getDate() + Math.floor(Math.random() * 5));

            const billItems = orderItems.map((oi, idx) => ({
              itemId: oi.itemId.toString(),
              itemName: `Item ${oi.itemId}`,
              unit: 'pcs',
              quantity: oi.quantity,
              rate: oi.unitPrice,
              discount: Math.floor(Math.random() * 5),
              discountType: 'percentage' as const,
              taxableAmount: oi.quantity * oi.unitPrice,
              cgst: (oi.quantity * oi.unitPrice) * 0.09,
              sgst: (oi.quantity * oi.unitPrice) * 0.09,
              igst: 0,
              totalAmount: (oi.quantity * oi.unitPrice) * 1.18,
            }));

            const subtotal = billItems.reduce((sum, item) => sum + item.taxableAmount, 0);
            const cgstTotal = billItems.reduce((sum, item) => sum + item.cgst, 0);
            const sgstTotal = billItems.reduce((sum, item) => sum + item.sgst, 0);
            const totalAfterDiscount = subtotal;
            const grandTotal = totalAfterDiscount + cgstTotal + sgstTotal;

            const billing = new BillingEntity();
            billing.billNo = generateBillNo(month, orderIdx);
            billing.billDate = formatDate(billDate);
            billing.customerId = customer.id;
            // billing.items = billItems; // TODO: Update to use billingItems relation
            billing.subtotal = subtotal;
            billing.overallDiscount = 0;
            billing.overallDiscountType = 'percentage';
            billing.totalAfterDiscount = totalAfterDiscount;
            billing.cgstTotal = cgstTotal;
            billing.sgstTotal = sgstTotal;
            billing.igstTotal = 0;
            billing.grandTotal = grandTotal;
            billing.roundOff = 0;
            billing.finalAmount = grandTotal;
            billing.notes = `Invoice for PO ${po.poNo}`;
            billing.status = 'completed';
            billing.invoiceNo = billing.billNo;
            billing.invoiceDate = billing.billDate;
            billing.dueDate = formatDate(new Date(billDate.getTime() + 30 * 24 * 60 * 60 * 1000));
            billing.poNumber = po.poNo;
            billing.paymentStatus = (['pending', 'partial', 'completed'] as any)[Math.floor(Math.random() * 3)];
            billing.amountPaid = billing.paymentStatus === 'completed' ? grandTotal : (billing.paymentStatus === 'partial' ? grandTotal * 0.5 : 0);
            billing.amountDue = grandTotal - billing.amountPaid;
            billing.createdAt = billDate;
            billing.updatedAt = billDate;

            await AppDataSource.manager.save(billing);
            invoicesCreated++;
          }

          // Create purchase returns (30% chance)
          if (Math.random() > 0.7 && orderItems.length > 0) {
            const item = orderItems[Math.floor(Math.random() * orderItems.length)];
            const returnQty = Math.floor(item.quantity * 0.2) + 1;
            const returnAmount = returnQty * item.unitPrice;
            const returnDate = new Date(poDate);
            returnDate.setDate(returnDate.getDate() + Math.floor(Math.random() * 10) + 1);

            const purchaseReturn = new PurchaseReturnEntity();
            purchaseReturn.returnNo = generateReturnNo('purchase', month, orderIdx);
            purchaseReturn.returnDate = formatDate(returnDate);
            purchaseReturn.distributorId = distributor.id;
            purchaseReturn.itemId = item.itemId;
            purchaseReturn.quantity = returnQty;
            purchaseReturn.rate = item.unitPrice;
            purchaseReturn.totalAmount = returnAmount;
            purchaseReturn.reason = REASONS[Math.floor(Math.random() * REASONS.length)];
            purchaseReturn.status = ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)] as any;
            purchaseReturn.createdAt = returnDate;
            purchaseReturn.updatedAt = returnDate;

            await AppDataSource.manager.save(purchaseReturn);
            purchaseReturnsCreated++;
          }

          // Create sales returns (25% chance)
          if (Math.random() > 0.75 && orderItems.length > 0) {
            const item = orderItems[Math.floor(Math.random() * orderItems.length)];
            const returnQty = Math.floor(item.quantity * 0.15) + 1;
            const returnAmount = returnQty * item.unitPrice;
            const returnDate = new Date(poDate);
            returnDate.setDate(returnDate.getDate() + Math.floor(Math.random() * 15) + 2);

            const salesReturn = new SalesReturnEntity();
            salesReturn.returnNo = generateReturnNo('sales', month, orderIdx);
            salesReturn.returnDate = formatDate(returnDate);
            salesReturn.distributorId = distributor.id;
            salesReturn.itemId = item.itemId;
            salesReturn.quantity = returnQty;
            salesReturn.rate = item.unitPrice;
            salesReturn.totalAmount = returnAmount;
            salesReturn.reason = REASONS[Math.floor(Math.random() * REASONS.length)];
            salesReturn.status = ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)] as any;
            salesReturn.createdAt = returnDate;
            salesReturn.updatedAt = returnDate;

            await AppDataSource.manager.save(salesReturn);
            salesReturnsCreated++;
          }
        } catch (error) {
          console.log(`⚠️  Error creating order: ${error.message}`);
        }
      }
    }

    console.log('\n\n✅ SEED DATA GENERATION COMPLETE!');
    console.log(`📊 Created Statistics:`);
    console.log(`   🛒 Purchase Orders: ${purchaseOrdersCreated}`);
    console.log(`   📄 Invoices: ${invoicesCreated}`);
    console.log(`   📦 Purchase Returns: ${purchaseReturnsCreated}`);
    console.log(`   📤 Sales Returns: ${salesReturnsCreated}`);
    console.log(`   ✅ Total Records: ${purchaseOrdersCreated + invoicesCreated + purchaseReturnsCreated + salesReturnsCreated}`);

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedData();
