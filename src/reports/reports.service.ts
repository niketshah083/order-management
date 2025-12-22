import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingEntity } from 'src/billing/entities/billing.entity';
import { PurchaseOrderEntity } from 'src/orders/entities/purchase-order.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { CustomerEntity } from 'src/customers/entities/customer.entity';
import { UsersService } from 'src/users/users.service';
import moment from 'moment';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(BillingEntity)
    private billingRepo: Repository<BillingEntity>,
    @InjectRepository(PurchaseOrderEntity)
    private poRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepo: Repository<DistributorEntity>,
    @InjectRepository(CustomerEntity)
    private customerRepo: Repository<CustomerEntity>,
    private usersService: UsersService,
  ) {}

  private formatDate(date: Date): string {
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  }

  private getDateRange(fromDate: Date, toDate: Date) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private getTodayDateRange() {
    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private getCurrentWeekDateRange() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from: startOfWeek, to };
  }

  private getCurrentMonthDateRange() {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private getCurrentYearDateRange() {
    const today = new Date();
    const from = new Date(today.getFullYear(), 0, 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // 1️⃣ MANAGER-WISE SALES REPORT
  async getManagerWiseSales(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          u.id as managerId,
          CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) as managerName,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalSalesAmount,
          SUM(b.cgstTotal + b.sgstTotal + b.igstTotal) as totalGST,
          SUM(b.overallDiscount) as totalDiscount,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM billings b
        JOIN user_master u ON u.id = (SELECT createdBy FROM purchase_order_master po WHERE po.poNo = b.poNumber LIMIT 1)
        WHERE b.billDate BETWEEN ? AND ? AND u.role = 'manager'
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY u.id, u.firstName, u.lastName ORDER BY totalSalesAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        totalGST: parseFloat(r.totalGST) || 0,
        totalDiscount: parseFloat(r.totalDiscount) || 0,
        uniqueCustomers: parseInt(r.uniqueCustomers) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalManagers: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
          totalInvoices: parsedResult.reduce(
            (sum, r) => sum + r.totalInvoices,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Manager-wise sales error:', error);
      return {
        data: [],
        summary: { totalManagers: 0, grandTotal: 0, totalInvoices: 0 },
      };
    }
  }

  // 2️⃣ AREA-WISE SALES REPORT (Based on Customer City)
  async getAreaWiseSales(fromDate: Date, toDate: Date, distributorId?: number) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          c.city as area,
          c.state,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalSalesAmount,
          SUM(b.cgstTotal + b.sgstTotal + b.igstTotal) as totalGST,
          COUNT(DISTINCT b.customerId) as totalCustomers
        FROM billings b
        JOIN customers c ON b.customerId = c.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY c.city, c.state ORDER BY totalSalesAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        totalGST: parseFloat(r.totalGST) || 0,
        totalCustomers: parseInt(r.totalCustomers) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalAreas: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Area-wise sales error:', error);
      return { data: [], summary: { totalAreas: 0, grandTotal: 0 } };
    }
  }

  // 3️⃣ ITEM-WISE SALES REPORT
  async getItemWiseSales(fromDate: Date, toDate: Date, distributorId?: number) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      let query = this.billingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.billingItems', 'billingItems')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      }
      const billings = await query.getMany();

      const itemMap = new Map();

      billings.forEach((billing) => {
        if (billing.billingItems && Array.isArray(billing.billingItems)) {
          billing.billingItems.forEach((item: any) => {
            const key = item.itemName || 'Unknown';
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                itemName: item.itemName,
                totalQuantity: 0,
                totalAmount: 0,
                invoiceCount: 0,
              });
            }
            const existing = itemMap.get(key);
            // Parse numeric values from strings (TypeORM returns decimals as strings)
            existing.totalQuantity += parseFloat(item.quantity) || 0;
            existing.totalAmount += parseFloat(item.totalAmount) || 0;
            existing.invoiceCount += 1;
          });
        }
      });

      const result = Array.from(itemMap.values()).sort(
        (a, b) => b.totalAmount - a.totalAmount,
      );

      return {
        data: result,
        summary: {
          totalItems: result.length,
          grandTotal: result.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
          totalQuantity: result.reduce(
            (sum, r) => sum + (r.totalQuantity || 0),
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Item-wise sales error:', error);
      return {
        data: [],
        summary: { totalItems: 0, grandTotal: 0, totalQuantity: 0 },
      };
    }
  }

  // 4️⃣ PENDING PAYMENT DISTRIBUTOR-WISE REPORT
  async getPendingPaymentByDistributor(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          d.id as distributorId,
          CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) as distributorName,
          d.businessName,
          d.city,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalAmount,
          SUM(CASE WHEN b.paymentStatus = 'pending' THEN b.finalAmount ELSE 0 END) as pendingAmount,
          SUM(CASE WHEN b.paymentStatus IN ('completed', 'partial') THEN b.finalAmount ELSE 0 END) as paidAmount,
          COUNT(CASE WHEN b.paymentStatus = 'pending' THEN 1 END) as pendingInvoiceCount
        FROM billings b
        LEFT JOIN distributor_master d ON b.distributorId = d.userId
        LEFT JOIN user_master u ON d.userId = u.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY d.id, d.userId, u.firstName, u.lastName, d.businessName, d.city HAVING pendingAmount > 0 ORDER BY pendingAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalAmount: parseFloat(r.totalAmount) || 0,
        pendingAmount: parseFloat(r.pendingAmount) || 0,
        paidAmount: parseFloat(r.paidAmount) || 0,
        pendingInvoiceCount: parseInt(r.pendingInvoiceCount) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalDistributorsWithPending: parsedResult.length,
          grandPendingAmount: parsedResult.reduce(
            (sum, r) => sum + r.pendingAmount,
            0,
          ),
          totalPendingInvoices: parsedResult.reduce(
            (sum, r) => sum + r.pendingInvoiceCount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Pending payment by distributor error:', error);
      return {
        data: [],
        summary: {
          totalDistributorsWithPending: 0,
          grandPendingAmount: 0,
          totalPendingInvoices: 0,
        },
      };
    }
  }

  // 5️⃣ CUSTOMER-WISE SALES REPORT (Top Customers)
  async getTopCustomerSales(
    fromDate: Date,
    toDate: Date,
    limit: number = 20,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          c.id as customerId,
          CONCAT(COALESCE(c.firstname, ''), ' ', COALESCE(c.lastname, '')) as customerName,
          c.city,
          c.mobileNo,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalPurchaseAmount,
          SUM(CASE WHEN b.paymentStatus = 'pending' THEN b.finalAmount ELSE 0 END) as outstandingAmount,
          MAX(b.createdAt) as lastPurchaseDate
        FROM billings b
        JOIN customers c ON b.customerId = c.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY c.id, c.firstname, c.lastname, c.city, c.mobileNo ORDER BY totalPurchaseAmount DESC LIMIT ?`;
    params.push(limit);

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalPurchaseAmount: parseFloat(r.totalPurchaseAmount) || 0,
        outstandingAmount: parseFloat(r.outstandingAmount) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalCustomers: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalPurchaseAmount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Top customer sales error:', error);
      return { data: [], summary: { totalCustomers: 0, grandTotal: 0 } };
    }
  }

  // 6️⃣ PAYMENT STATUS SUMMARY REPORT
  async getPaymentStatusSummary(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          b.paymentStatus,
          COUNT(b.id) as invoiceCount,
          SUM(b.finalAmount) as totalAmount,
          AVG(b.finalAmount) as avgInvoiceAmount,
          MIN(b.finalAmount) as minAmount,
          MAX(b.finalAmount) as maxAmount
        FROM billings b
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY b.paymentStatus`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        invoiceCount: parseInt(r.invoiceCount) || 0,
        totalAmount: parseFloat(r.totalAmount) || 0,
        avgInvoiceAmount: parseFloat(r.avgInvoiceAmount) || 0,
        minAmount: parseFloat(r.minAmount) || 0,
        maxAmount: parseFloat(r.maxAmount) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalInvoices: parsedResult.reduce(
            (sum, r) => sum + r.invoiceCount,
            0,
          ),
          totalRevenue: parsedResult.reduce((sum, r) => sum + r.totalAmount, 0),
        },
      };
    } catch (error) {
      console.error('Payment status summary error:', error);
      return { data: [], summary: { totalInvoices: 0, totalRevenue: 0 } };
    }
  }

  // 8️⃣ GST ANALYSIS REPORT
  async getGSTAnalysis(fromDate: Date, toDate: Date, distributorId?: number) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      let query = this.billingRepo
        .createQueryBuilder('b')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      }
      const billings = await query.getMany();

      const gstData = {};

      billings.forEach((b) => {
        // Parse values as floats (TypeORM returns decimals as strings)
        const cgst = parseFloat(b.cgstTotal?.toString() || '0') || 0;
        const sgst = parseFloat(b.sgstTotal?.toString() || '0') || 0;
        const igst = parseFloat(b.igstTotal?.toString() || '0') || 0;
        const subtotal = parseFloat(b.subtotal?.toString() || '0') || 0;
        const finalAmount = parseFloat(b.finalAmount?.toString() || '0') || 0;

        const gstType = cgst > 0 && sgst > 0 ? 'CGST+SGST' : 'IGST';
        if (!gstData[gstType]) {
          gstData[gstType] = {
            gstType,
            invoiceCount: 0,
            subtotal: 0,
            totalGST: 0,
            grossTotal: 0,
          };
        }
        gstData[gstType].invoiceCount += 1;
        gstData[gstType].subtotal += subtotal;
        gstData[gstType].totalGST += cgst + sgst + igst;
        gstData[gstType].grossTotal += finalAmount;
      });

      const result = Object.values(gstData).map((r: any) => ({
        gstType: r.gstType,
        invoiceCount: r.invoiceCount,
        subtotal: parseFloat(r.subtotal.toFixed(2)),
        totalGST: parseFloat(r.totalGST.toFixed(2)),
        grossTotal: parseFloat(r.grossTotal.toFixed(2)),
      }));

      const totalGST = result.reduce((sum, r: any) => sum + r.totalGST, 0);
      const totalGrossAmount = result.reduce(
        (sum, r: any) => sum + r.grossTotal,
        0,
      );

      return {
        data: result,
        summary: {
          totalGST: parseFloat(totalGST.toFixed(2)),
          totalGrossAmount: parseFloat(totalGrossAmount.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('GST analysis error:', error);
      return { data: [], summary: { totalGST: 0, totalGrossAmount: 0 } };
    }
  }

  // 9️⃣ SALES BY DISTRIBUTOR REPORT
  async getSalesByDistributor(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          d.id as distributorId,
          CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) as distributorName,
          d.businessName,
          COUNT(DISTINCT b.id) as totalInvoices,
          COUNT(DISTINCT b.poNumber) as totalOrders,
          SUM(b.finalAmount) as totalSalesAmount,
          SUM(b.cgstTotal + b.sgstTotal + b.igstTotal) as totalGST,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM billings b
        LEFT JOIN distributor_master d ON b.distributorId = d.userId
        LEFT JOIN user_master u ON d.userId = u.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY d.id, d.userId, u.firstName, u.lastName, d.businessName ORDER BY totalSalesAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalOrders: parseInt(r.totalOrders) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        totalGST: parseFloat(r.totalGST) || 0,
        uniqueCustomers: parseInt(r.uniqueCustomers) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalDistributors: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Sales by distributor error:', error);
      return { data: [], summary: { totalDistributors: 0, grandTotal: 0 } };
    }
  }

  // 🔟 ORDER APPROVAL ANALYTICS
  async getOrderApprovalAnalytics(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          po.approvalStatus,
          COUNT(po.id) as orderCount,
          SUM(po.totalAmount) as totalAmount,
          AVG(TIMESTAMPDIFF(HOUR, po.createdAt, po.approvedAt)) as avgApprovalHours
        FROM purchase_order_master po
        WHERE po.createdAt BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND po.createdBy = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY po.approvalStatus`;

    try {
      const result = await this.poRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        orderCount: parseInt(r.orderCount) || 0,
        totalAmount: parseFloat(r.totalAmount) || 0,
        avgApprovalHours: parseFloat(r.avgApprovalHours) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalOrders: parsedResult.reduce((sum, r) => sum + r.orderCount, 0),
          totalValue: parsedResult.reduce((sum, r) => sum + r.totalAmount, 0),
        },
      };
    } catch (error) {
      console.error('Order approval analytics error:', error);
      return { data: [], summary: { totalOrders: 0, totalValue: 0 } };
    }
  }

  // 1️⃣1️⃣ STATE/CITY WISE SALES REPORT
  async getStateCityWiseSales(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          c.state,
          c.city,
          COUNT(DISTINCT b.id) as totalInvoices,
          COUNT(DISTINCT b.customerId) as totalCustomers,
          SUM(b.finalAmount) as totalSalesAmount,
          SUM(b.cgstTotal + b.sgstTotal + b.igstTotal) as totalGST,
          AVG(b.finalAmount) as averageOrderValue
        FROM billings b
        LEFT JOIN customers c ON b.customerId = c.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY c.state, c.city ORDER BY totalSalesAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalCustomers: parseInt(r.totalCustomers) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        totalGST: parseFloat(r.totalGST) || 0,
        averageOrderValue: parseFloat(r.averageOrderValue) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalRegions: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
          totalCustomers: parsedResult.reduce(
            (sum, r) => sum + r.totalCustomers,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('State/City wise sales error:', error);
      return {
        data: [],
        summary: { totalRegions: 0, grandTotal: 0, totalCustomers: 0 },
      };
    }
  }

  // 1️⃣2️⃣ CATEGORY WISE SALES REPORT
  async getCategoryWiseSales(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          c.name as categoryName,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(bi.quantity) as totalQuantity,
          SUM(bi.totalAmount) as totalSalesAmount,
          SUM(bi.cgst + bi.sgst + bi.igst) as totalGST,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM billings b
        JOIN billing_items bi ON bi.billingId = b.id
        JOIN item_master im ON bi.itemId = im.id
        LEFT JOIN categories c ON im.categoryId = c.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY c.id, c.name ORDER BY totalSalesAmount DESC`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings (TypeORM returns decimals as strings)
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalInvoices: parseInt(r.totalInvoices) || 0,
        totalQuantity: parseFloat(r.totalQuantity) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        totalGST: parseFloat(r.totalGST) || 0,
        uniqueCustomers: parseInt(r.uniqueCustomers) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalCategories: parsedResult.length,
          grandTotal: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
          totalQuantity: parsedResult.reduce(
            (sum, r) => sum + r.totalQuantity,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Category wise sales error:', error);
      return {
        data: [],
        summary: { totalCategories: 0, grandTotal: 0, totalQuantity: 0 },
      };
    }
  }

  // 1️⃣3️⃣ TOP ITEMS BY QUANTITY REPORT
  async getTopItemsByQuantity(
    fromDate: Date,
    toDate: Date,
    limit: number = 20,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    let query = `
        SELECT 
          im.id as itemId,
          im.name as itemName,
          im.sku,
          SUM(bi.quantity) as totalQuantitySold,
          COUNT(DISTINCT b.id) as invoiceCount,
          SUM(bi.totalAmount) as totalSalesAmount,
          AVG(bi.quantity) as avgQuantityPerInvoice
        FROM billings b
        JOIN billing_items bi ON bi.billingId = b.id
        JOIN item_master im ON bi.itemId = im.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [fromStr, toStr];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += `
        GROUP BY im.id, im.name, im.sku
        ORDER BY totalQuantitySold DESC
        LIMIT ?
      `;
    params.push(limit);

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalQuantitySold: parseFloat(r.totalQuantitySold) || 0,
        invoiceCount: parseInt(r.invoiceCount) || 0,
        totalSalesAmount: parseFloat(r.totalSalesAmount) || 0,
        avgQuantityPerInvoice: parseFloat(r.avgQuantityPerInvoice) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          topItemsCount: parsedResult.length,
          totalQuantity: parsedResult.reduce(
            (sum, r) => sum + r.totalQuantitySold,
            0,
          ),
          totalValue: parsedResult.reduce(
            (sum, r) => sum + r.totalSalesAmount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Top items by quantity error:', error);
      return {
        data: [],
        summary: { topItemsCount: 0, totalQuantity: 0, totalValue: 0 },
      };
    }
  }

  // 1️⃣4️⃣ CREDIT LIMIT UTILIZATION REPORT
  async getCreditLimitUtilization(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          c.id as customerId,
          CONCAT(COALESCE(c.firstname, ''), ' ', COALESCE(c.lastname, '')) as customerName,
          c.city,
          SUM(b.finalAmount) as totalCredit,
          COUNT(DISTINCT b.id) as invoiceCount,
          SUM(CASE WHEN b.paymentStatus = 'pending' THEN b.finalAmount ELSE 0 END) as pendingAmount
        FROM billings b
        JOIN customers c ON b.customerId = c.id
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += `
        GROUP BY c.id, c.firstname, c.lastname, c.city
        ORDER BY pendingAmount DESC
      `;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        totalCredit: parseFloat(r.totalCredit) || 0,
        invoiceCount: parseInt(r.invoiceCount) || 0,
        pendingAmount: parseFloat(r.pendingAmount) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalCustomers: parsedResult.length,
          totalPendingAmount: parsedResult.reduce(
            (sum, r) => sum + r.pendingAmount,
            0,
          ),
          totalCredit: parsedResult.reduce((sum, r) => sum + r.totalCredit, 0),
        },
      };
    } catch (error) {
      console.error('Credit limit utilization error:', error);
      return {
        data: [],
        summary: { totalCustomers: 0, totalPendingAmount: 0, totalCredit: 0 },
      };
    }
  }

  // 1️⃣5️⃣ RETURNS/REFUNDS SUMMARY REPORT
  async getReturnsRefundsSummary(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    // Query sales returns
    let salesQuery = `
        SELECT 
          'Sales Return' as returnType,
          status as approvalStatus,
          COUNT(id) as returnCount,
          SUM(totalAmount) as totalReturnAmount,
          AVG(totalAmount) as averageReturnAmount
        FROM sales_returns
        WHERE createdAt BETWEEN ? AND ?
      `;
    const salesParams: any[] = [from, to];
    if (distributorId) {
      salesQuery += ` AND distributorId = ?`;
      salesParams.push(distributorId);
    }
    salesQuery += ` GROUP BY status`;

    // Query purchase returns
    let purchaseQuery = `
        SELECT 
          'Purchase Return' as returnType,
          status as approvalStatus,
          COUNT(id) as returnCount,
          SUM(totalAmount) as totalReturnAmount,
          AVG(totalAmount) as averageReturnAmount
        FROM purchase_returns
        WHERE createdAt BETWEEN ? AND ?
      `;
    const purchaseParams: any[] = [from, to];
    if (distributorId) {
      purchaseQuery += ` AND distributorId = ?`;
      purchaseParams.push(distributorId);
    }
    purchaseQuery += ` GROUP BY status`;

    try {
      const [salesResult, purchaseResult] = await Promise.all([
        this.billingRepo.query(salesQuery, salesParams),
        this.billingRepo.query(purchaseQuery, purchaseParams),
      ]);
      const combinedResult = [
        ...(salesResult || []),
        ...(purchaseResult || []),
      ];
      // Parse numeric values from strings
      const parsedResult = combinedResult.map((r: any) => ({
        ...r,
        returnCount: parseInt(r.returnCount) || 0,
        totalReturnAmount: parseFloat(r.totalReturnAmount) || 0,
        averageReturnAmount: parseFloat(r.averageReturnAmount) || 0,
      }));
      return {
        data: parsedResult,
        summary: {
          totalReturns: parsedResult.reduce((sum, r) => sum + r.returnCount, 0),
          totalReturnValue: parsedResult.reduce(
            (sum, r) => sum + r.totalReturnAmount,
            0,
          ),
        },
      };
    } catch (error) {
      console.error('Returns/Refunds summary error:', error);
      return { data: [], summary: { totalReturns: 0, totalReturnValue: 0 } };
    }
  }

  // 1️⃣6️⃣ PAYMENT RECOVERY RATE REPORT
  async getPaymentRecoveryRate(
    fromDate: Date,
    toDate: Date,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    let query = `
        SELECT 
          b.paymentStatus,
          COUNT(DISTINCT b.id) as billCount,
          SUM(b.finalAmount) as totalAmount,
          DATEDIFF(NOW(), MAX(b.createdAt)) as daysSinceOldest,
          COUNT(CASE WHEN DATEDIFF(NOW(), b.createdAt) <= 30 THEN 1 END) as withinMonth,
          COUNT(CASE WHEN DATEDIFF(NOW(), b.createdAt) > 30 AND DATEDIFF(NOW(), b.createdAt) <= 90 THEN 1 END) as between30to90,
          COUNT(CASE WHEN DATEDIFF(NOW(), b.createdAt) > 90 THEN 1 END) as overdue90Days
        FROM billings b
        WHERE b.billDate BETWEEN ? AND ?
      `;
    const params: any[] = [from, to];
    if (distributorId) {
      query += ` AND b.distributorId = ?`;
      params.push(distributorId);
    }
    query += ` GROUP BY b.paymentStatus`;

    try {
      const result = await this.billingRepo.query(query, params);
      // Parse numeric values from strings
      const parsedResult = (result || []).map((r: any) => ({
        ...r,
        billCount: parseInt(r.billCount) || 0,
        totalAmount: parseFloat(r.totalAmount) || 0,
        daysSinceOldest: parseInt(r.daysSinceOldest) || 0,
        withinMonth: parseInt(r.withinMonth) || 0,
        between30to90: parseInt(r.between30to90) || 0,
        overdue90Days: parseInt(r.overdue90Days) || 0,
      }));
      const totalBills = parsedResult.reduce((sum, r) => sum + r.billCount, 0);
      const paidBills =
        parsedResult.find((r: any) => r.paymentStatus === 'paid')?.billCount ||
        0;
      const pendingAmount =
        parsedResult.find((r: any) => r.paymentStatus === 'pending')
          ?.totalAmount || 0;
      return {
        data: parsedResult,
        summary: {
          totalBills,
          totalPending: pendingAmount,
          recoveryRate:
            totalBills > 0 ? ((paidBills / totalBills) * 100).toFixed(2) : 0,
        },
      };
    } catch (error) {
      console.error('Payment recovery rate error:', error);
      return {
        data: [],
        summary: { totalBills: 0, totalPending: 0, recoveryRate: 0 },
      };
    }
  }

  // 1️⃣7️⃣ TOP 10 PRODUCTS BY WEEK
  async getTopProductsByWeek(
    fromDate: Date,
    toDate: Date,
    userId?: number,
    userRole?: string,
    period?: string,
    distributorId?: number,
  ) {
    // Determine date range based on period parameter
    let from: Date;
    let to: Date;

    if (period) {
      switch (period.toUpperCase()) {
        case 'TODAY':
          const todayRange = this.getTodayDateRange();
          from = todayRange.from;
          to = todayRange.to;
          break;
        case 'WEEKLY':
          const weeklyRange = this.getCurrentWeekDateRange();
          from = weeklyRange.from;
          to = weeklyRange.to;
          break;
        case 'MONTHLY':
          const monthlyRange = this.getCurrentMonthDateRange();
          from = monthlyRange.from;
          to = monthlyRange.to;
          break;
        case 'YEARLY':
          const yearlyRange = this.getCurrentYearDateRange();
          from = yearlyRange.from;
          to = yearlyRange.to;
          break;
        default:
          ({ from: from, to: to } =
            fromDate && toDate
              ? this.getDateRange(fromDate, toDate)
              : this.getCurrentWeekDateRange());
      }
    } else {
      ({ from, to } =
        fromDate && toDate
          ? this.getDateRange(fromDate, toDate)
          : this.getCurrentWeekDateRange());
    }
    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      let query = this.billingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.billingItems', 'billingItems')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });

      // If distributorId filter is provided (super admin filter), use it
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      }
      // Add distributor filtering only for distributor users (userId IS the distributorId)
      else if (userRole === 'distributor' && userId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId: userId,
        });
      }
      // Super admin sees all data (no filter)

      const billings = await query.getMany();
      const itemMap = new Map();
      billings.forEach((billing) => {
        if (billing.billingItems && Array.isArray(billing.billingItems)) {
          billing.billingItems.forEach((item: any) => {
            const key = item.itemName || 'Unknown';
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                itemName: item.itemName,
                totalQuantity: 0,
                totalAmount: 0,
                invoiceCount: 0,
              });
            }
            const existing = itemMap.get(key);
            // Ensure numeric conversion (TypeORM returns decimals as strings)
            existing.totalQuantity += parseFloat(item.quantity) || 0;
            existing.totalAmount += parseFloat(item.totalAmount) || 0;
            existing.invoiceCount += 1;
          });
        }
      });
      const result = Array.from(itemMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);
      return {
        data: result,
        summary: {
          totalItems: result.length,
          grandTotal: result.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        },
      };
    } catch (error) {
      console.error('Top products by week error:', error);
      return { data: [], summary: { totalItems: 0, grandTotal: 0 } };
    }
  }

  // 1️⃣8️⃣ TOP 10 PRODUCTS BY MONTH
  async getTopProductsByMonth(
    month: number,
    year: number,
    userId?: number,
    userRole?: string,
    distributorId?: number,
  ) {
    // If month/year are provided, use them; otherwise use current month up to today
    let from: Date;
    let to: Date;

    if (month && year) {
      from = new Date(year, month - 1, 1);
      from.setHours(0, 0, 0, 0);
      const today = new Date();
      // If it's the current month, go to today; otherwise go to last day of month
      if (year === today.getFullYear() && month === today.getMonth() + 1) {
        to = new Date(today);
        to.setHours(23, 59, 59, 999);
      } else {
        to = new Date(year, month, 0);
        to.setHours(23, 59, 59, 999);
      }
    } else {
      const range = this.getCurrentMonthDateRange();
      from = range.from;
      to = range.to;
    }

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      let query = this.billingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.billingItems', 'billingItems')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });

      // If distributorId filter is provided (super admin filter), use it
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      }
      // Add distributor filtering only for distributor users (userId IS the distributorId)
      else if (userRole === 'distributor' && userId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId: userId,
        });
      }
      // Super admin sees all data (no filter)

      const billings = await query.getMany();
      const itemMap = new Map();
      billings.forEach((billing) => {
        if (billing.billingItems && Array.isArray(billing.billingItems)) {
          billing.billingItems.forEach((item: any) => {
            const key = item.itemName || 'Unknown';
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                itemName: item.itemName,
                totalQuantity: 0,
                totalAmount: 0,
                invoiceCount: 0,
              });
            }
            const existing = itemMap.get(key);
            // Ensure numeric conversion (TypeORM returns decimals as strings)
            existing.totalQuantity += parseFloat(item.quantity) || 0;
            existing.totalAmount += parseFloat(item.totalAmount) || 0;
            existing.invoiceCount += 1;
          });
        }
      });
      const result = Array.from(itemMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);
      return {
        data: result,
        summary: {
          totalItems: result.length,
          grandTotal: result.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        },
      };
    } catch (error) {
      console.error('Top products by month error:', error);
      return { data: [], summary: { totalItems: 0, grandTotal: 0 } };
    }
  }

  // 1️⃣9️⃣ TOP 10 PRODUCTS BY YEAR
  async getTopProductsByYear(
    year: number,
    userId?: number,
    userRole?: string,
    distributorId?: number,
  ) {
    // If year is provided, use it; otherwise use current year up to today
    let from: Date;
    let to: Date;

    if (year) {
      from = new Date(year, 0, 1);
      from.setHours(0, 0, 0, 0);
      const today = new Date();
      // If it's the current year, go to today; otherwise go to Dec 31
      if (year === today.getFullYear()) {
        to = new Date(today);
        to.setHours(23, 59, 59, 999);
      } else {
        to = new Date(year, 11, 31);
        to.setHours(23, 59, 59, 999);
      }
    } else {
      const range = this.getCurrentYearDateRange();
      from = range.from;
      to = range.to;
    }

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      let query = this.billingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.billingItems', 'billingItems')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });

      // If distributorId filter is provided (super admin filter), use it
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      }
      // Add distributor filtering only for distributor users (userId IS the distributorId)
      else if (userRole === 'distributor' && userId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId: userId,
        });
      }
      // Super admin sees all data (no filter)

      const billings = await query.getMany();
      const itemMap = new Map();
      billings.forEach((billing) => {
        if (billing.billingItems && Array.isArray(billing.billingItems)) {
          billing.billingItems.forEach((item: any) => {
            const key = item.itemName || 'Unknown';
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                itemName: item.itemName,
                totalQuantity: 0,
                totalAmount: 0,
                invoiceCount: 0,
              });
            }
            const existing = itemMap.get(key);
            // Ensure numeric conversion (TypeORM returns decimals as strings)
            existing.totalQuantity += parseFloat(item.quantity) || 0;
            existing.totalAmount += parseFloat(item.totalAmount) || 0;
            existing.invoiceCount += 1;
          });
        }
      });
      const result = Array.from(itemMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);
      return {
        data: result,
        summary: {
          totalItems: result.length,
          grandTotal: result.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        },
      };
    } catch (error) {
      console.error('Top products by year error:', error);
      return { data: [], summary: { totalItems: 0, grandTotal: 0 } };
    }
  }

  // 2️⃣0️⃣ TOP 10 DISTRIBUTORS BY SALES
  async getTop10DistributorsBySales(fromDate: Date, toDate: Date) {
    const { from, to } = this.getDateRange(fromDate, toDate);
    const query = `
        SELECT 
          d.id as distributorId,
          CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) as distributorName,
          d.businessName,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalSalesAmount,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM billings b
        JOIN customers c ON b.customerId = c.id
        JOIN distributor_master d ON c.distributorId = d.id
        JOIN user_master u ON d.userId = u.id
        WHERE b.billDate BETWEEN ? AND ?
        GROUP BY d.id, u.firstName, u.lastName, d.businessName
        ORDER BY totalSalesAmount DESC
        LIMIT 10
      `;
    try {
      const result = await this.billingRepo.query(query, [from, to]);
      return {
        data: result || [],
        summary: {
          totalDistributors: result?.length || 0,
          grandTotal:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalSalesAmount || 0),
              0,
            ) || 0,
        },
      };
    } catch (error) {
      console.error('Top distributors by sales error:', error);
      return { data: [], summary: { totalDistributors: 0, grandTotal: 0 } };
    }
  }

  // 2️⃣1️⃣ LEAST PERFORMING DISTRIBUTORS
  async getLeastPerformingDistributors(fromDate: Date, toDate: Date) {
    const { from, to } = this.getDateRange(fromDate, toDate);
    const query = `
        SELECT 
          d.id as distributorId,
          CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) as distributorName,
          d.businessName,
          COUNT(DISTINCT b.id) as totalInvoices,
          SUM(b.finalAmount) as totalSalesAmount,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM distributor_master d
        JOIN user_master u ON d.userId = u.id
        LEFT JOIN customers c ON d.id = c.distributorId
        LEFT JOIN billings b ON c.id = b.customerId AND b.createdAt BETWEEN ? AND ?
        GROUP BY d.id, u.firstName, u.lastName, d.businessName
        ORDER BY totalSalesAmount ASC
        LIMIT 10
      `;
    try {
      const result = await this.billingRepo.query(query, [from, to]);
      return {
        data: result || [],
        summary: {
          totalDistributors: result?.length || 0,
          grandTotal:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalSalesAmount || 0),
              0,
            ) || 0,
        },
      };
    } catch (error) {
      console.error('Least performing distributors error:', error);
      return { data: [], summary: { totalDistributors: 0, grandTotal: 0 } };
    }
  }

  // 2️⃣2️⃣ CROP-WISE SALES REPORT
  async getCropWiseSales(
    fromDate: Date,
    toDate: Date,
    userId?: number,
    userRole?: string,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      let query = this.billingRepo
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.billingItems', 'bi')
        .leftJoin('item_master', 'im', 'bi.itemId = im.id')
        .where('b.billDate BETWEEN :fromStr AND :toStr', { fromStr, toStr });

      // Apply distributor filter
      if (distributorId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId,
        });
      } else if (userRole === 'distributor' && userId) {
        query = query.andWhere('b.distributorId = :distributorId', {
          distributorId: userId,
        });
      }

      // Use raw query for crop aggregation - cropName is stored in billings table
      const rawQuery = `
          SELECT 
            COALESCE(NULLIF(b.cropName, ''), 'Not Specified') as crop,
            COUNT(DISTINCT b.id) as totalInvoices,
            SUM(bi.quantity) as totalQuantity,
            SUM(bi.totalAmount) as totalSalesAmount,
            COUNT(DISTINCT bi.itemId) as uniqueItems,
            COUNT(DISTINCT b.customerId) as uniqueCustomers
          FROM billings b
          JOIN billing_items bi ON b.id = bi.billingId
          WHERE b.billDate BETWEEN ? AND ?
          ${distributorId ? 'AND b.distributorId = ?' : userRole === 'distributor' && userId ? 'AND b.distributorId = ?' : ''}
          GROUP BY COALESCE(NULLIF(b.cropName, ''), 'Not Specified')
          ORDER BY totalSalesAmount DESC
        `;

      const params = [fromStr, toStr];
      if (distributorId) {
        params.push(distributorId as any);
      } else if (userRole === 'distributor' && userId) {
        params.push(userId as any);
      }

      const result = await this.billingRepo.query(rawQuery, params);

      return {
        data: result || [],
        summary: {
          totalCrops: result?.length || 0,
          grandTotal:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalSalesAmount || 0),
              0,
            ) || 0,
          totalQuantity:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalQuantity || 0),
              0,
            ) || 0,
        },
      };
    } catch (error) {
      console.error('Crop-wise sales error:', error);
      return {
        data: [],
        summary: { totalCrops: 0, grandTotal: 0, totalQuantity: 0 },
      };
    }
  }

  // 2️⃣3️⃣ DISEASE-WISE SALES REPORT
  async getDiseaseWiseSales(
    fromDate: Date,
    toDate: Date,
    userId?: number,
    userRole?: string,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // cropDiseases is stored in billings table, not item_master
      const rawQuery = `
          SELECT 
            COALESCE(NULLIF(b.cropDiseases, ''), 'Not Specified') as disease,
            '' as targetPest,
            COUNT(DISTINCT b.id) as totalInvoices,
            SUM(bi.quantity) as totalQuantity,
            SUM(bi.totalAmount) as totalSalesAmount,
            COUNT(DISTINCT bi.itemId) as uniqueItems,
            COUNT(DISTINCT b.customerId) as uniqueCustomers
          FROM billings b
          JOIN billing_items bi ON b.id = bi.billingId
          WHERE b.billDate BETWEEN ? AND ?
          ${distributorId ? 'AND b.distributorId = ?' : userRole === 'distributor' && userId ? 'AND b.distributorId = ?' : ''}
          GROUP BY COALESCE(NULLIF(b.cropDiseases, ''), 'Not Specified')
          ORDER BY totalSalesAmount DESC
        `;

      const params = [fromStr, toStr];
      if (distributorId) {
        params.push(distributorId as any);
      } else if (userRole === 'distributor' && userId) {
        params.push(userId as any);
      }

      const result = await this.billingRepo.query(rawQuery, params);

      return {
        data: result || [],
        summary: {
          totalDiseases: result?.length || 0,
          grandTotal:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalSalesAmount || 0),
              0,
            ) || 0,
          totalQuantity:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalQuantity || 0),
              0,
            ) || 0,
        },
      };
    } catch (error) {
      console.error('Disease-wise sales error:', error);
      return {
        data: [],
        summary: { totalDiseases: 0, grandTotal: 0, totalQuantity: 0 },
      };
    }
  }

  // 2️⃣4️⃣ CROP & DISEASE COMBINED SALES REPORT
  async getCropDiseaseSales(
    fromDate: Date,
    toDate: Date,
    userId?: number,
    userRole?: string,
    distributorId?: number,
  ) {
    const { from, to } = this.getDateRange(fromDate, toDate);

    try {
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // cropName and cropDiseases are stored in billings table, not item_master
      const rawQuery = `
          SELECT 
            COALESCE(NULLIF(b.cropName, ''), 'Not Specified') as crop,
            COALESCE(NULLIF(b.cropDiseases, ''), 'Not Specified') as disease,
            COUNT(DISTINCT b.id) as totalInvoices,
            SUM(bi.quantity) as totalQuantity,
            SUM(bi.totalAmount) as totalSalesAmount,
            COUNT(DISTINCT b.customerId) as uniqueCustomers
          FROM billings b
          JOIN billing_items bi ON b.id = bi.billingId
          WHERE b.billDate BETWEEN ? AND ?
          ${distributorId ? 'AND b.distributorId = ?' : userRole === 'distributor' && userId ? 'AND b.distributorId = ?' : ''}
          GROUP BY COALESCE(NULLIF(b.cropName, ''), 'Not Specified'), COALESCE(NULLIF(b.cropDiseases, ''), 'Not Specified')
          ORDER BY totalSalesAmount DESC
          LIMIT 50
        `;

      const params = [fromStr, toStr];
      if (distributorId) {
        params.push(distributorId as any);
      } else if (userRole === 'distributor' && userId) {
        params.push(userId as any);
      }

      const result = await this.billingRepo.query(rawQuery, params);

      // Group by crop for summary
      const cropSummary = {};
      const diseaseSummary = {};

      result?.forEach((r) => {
        // Crop summary
        if (!cropSummary[r.crop]) {
          cropSummary[r.crop] = { crop: r.crop, totalAmount: 0, totalQty: 0 };
        }
        cropSummary[r.crop].totalAmount += parseFloat(r.totalSalesAmount || 0);
        cropSummary[r.crop].totalQty += parseFloat(r.totalQuantity || 0);

        // Disease summary
        if (!diseaseSummary[r.disease]) {
          diseaseSummary[r.disease] = {
            disease: r.disease,
            totalAmount: 0,
            totalQty: 0,
          };
        }
        diseaseSummary[r.disease].totalAmount += parseFloat(
          r.totalSalesAmount || 0,
        );
        diseaseSummary[r.disease].totalQty += parseFloat(r.totalQuantity || 0);
      });

      return {
        data: result || [],
        cropSummary: Object.values(cropSummary).sort(
          (a: any, b: any) => b.totalAmount - a.totalAmount,
        ),
        diseaseSummary: Object.values(diseaseSummary).sort(
          (a: any, b: any) => b.totalAmount - a.totalAmount,
        ),
        summary: {
          totalRecords: result?.length || 0,
          grandTotal:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalSalesAmount || 0),
              0,
            ) || 0,
          totalQuantity:
            result?.reduce(
              (sum, r) => sum + parseFloat(r.totalQuantity || 0),
              0,
            ) || 0,
          uniqueCrops: Object.keys(cropSummary).length,
          uniqueDiseases: Object.keys(diseaseSummary).length,
        },
      };
    } catch (error) {
      console.error('Crop & Disease sales error:', error);
      return {
        data: [],
        cropSummary: [],
        diseaseSummary: [],
        summary: {
          totalRecords: 0,
          grandTotal: 0,
          totalQuantity: 0,
          uniqueCrops: 0,
          uniqueDiseases: 0,
        },
      };
    }
  }

  // 2️⃣5️⃣ TOP 5 EXPIRING ITEMS
  // ENTERPRISE INVENTORY: Uses inventory_lot table instead of legacy batch_details
  async getExpiringItems(
    days: number = 30,
    distributorId?: number,
    limit: number = 5,
  ) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Calculate available quantity from transactions (IN - OUT - RESERVE + RELEASE)
      let query = `
        SELECT 
          il.id,
          il.lotNumber as batchNumber,
          il.expiryDate,
          COALESCE(
            (SELECT SUM(
              CASE 
                WHEN t.movementType = 'IN' THEN t.quantity
                WHEN t.movementType = 'OUT' THEN -t.quantity
                WHEN t.movementType = 'RESERVE' THEN -t.quantity
                WHEN t.movementType = 'RELEASE' THEN t.quantity
                ELSE 0 
              END
            )
            FROM inventory_transaction t 
            WHERE t.lotId = il.id AND t.status = 'COMPLETED'), 0
          ) as quantity,
          im.id as itemId,
          im.name as itemName,
          im.unit,
          il.distributorId,
          DATEDIFF(il.expiryDate, CURDATE()) as daysToExpiry,
          CASE 
            WHEN il.expiryDate < CURDATE() THEN 'expired'
            WHEN DATEDIFF(il.expiryDate, CURDATE()) <= 7 THEN 'critical'
            WHEN DATEDIFF(il.expiryDate, CURDATE()) <= 30 THEN 'warning'
            ELSE 'ok'
          END as status
        FROM inventory_lot il
        INNER JOIN item_master im ON il.itemId = im.id
        WHERE il.expiryDate IS NOT NULL 
          AND il.expiryDate <= ?
      `;

      const params: any[] = [futureDateStr];

      if (distributorId) {
        query += ` AND il.distributorId = ?`;
        params.push(distributorId);
      }

      // Filter to only lots with positive quantity and order by expiry
      query += ` HAVING quantity > 0 ORDER BY il.expiryDate ASC LIMIT ?`;
      params.push(limit);

      const result = await this.billingRepo.query(query, params);

      return {
        data: result || [],
        summary: {
          totalExpiring: result?.length || 0,
          expired:
            result?.filter((r: any) => r.status === 'expired').length || 0,
          critical:
            result?.filter((r: any) => r.status === 'critical').length || 0,
          warning:
            result?.filter((r: any) => r.status === 'warning').length || 0,
        },
      };
    } catch (error) {
      console.error('Expiring items error:', error);
      return {
        data: [],
        summary: { totalExpiring: 0, expired: 0, critical: 0, warning: 0 },
      };
    }
  }

  // 2️⃣6️⃣ DAILY SALES TREND (Last 7 days)
  async getDailySalesTrend(days: number = 7, distributorId?: number) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);

      // Use local date format to avoid timezone issues
      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);

      // Query all billings regardless of status to show all sales data
      let query = `
        SELECT 
          DATE(b.billDate) as date,
          COUNT(DISTINCT b.id) as totalInvoices,
          COALESCE(SUM(b.finalAmount), 0) as totalSales,
          COUNT(DISTINCT b.customerId) as uniqueCustomers
        FROM billings b
        WHERE b.billDate BETWEEN ? AND ?
      `;

      const params: any[] = [startStr, endStr];

      if (distributorId) {
        query += ` AND b.distributorId = ?`;
        params.push(distributorId);
      }

      query += ` GROUP BY DATE(b.billDate) ORDER BY date ASC`;

      const result = await this.billingRepo.query(query, params);

      // Fill in missing dates with zero values
      const dateMap = new Map();
      result?.forEach((r: any) => {
        // Handle date which might be a Date object or string
        let dateKey: string;
        if (r.date instanceof Date) {
          dateKey = r.date.toISOString().split('T')[0];
        } else if (typeof r.date === 'string') {
          // If it's already a string like "2025-12-16", use it directly
          dateKey = r.date.split('T')[0];
        } else {
          dateKey = String(r.date);
        }

        dateMap.set(dateKey, {
          date: dateKey,
          totalInvoices: parseInt(r.totalInvoices) || 0,
          totalSales: parseFloat(r.totalSales) || 0,
          uniqueCustomers: parseInt(r.uniqueCustomers) || 0,
        });
      });

      const filledData = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = formatLocalDate(d);
        filledData.push(
          dateMap.get(dateStr) || {
            date: dateStr,
            totalInvoices: 0,
            totalSales: 0,
            uniqueCustomers: 0,
          },
        );
      }

      const totalSales = filledData.reduce((sum, d) => sum + d.totalSales, 0);
      const totalInvoices = filledData.reduce(
        (sum, d) => sum + d.totalInvoices,
        0,
      );

      return {
        data: filledData,
        summary: {
          totalSales,
          totalInvoices,
          avgDailySales: totalSales / days,
          period: `${startStr} to ${endStr}`,
        },
      };
    } catch (error) {
      console.error('Daily sales trend error:', error);
      return {
        data: [],
        summary: {
          totalSales: 0,
          totalInvoices: 0,
          avgDailySales: 0,
          period: '',
        },
      };
    }
  }

  // 2️⃣7️⃣ WEEKLY SALES SUMMARY (Monday to Sunday)
  async getWeeklySalesSummary(distributorId?: number) {
    try {
      // Get current week (Monday to Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];

      let query = `
        SELECT 
          SUM(b.finalAmount) as totalSales,
          COUNT(DISTINCT b.id) as totalInvoices,
          COUNT(DISTINCT b.customerId) as uniqueCustomers,
          SUM(CASE WHEN b.paymentType = 'cash' THEN b.finalAmount ELSE 0 END) as cashSales,
          SUM(CASE WHEN b.paymentType = 'online' THEN b.finalAmount ELSE 0 END) as onlineSales,
          SUM(CASE WHEN b.paymentType = 'credit' THEN b.finalAmount ELSE 0 END) as creditSales
        FROM billings b
        WHERE b.billDate BETWEEN ? AND ?
          AND (b.approvalStatus = 'approved' OR b.status = 'completed')
      `;

      const params: any[] = [mondayStr, sundayStr];

      if (distributorId) {
        query += ` AND b.distributorId = ?`;
        params.push(distributorId);
      }

      const result = await this.billingRepo.query(query, params);
      const data = result?.[0] || {};

      return {
        period: { from: mondayStr, to: sundayStr },
        totalSales: parseFloat(data.totalSales) || 0,
        totalInvoices: parseInt(data.totalInvoices) || 0,
        uniqueCustomers: parseInt(data.uniqueCustomers) || 0,
        cashSales: parseFloat(data.cashSales) || 0,
        onlineSales: parseFloat(data.onlineSales) || 0,
        creditSales: parseFloat(data.creditSales) || 0,
      };
    } catch (error) {
      console.error('Weekly sales summary error:', error);
      return {
        period: { from: '', to: '' },
        totalSales: 0,
        totalInvoices: 0,
        uniqueCustomers: 0,
        cashSales: 0,
        onlineSales: 0,
        creditSales: 0,
      };
    }
  }

  // 2️⃣8️⃣ MONTHLY SALES SUMMARY
  async getMonthlySalesSummary(distributorId?: number) {
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const firstDayStr = firstDay.toISOString().split('T')[0];
      const lastDayStr = lastDay.toISOString().split('T')[0];

      let query = `
        SELECT 
          SUM(b.finalAmount) as totalSales,
          COUNT(DISTINCT b.id) as totalInvoices,
          COUNT(DISTINCT b.customerId) as uniqueCustomers,
          SUM(CASE WHEN b.paymentType = 'cash' THEN b.finalAmount ELSE 0 END) as cashSales,
          SUM(CASE WHEN b.paymentType = 'online' THEN b.finalAmount ELSE 0 END) as onlineSales,
          SUM(CASE WHEN b.paymentType = 'credit' THEN b.finalAmount ELSE 0 END) as creditSales
        FROM billings b
        WHERE b.billDate BETWEEN ? AND ?
          AND (b.approvalStatus = 'approved' OR b.status = 'completed')
      `;

      const params: any[] = [firstDayStr, lastDayStr];

      if (distributorId) {
        query += ` AND b.distributorId = ?`;
        params.push(distributorId);
      }

      const result = await this.billingRepo.query(query, params);
      const data = result?.[0] || {};

      return {
        period: { from: firstDayStr, to: lastDayStr },
        totalSales: parseFloat(data.totalSales) || 0,
        totalInvoices: parseInt(data.totalInvoices) || 0,
        uniqueCustomers: parseInt(data.uniqueCustomers) || 0,
        cashSales: parseFloat(data.cashSales) || 0,
        onlineSales: parseFloat(data.onlineSales) || 0,
        creditSales: parseFloat(data.creditSales) || 0,
      };
    } catch (error) {
      console.error('Monthly sales summary error:', error);
      return {
        period: { from: '', to: '' },
        totalSales: 0,
        totalInvoices: 0,
        uniqueCustomers: 0,
        cashSales: 0,
        onlineSales: 0,
        creditSales: 0,
      };
    }
  }

  // 2️⃣9️⃣ TOP CUSTOMERS
  async getTopCustomers(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    distributorId?: number,
    limit: number = 10,
  ) {
    try {
      let dateRange;
      switch (period) {
        case 'daily':
          dateRange = this.getTodayDateRange();
          break;
        case 'weekly':
          dateRange = this.getCurrentWeekDateRange();
          break;
        case 'yearly':
          dateRange = this.getCurrentYearDateRange();
          break;
        default:
          dateRange = this.getCurrentMonthDateRange();
      }

      const fromStr = dateRange.from.toISOString().split('T')[0];
      const toStr = dateRange.to.toISOString().split('T')[0];

      let query = `
        SELECT 
          c.id as customerId,
          CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) as customerName,
          c.mobileNo,
          c.city,
          COUNT(DISTINCT b.id) as totalOrders,
          SUM(b.finalAmount) as totalPurchase
        FROM billings b
        INNER JOIN customers c ON b.customerId = c.id
        WHERE b.billDate BETWEEN ? AND ?
          AND (b.approvalStatus = 'approved' OR b.status = 'completed')
      `;

      const params: any[] = [fromStr, toStr];

      if (distributorId) {
        query += ` AND b.distributorId = ?`;
        params.push(distributorId);
      }

      query += ` GROUP BY c.id ORDER BY totalPurchase DESC LIMIT ?`;
      params.push(limit);

      const result = await this.billingRepo.query(query, params);

      return {
        period: { from: fromStr, to: toStr, type: period },
        data:
          result?.map((r: any) => ({
            ...r,
            totalOrders: parseInt(r.totalOrders) || 0,
            totalPurchase: parseFloat(r.totalPurchase) || 0,
          })) || [],
      };
    } catch (error) {
      console.error('Top customers error:', error);
      return { period: { from: '', to: '', type: period }, data: [] };
    }
  }

  // 3️⃣0️⃣ PO SUMMARY
  async getPOSummary(distributorId?: number) {
    try {
      let query = `
        SELECT 
          COUNT(*) as totalPOs,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingPOs,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedPOs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedPOs,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledPOs,
          SUM(totalAmount) as totalValue
        FROM purchase_orders
        WHERE 1=1
      `;

      const params: any[] = [];

      if (distributorId) {
        query += ` AND distributorId = ?`;
        params.push(distributorId);
      }

      const result = await this.poRepo.query(query, params);
      const data = result?.[0] || {};

      return {
        totalPOs: parseInt(data.totalPOs) || 0,
        pendingPOs: parseInt(data.pendingPOs) || 0,
        approvedPOs: parseInt(data.approvedPOs) || 0,
        completedPOs: parseInt(data.completedPOs) || 0,
        cancelledPOs: parseInt(data.cancelledPOs) || 0,
        totalValue: parseFloat(data.totalValue) || 0,
      };
    } catch (error) {
      console.error('PO summary error:', error);
      return {
        totalPOs: 0,
        pendingPOs: 0,
        approvedPOs: 0,
        completedPOs: 0,
        cancelledPOs: 0,
        totalValue: 0,
      };
    }
  }
}
