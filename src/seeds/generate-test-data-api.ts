import axios from 'axios';

const API_URL = 'http://localhost:3000';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'];

interface LoginResponse {
  access_token: string;
  user: { id: number; role: string };
}

let authToken = '';
let adminId = 0;
let distributors: any[] = [];
let customers: any[] = [];
let items: any[] = [];
let managers: any[] = [];

async function login(): Promise<void> {
  try {
    const response = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
      emailOrMobile: 'admin1@omniordera.com',
      password: 'admin1@123',
    });
    authToken = response.data.access_token;
    adminId = response.data.user.id;
    console.log('✅ Login successful:', adminId);
  } catch (error: any) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getAuthHeaders() {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
}

async function fetchDistributors(): Promise<void> {
  try {
    const response = await axios.get(`${API_URL}/users/distributors`, {
      headers: await getAuthHeaders(),
    });
    distributors = response.data.data || [];
    console.log(`✅ Found ${distributors.length} distributors`);
  } catch (error: any) {
    console.error('❌ Failed to fetch distributors:', error.message);
  }
}

async function fetchCustomers(): Promise<void> {
  try {
    const response = await axios.get(`${API_URL}/customers?page=1&limit=100`, {
      headers: await getAuthHeaders(),
    });
    customers = response.data.data || [];
    console.log(`✅ Found ${customers.length} customers`);
  } catch (error: any) {
    console.error('❌ Failed to fetch customers:', error.message);
  }
}

async function fetchItems(): Promise<void> {
  try {
    const response = await axios.get(`${API_URL}/items?page=1&limit=100`, {
      headers: await getAuthHeaders(),
    });
    items = response.data.data || [];
    console.log(`✅ Found ${items.length} items`);
  } catch (error: any) {
    console.error('❌ Failed to fetch items:', error.message);
  }
}

async function fetchManagers(): Promise<void> {
  try {
    const response = await axios.get(`${API_URL}/users?role=manager`, {
      headers: await getAuthHeaders(),
    });
    managers = response.data.data || [];
    console.log(`✅ Found ${managers.length} managers`);
  } catch (error: any) {
    console.error('❌ Failed to fetch managers:', error.message);
  }
}

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

