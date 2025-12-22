import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { UserEntity } from '../users/entities/user.entity';
import { DistributorEntity } from '../users/entities/distributor.entity';
import { ItemEntity } from '../items/entities/item.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { PurchaseOrderEntity } from '../orders/entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from '../orders/entities/purchase-order-item.entity';
import { GrnEntity } from '../orders/entities/grn.entity';
import { GrnItemEntity } from '../orders/entities/grn-item.entity';
import { GrnBatchDetailEntity } from '../orders/entities/grn-batch-detail.entity';
import { BillingEntity } from '../billing/entities/billing.entity';
import { BillingItemEntity } from '../billing/entities/billing-item.entity';
import { BillingBatchDetailEntity } from '../billing/entities/billing-batch-detail.entity';
// Enterprise Inventory Entities
import { WarehouseEntity } from '../inventory/entities/warehouse.entity';
import { InventoryLotEntity } from '../inventory/entities/inventory-lot.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import * as bcrypt from 'bcrypt';

dotenv.config();

async function generateBatchTestData() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mega_shop_db',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected');

  try {
    // 1. Create Super Admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    let admin = await dataSource
      .getRepository(UserEntity)
      .findOne({ where: { email: 'admin@oms.com' } });

    if (!admin) {
      admin = await dataSource.getRepository(UserEntity).save({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@oms.com',
        mobileNo: '9999999999',
        password: hashedPassword,
        role: 'super_admin',
      });
      console.log('✅ Super Admin created');
    }

    // 2. Create Distributors
    const distributors = [];
    const distributorData = [
      {
        name: 'Mumbai Pharma',
        city: 'Mumbai',
        state: 'Maharashtra',
        mobile: '9876543210',
      },
      {
        name: 'Delhi Medical',
        city: 'Delhi',
        state: 'Delhi',
        mobile: '9876543211',
      },
      {
        name: 'Bangalore Health',
        city: 'Bangalore',
        state: 'Karnataka',
        mobile: '9876543212',
      },
    ];

    for (const dist of distributorData) {
      let user = await dataSource
        .getRepository(UserEntity)
        .findOne({ where: { mobileNo: dist.mobile } });

      if (!user) {
        user = await dataSource.getRepository(UserEntity).save({
          firstName: dist.name.split(' ')[0],
          lastName: dist.name.split(' ')[1],
          email: `${dist.name.toLowerCase().replace(' ', '.')}@oms.com`,
          mobileNo: dist.mobile,
          password: hashedPassword,
          role: 'distributor',
        });

        const distributor = await dataSource
          .getRepository(DistributorEntity)
          .save({
            userId: user.id,
            businessName: dist.name,
            city: dist.city,
            state: dist.state,
            addressLine1: `${dist.city} Main Road`,
            pincode: '400001',
            creditLimitDays: 30,
            creditLimitAmount: 100000,
          });

        distributors.push({ user, distributor });
        console.log(`✅ Distributor created: ${dist.name}`);
      } else {
        const distributor = await dataSource
          .getRepository(DistributorEntity)
          .findOne({ where: { userId: user.id } });
        distributors.push({ user, distributor });
      }
    }

    // 3. Create Items with batch tracking
    const items = [];
    const itemData = [
      {
        name: 'Paracetamol 500mg',
        unit: 'STRIP',
        rate: 10,
        hasBatch: true,
        hasExpiry: true,
      },
      {
        name: 'Amoxicillin 250mg',
        unit: 'STRIP',
        rate: 25,
        hasBatch: true,
        hasExpiry: true,
      },
      {
        name: 'Vitamin C Tablets',
        unit: 'BOTTLE',
        rate: 150,
        hasBatch: true,
        hasExpiry: true,
      },
      {
        name: 'Cough Syrup',
        unit: 'BOTTLE',
        rate: 80,
        hasBatch: true,
        hasExpiry: true,
      },
      {
        name: 'Hand Sanitizer',
        unit: 'BOTTLE',
        rate: 50,
        hasBatch: true,
        hasExpiry: true,
      },
    ];

    for (const itemInfo of itemData) {
      let item = await dataSource
        .getRepository(ItemEntity)
        .findOne({ where: { name: itemInfo.name } });

      if (!item) {
        item = await dataSource.getRepository(ItemEntity).save({
          name: itemInfo.name,
          unit: itemInfo.unit,
          rate: itemInfo.rate,
          qty: 0,
          alterQty: 0,
          hasBatchTracking: itemInfo.hasBatch,
          hasExpiryDate: itemInfo.hasExpiry,
          createdByIp: '127.0.0.1',
        });
        console.log(`✅ Item created: ${itemInfo.name}`);
      }
      items.push(item);
    }

    // 4. Create Customers for each distributor
    const customers = [];
    for (let i = 0; i < distributors.length; i++) {
      const dist = distributors[i];
      for (let j = 1; j <= 3; j++) {
        let customer = await dataSource.getRepository(CustomerEntity).findOne({
          where: { mobileNo: `98765432${i}${j}` },
        });

        if (!customer) {
          customer = await dataSource.getRepository(CustomerEntity).save({
            firstname: `Customer${i}${j}`,
            lastname: `Test`,
            mobileNo: `98765432${i}${j}`,
            emailId: `customer${i}${j}@test.com`,
            addressLine1: `Address ${i}${j}`,
            city: dist.distributor.city,
            state: dist.distributor.state,
            pincode: '400001',
            distributorId: dist.user.id,
          });
          console.log(`✅ Customer created: Customer${i}${j}`);
        }
        customers.push({ customer, distributorId: dist.user.id });
      }
    }

    // 5. Create Warehouses for each distributor (Enterprise Inventory)
    const warehouses = new Map<number, WarehouseEntity>();
    for (const dist of distributors) {
      let warehouse = await dataSource.getRepository(WarehouseEntity).findOne({
        where: { distributorId: dist.user.id, type: 'MAIN' },
      });

      if (!warehouse) {
        warehouse = await dataSource.getRepository(WarehouseEntity).save({
          code: `WH-${dist.user.id}`,
          name: `${dist.distributor.businessName} - Main Warehouse`,
          type: 'MAIN',
          distributorId: dist.user.id,
          isActive: true,
        });
        console.log(`✅ Warehouse created: ${warehouse.name}`);
      }
      warehouses.set(dist.user.id, warehouse);
    }

    // 6. Create Purchase Orders → GRN → Enterprise Inventory with Lots
    console.log('\n📦 Creating Purchase Orders with Enterprise Inventory...\n');

    for (let distIndex = 0; distIndex < distributors.length; distIndex++) {
      const dist = distributors[distIndex];
      const warehouse = warehouses.get(dist.user.id)!;

      // Create 2 POs per distributor
      for (let poIndex = 1; poIndex <= 2; poIndex++) {
        const poNo = `PO-${dist.user.id}-${Date.now()}-${poIndex}`;

        // Create PO
        const po = await dataSource.getRepository(PurchaseOrderEntity).save({
          poNo,
          distributorId: dist.user.id,
          totalAmount: 0,
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          createdBy: admin.id,
          approvedBy: admin.id,
          approvedAt: new Date(),
        });

        // Add items to PO
        let poTotal = 0;
        const poItems = [];
        for (let i = 0; i < 3; i++) {
          const item = items[i];
          const quantity = 100 + poIndex * 50;
          const totalPrice = quantity * item.rate;
          poTotal += totalPrice;

          const poItem = await dataSource
            .getRepository(PurchaseOrderItemEntity)
            .save({
              purchaseOrderId: po.id,
              itemId: item.id,
              quantity,
              unitPrice: item.rate,
              totalPrice,
            });
          poItems.push({ poItem, item, quantity });
        }

        await dataSource
          .getRepository(PurchaseOrderEntity)
          .update(po.id, { totalAmount: poTotal });

        // Create GRN for this PO
        const grnNo = `GRN-${po.id}-${Date.now()}`;
        const grn = await dataSource.getRepository(GrnEntity).save({
          grnNo,
          purchaseOrderId: po.id,
          distributorId: dist.user.id,
          totalAmount: poTotal,
          status: 'APPROVED',
          createdBy: dist.user.id,
          approvedBy: admin.id,
          approvedAt: new Date(),
        });

        console.log(`✅ Created PO: ${poNo} → GRN: ${grnNo}`);

        // Create GRN Items with Batches and Enterprise Inventory
        for (const { poItem, item, quantity } of poItems) {
          const grnItem = await dataSource.getRepository(GrnItemEntity).save({
            grnId: grn.id,
            poItemId: poItem.id,
            itemId: item.id,
            receivedQuantity: quantity,
            originalQuantity: quantity,
            unitPrice: item.rate,
            pendingQuantity: 0,
          });

          // Generate batch number
          const batchNumber = `BATCH-${item.id}-${distIndex}${poIndex}-${Date.now()}`;
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 12 + poIndex * 6); // 12-18 months expiry

          // Create GRN Batch Detail
          await dataSource.getRepository(GrnBatchDetailEntity).save({
            grnItemId: grnItem.id,
            batchNumber,
            quantity,
            expiryDate: expiryDate.toISOString().split('T')[0],
          });

          // Create Enterprise Inventory Lot
          const lot = await dataSource.getRepository(InventoryLotEntity).save({
            lotNumber: batchNumber,
            itemId: item.id,
            expiryDate: expiryDate.toISOString().split('T')[0],
            receivedDate: new Date().toISOString().split('T')[0],
            purchaseOrderId: po.id,
            grnId: grn.id,
            unitCost: item.rate,
            distributorId: dist.user.id,
            warehouseId: warehouse.id,
            createdBy: dist.user.id,
            status: 'ACTIVE',
            qualityStatus: 'APPROVED',
          });

          // Create Enterprise Inventory Transaction (IN movement)
          const txnNo = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0')}`;
          await dataSource.getRepository(InventoryTransactionEntity).save({
            transactionNo: txnNo,
            transactionDate: new Date(),
            transactionType: 'GRN_RECEIPT',
            movementType: 'IN',
            itemId: item.id,
            lotId: lot.id,
            quantity,
            unit: item.unit,
            warehouseId: warehouse.id,
            referenceType: 'GRN',
            referenceId: grn.id,
            referenceNo: grnNo,
            referenceLineId: grnItem.id,
            unitCost: item.rate,
            totalCost: quantity * item.rate,
            distributorId: dist.user.id,
            remarks: `GRN Receipt: ${grnNo}`,
            createdBy: dist.user.id,
            status: 'COMPLETED',
            runningBalance: quantity,
          });

          console.log(
            `   ✅ Lot: ${batchNumber} | Qty: ${quantity} | Expiry: ${expiryDate.toISOString().split('T')[0]}`,
          );
        }
      }
    }

    // 7. Create Billings (Sales) with Enterprise Inventory Tracking
    console.log('\n💰 Creating Billings with Enterprise Inventory...\n');

    for (let distIndex = 0; distIndex < distributors.length; distIndex++) {
      const dist = distributors[distIndex];
      const warehouse = warehouses.get(dist.user.id)!;
      const distCustomers = customers.filter(
        (c) => c.distributorId === dist.user.id,
      );

      // Create 2 billings per distributor
      for (let billIndex = 1; billIndex <= 2; billIndex++) {
        const customer = distCustomers[billIndex - 1];
        const billNo = `BILL-${dist.user.id}-${Date.now()}-${billIndex}`;
        const billDate = new Date();
        billDate.setDate(billDate.getDate() - billIndex * 5); // 5, 10 days ago

        // Create Billing
        const billing = await dataSource.getRepository(BillingEntity).save({
          billNo,
          billDate: billDate.toISOString().split('T')[0],
          customerId: customer.customer.id,
          distributorId: dist.user.id,
          subtotal: 0,
          overallDiscount: 0,
          overallDiscountType: 'percentage',
          totalAfterDiscount: 0,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          grandTotal: 0,
          roundOff: 0,
          finalAmount: 0,
          status: 'completed',
          approvalStatus: 'approved',
          paymentType: 'cash',
          createdBy: dist.user.id,
          createdByIp: '127.0.0.1',
        });

        // Add items to billing
        let billTotal = 0;
        for (let i = 0; i < 2; i++) {
          const item = items[i];
          const quantity = 10 + billIndex * 5;
          const rate = item.rate;
          const amount = quantity * rate;
          const cgst = amount * 0.09;
          const sgst = amount * 0.09;
          const totalAmount = amount + cgst + sgst;
          billTotal += totalAmount;

          // Create Billing Item
          await dataSource.getRepository(BillingItemEntity).save({
            billingId: billing.id,
            itemId: item.id,
            itemName: item.name,
            unit: item.unit,
            quantity,
            rate,
            discount: 0,
            discountType: 'percentage',
            taxableAmount: amount,
            cgst,
            sgst,
            igst: 0,
            totalAmount,
          });

          // Get lot from enterprise inventory (FEFO - First Expiry First Out)
          const lots = await dataSource.getRepository(InventoryLotEntity).find({
            where: {
              distributorId: dist.user.id,
              itemId: item.id,
              status: 'ACTIVE',
            },
            order: { expiryDate: 'ASC' },
          });

          if (lots.length > 0) {
            const lot = lots[0];

            // Create Billing Batch Detail with enterprise lot reference
            await dataSource.getRepository(BillingBatchDetailEntity).save({
              billingId: billing.id,
              itemId: item.id,
              lotId: lot.id,
              batchNumber: lot.lotNumber,
              expiryDate: lot.expiryDate,
              quantity,
              rate,
            });

            // Create Enterprise Inventory Transaction (OUT movement)
            const txnNo = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, '0')}`;
            await dataSource.getRepository(InventoryTransactionEntity).save({
              transactionNo: txnNo,
              transactionDate: new Date(),
              transactionType: 'SALES_ISSUE',
              movementType: 'OUT',
              itemId: item.id,
              lotId: lot.id,
              quantity,
              unit: item.unit,
              warehouseId: warehouse.id,
              referenceType: 'BILLING',
              referenceId: billing.id,
              referenceNo: billNo,
              unitCost: rate,
              totalCost: quantity * rate,
              distributorId: dist.user.id,
              remarks: `Sale: ${billNo}`,
              createdBy: dist.user.id,
              status: 'COMPLETED',
            });

            console.log(
              `   ✅ Sold: ${item.name} | Lot: ${lot.lotNumber} | Qty: ${quantity}`,
            );
          }
        }

        // Update billing totals
        await dataSource.getRepository(BillingEntity).update(billing.id, {
          subtotal: billTotal / 1.18,
          totalAfterDiscount: billTotal / 1.18,
          cgstTotal: (billTotal / 1.18) * 0.09,
          sgstTotal: (billTotal / 1.18) * 0.09,
          grandTotal: billTotal,
          finalAmount: billTotal,
        });

        console.log(
          `✅ Created Billing: ${billNo} | Total: ₹${billTotal.toFixed(2)}`,
        );
      }
    }

    console.log('\n✅ ✅ ✅ Test Data Generation Complete! ✅ ✅ ✅\n');
    console.log('📊 Summary:');
    console.log(`   - Distributors: ${distributors.length}`);
    console.log(`   - Items: ${items.length}`);
    console.log(`   - Customers: ${customers.length}`);
    console.log(`   - Warehouses: ${warehouses.size}`);
    console.log(`   - Purchase Orders: ${distributors.length * 2}`);
    console.log(`   - GRNs: ${distributors.length * 2}`);
    console.log(`   - Billings: ${distributors.length * 2}`);
    console.log(`   - Inventory Lots Created: ${distributors.length * 2 * 3}`);
    console.log('\n🔍 You can now test enterprise inventory traceability!\n');
  } catch (error) {
    console.error('❌ Error generating test data:', error);
  } finally {
    await dataSource.destroy();
  }
}

generateBatchTestData();