async function createPurchaseOrder(month: number, orderIdx: number): Promise<any> {
  try {
    const distributor = distributors[Math.floor(Math.random() * distributors.length)];
    const manager = managers.length > 0 ? managers[Math.floor(Math.random() * managers.length)] : null;
    const poDate = getRandomDate(month);

    const itemCount = Math.floor(Math.random() * 4) + 2;
    const orderItems = [];
    let totalAmount = 0;

    for (let i = 0; i < itemCount; i++) {
      const item = items[Math.floor(Math.random() * items.length)];
      const quantity = Math.floor(Math.random() * 100) + 10;
      const unitPrice = item.rate || Math.floor(Math.random() * 5000) + 100;
      const itemTotal = quantity * unitPrice;
      totalAmount += itemTotal;

      orderItems.push({
        itemId: item.id,
        quantity,
        unitPrice,
      });
    }

    const payload = {
      distributorId: distributor.id,
      items: orderItems,
      totalAmount,
      status: ['PENDING', 'CONFIRMED', 'DELIVERED'][Math.floor(Math.random() * 3)],
    };

    const response = await axios.post(`${API_URL}/purchase-orders`, payload, {
      headers: await getAuthHeaders(),
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`⚠️  Error creating PO:`, error.response?.data || error.message);
    return null;
  }
}

async function createInvoice(purchaseOrder: any): Promise<any> {
  try {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const billDate = new Date(purchaseOrder.createdAt);
    billDate.setDate(billDate.getDate() + Math.floor(Math.random() * 5));

    const billItems = purchaseOrder.items.map((oi: any) => ({
      itemId: oi.item?.id || oi.itemId,
      itemName: oi.item?.name || `Item ${oi.itemId}`,
      unit: 'pcs',
      quantity: oi.quantity,
      rate: oi.unitPrice,
      discount: Math.floor(Math.random() * 5),
      discountType: 'percentage',
      taxableAmount: oi.quantity * oi.unitPrice,
      cgst: (oi.quantity * oi.unitPrice) * 0.09,
      sgst: (oi.quantity * oi.unitPrice) * 0.09,
      igst: 0,
      totalAmount: (oi.quantity * oi.unitPrice) * 1.18,
    }));

    const subtotal = billItems.reduce((sum: number, item: any) => sum + item.taxableAmount, 0);
    const cgstTotal = billItems.reduce((sum: number, item: any) => sum + item.cgst, 0);
    const sgstTotal = billItems.reduce((sum: number, item: any) => sum + item.sgst, 0);
    const grandTotal = subtotal + cgstTotal + sgstTotal;

    const payload = {
      customerId: customer.id,
      billDate: formatDate(billDate),
      items: billItems,
      subtotal,
      overallDiscount: 0,
      overallDiscountType: 'percentage',
      totalAfterDiscount: subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal: 0,
      grandTotal,
      roundOff: 0,
      finalAmount: grandTotal,
      status: 'completed',
      poNumber: purchaseOrder.poNo,
      paymentStatus: ['pending', 'partial', 'completed'][Math.floor(Math.random() * 3)],
    };

    const response = await axios.post(`${API_URL}/billings`, payload, {
      headers: await getAuthHeaders(),
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`⚠️  Error creating invoice:`, error.response?.data?.message || error.message);
    return null;
  }
}

async function createReturn(type: 'purchase' | 'sales', month: number, orderIdx: number, distributorId: number, itemId: number, rate: number): Promise<any> {
  try {
    const endpoint = type === 'purchase' ? '/returns/purchase' : '/returns/sales';
    const returnQty = Math.floor(Math.random() * 10) + 2;
    const returnAmount = returnQty * rate;
    const returnDate = new Date(2025, month, Math.floor(Math.random() * 20) + 1);

    const payload = {
      distributorId,
      itemId,
      quantity: returnQty,
      rate,
      totalAmount: returnAmount,
      reason: ['Defective', 'Quality issue', 'Wrong shipment', 'Damage'][Math.floor(Math.random() * 4)],
      returnDate: formatDate(returnDate),
    };

    const response = await axios.post(`${API_URL}${endpoint}`, payload, {
      headers: await getAuthHeaders(),
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`⚠️  Error creating ${type} return:`, error.response?.data?.message || error.message);
    return null;
  }
}

async function generateTestData(): Promise<void> {
  try {
    console.log('🚀 Starting test data generation...\n');

    // Check prerequisites
    if (!distributors.length || !items.length || !customers.length) {
      console.error('❌ Missing required data. Please ensure distributors, items, and customers exist.');
      return;
    }

    let poCount = 0;
    let invoiceCount = 0;
    let purchaseReturnCount = 0;
    let salesReturnCount = 0;

    // Generate data for each month
    for (let month = 0; month < 11; month++) {
      console.log(`\n📅 ${MONTHS[month]} 2025...`);

      for (let orderIdx = 0; orderIdx < 12; orderIdx++) {
        // Create Purchase Order
        const po = await createPurchaseOrder(month, orderIdx);
        if (po) {
          poCount++;
          console.log(`   ✅ PO created: ${po.poNo}`);

          // Create Invoice from PO (80% chance)
          if (Math.random() > 0.2 && po.status === 'DELIVERED') {
            const invoice = await createInvoice(po);
            if (invoice) {
              invoiceCount++;
              console.log(`   ✅ Invoice created: ${invoice.billNo}`);
            }
          }

          // Create Purchase Return (30% chance)
          if (Math.random() > 0.7 && po.items && po.items.length > 0) {
            const item = po.items[Math.floor(Math.random() * po.items.length)];
            const ret = await createReturn('purchase', month, orderIdx, po.distributorId, item.itemId, item.unitPrice);
            if (ret) {
              purchaseReturnCount++;
              console.log(`   ✅ Purchase Return created: ${ret.returnNo}`);
            }
          }

          // Create Sales Return (25% chance)
          if (Math.random() > 0.75 && po.items && po.items.length > 0) {
            const item = po.items[Math.floor(Math.random() * po.items.length)];
            const ret = await createReturn('sales', month, orderIdx, po.distributorId, item.itemId, item.unitPrice);
            if (ret) {
              salesReturnCount++;
              console.log(`   ✅ Sales Return created: ${ret.returnNo}`);
            }
          }
        }
      }
    }

    console.log('\n\n✅ TEST DATA GENERATION COMPLETE!');
    console.log(`📊 Created Statistics:`);
    console.log(`   🛒 Purchase Orders: ${poCount}`);
    console.log(`   📄 Invoices: ${invoiceCount}`);
    console.log(`   📦 Purchase Returns: ${purchaseReturnCount}`);
    console.log(`   📤 Sales Returns: ${salesReturnCount}`);
    console.log(`   ✅ Total Records: ${poCount + invoiceCount + purchaseReturnCount + salesReturnCount}`);
  } catch (error) {
    console.error('❌ Error during test data generation:', error);
  }
}

async function main(): Promise<void> {
  try {
    await login();
    await fetchDistributors();
    await fetchCustomers();
    await fetchItems();
    await fetchManagers();
    await generateTestData();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
