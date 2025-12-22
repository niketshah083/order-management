import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributorLedgerEntity } from './ledger.entity';
import { GrnEntity } from 'src/orders/entities/grn.entity';
import { DistributorPaymentEntryEntity } from 'src/distributor-payment-entries/entities/distributor-payment-entry.entity';
import { PurchaseReturnEntity } from 'src/returns/entities/purchase-return.entity';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(DistributorLedgerEntity)
    private ledgerRepository: Repository<DistributorLedgerEntity>,
    @InjectRepository(GrnEntity)
    private grnRepository: Repository<GrnEntity>,
    @InjectRepository(DistributorPaymentEntryEntity)
    private paymentEntryRepository: Repository<DistributorPaymentEntryEntity>,
    @InjectRepository(PurchaseReturnEntity)
    private purchaseReturnRepository: Repository<PurchaseReturnEntity>,
  ) {}

  async createEntry(
    distributorId: number,
    transactionType:
      | 'PURCHASE'
      | 'PAYMENT'
      | 'CREDIT_ADJUSTMENT'
      | 'REFUND'
      | 'OPENING_BALANCE',
    amount: number,
    description?: string,
    referenceNo?: string,
    referenceType?: string,
    referenceId?: number,
  ) {
    const previousBalance = await this.getRunningBalance(distributorId);
    const runningBalance =
      transactionType === 'PURCHASE' ||
      transactionType === 'CREDIT_ADJUSTMENT' ||
      transactionType === 'OPENING_BALANCE'
        ? previousBalance + amount
        : previousBalance - amount;

    const entry = this.ledgerRepository.create({
      distributorId,
      transactionType,
      amount,
      description,
      referenceNo,
      referenceType,
      referenceId,
      runningBalance,
    });

    return await this.ledgerRepository.save(entry);
  }

  async getDistributorLedger(
    distributorId: number,
    limit = 100,
    offset = 0,
    startDate?: string,
    endDate?: string,
  ) {
    // Calculate ledger dynamically from GRNs, Payments, and Purchase Returns
    const ledgerItems: any[] = [];

    // Get approved GRNs (DEBITS)
    const grnsQuery = this.grnRepository
      .createQueryBuilder('grn')
      .where('grn.distributorId = :distributorId', { distributorId })
      .andWhere('grn.status = :status', { status: 'APPROVED' });

    if (startDate) {
      grnsQuery.andWhere('grn.approvedAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      grnsQuery.andWhere('grn.approvedAt < :endDate', { endDate: nextDay });
    }

    const grns = await grnsQuery.orderBy('grn.approvedAt', 'DESC').getMany();
    grns.forEach((grn) => {
      ledgerItems.push({
        id: `grn-${grn.id}`,
        distributorId: grn.distributorId,
        transactionType: 'PURCHASE', // Changed from 'GRN' to match frontend expectations
        amount: parseFloat(grn.totalAmount.toString()),
        description: `GRN Receipt - ${grn.grnNo}`,
        referenceNo: grn.grnNo,
        referenceType: 'GRN',
        referenceId: grn.id,
        createdAt: grn.approvedAt,
        isDebit: true,
      });
    });

    // Get approved Payment Entries (CREDITS)
    const paymentsQuery = this.paymentEntryRepository
      .createQueryBuilder('payment')
      .where('payment.distributorId = :distributorId', { distributorId })
      .andWhere('payment.status = :status', { status: 'APPROVED' });

    if (startDate) {
      // Use COALESCE to handle null approvedAt - fall back to paymentDate or createdAt
      paymentsQuery.andWhere(
        '(COALESCE(payment.approvedAt, payment.paymentDate, payment.createdAt) >= :startDate)',
        { startDate: new Date(startDate) },
      );
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      paymentsQuery.andWhere(
        '(COALESCE(payment.approvedAt, payment.paymentDate, payment.createdAt) < :endDate)',
        { endDate: nextDay },
      );
    }

    const payments = await paymentsQuery
      .orderBy(
        'COALESCE(payment.approvedAt, payment.paymentDate, payment.createdAt)',
        'DESC',
      )
      .getMany();
    payments.forEach((payment) => {
      // Use approvedAt if available, otherwise fall back to paymentDate or createdAt
      const transactionDate =
        payment.approvedAt || payment.paymentDate || payment.createdAt;
      ledgerItems.push({
        id: `payment-${payment.id}`,
        distributorId: payment.distributorId,
        transactionType: 'PAYMENT',
        amount: parseFloat(payment.amount.toString()),
        description: `Payment - ${payment.paymentMode}`,
        referenceNo:
          payment.referenceNo || `CHQ-${payment.chequeNo || payment.id}`,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        createdAt: transactionDate,
        isDebit: false,
      });
    });

    // Get approved Purchase Returns (CREDITS)
    const returnsQuery = this.purchaseReturnRepository
      .createQueryBuilder('ret')
      .where('ret.distributorId = :distributorId', { distributorId })
      .andWhere('ret.status = :status', { status: 'approved' });

    if (startDate) {
      returnsQuery.andWhere('ret.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      returnsQuery.andWhere('ret.createdAt < :endDate', { endDate: nextDay });
    }

    const returns = await returnsQuery
      .orderBy('ret.createdAt', 'DESC')
      .getMany();
    returns.forEach((ret) => {
      ledgerItems.push({
        id: `return-${ret.id}`,
        distributorId: ret.distributorId,
        transactionType: 'REFUND', // Changed from 'PURCHASE_RETURN' to match frontend expectations
        amount: parseFloat(ret.totalAmount.toString()),
        description: `Purchase Return - ${ret.returnNo}`,
        referenceNo: ret.returnNo,
        referenceType: 'PURCHASE_RETURN',
        referenceId: ret.id,
        createdAt: ret.createdAt,
        isDebit: false,
      });
    });

    // Sort by date ASCENDING first to calculate running balance correctly
    ledgerItems.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Calculate running balance from oldest to newest
    let runningBalance = 0;
    ledgerItems.forEach((item) => {
      if (item.isDebit) {
        runningBalance += item.amount;
      } else {
        runningBalance -= item.amount;
      }
      item.runningBalance = runningBalance;
    });

    // Now sort by date DESCENDING for display (newest first)
    ledgerItems.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Apply pagination
    const totalCount = ledgerItems.length;
    const data = ledgerItems.slice(offset, offset + limit);

    return { data, totalCount };
  }

  async getRunningBalance(distributorId: number): Promise<number> {
    const lastEntry = await this.ledgerRepository.findOne({
      where: { distributorId },
      order: { createdAt: 'DESC' },
    });

    return lastEntry ? lastEntry.runningBalance : 0;
  }

  async getLedgerSummary(
    distributorId: number,
    startDate?: string,
    endDate?: string,
  ) {
    // Calculate total debits (Approved GRNs)
    let debitsQuery = this.grnRepository
      .createQueryBuilder('grn')
      .select('COALESCE(SUM(grn.totalAmount), 0)', 'total')
      .where('grn.distributorId = :distributorId', { distributorId })
      .andWhere('grn.status = :status', { status: 'APPROVED' });

    if (startDate) {
      debitsQuery = debitsQuery.andWhere('grn.approvedAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      debitsQuery = debitsQuery.andWhere('grn.approvedAt < :endDate', {
        endDate: nextDay,
      });
    }

    const debits = await debitsQuery.getRawOne();

    // Calculate total credits (Approved Payments + Approved Purchase Returns)
    let creditsQuery = this.paymentEntryRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.distributorId = :distributorId', { distributorId })
      .andWhere('payment.status = :status', { status: 'APPROVED' });

    if (startDate) {
      // Use COALESCE to handle null approvedAt - fall back to paymentDate or createdAt
      creditsQuery = creditsQuery.andWhere(
        '(COALESCE(payment.approvedAt, payment.paymentDate, payment.createdAt) >= :startDate)',
        { startDate: new Date(startDate) },
      );
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      creditsQuery = creditsQuery.andWhere(
        '(COALESCE(payment.approvedAt, payment.paymentDate, payment.createdAt) < :endDate)',
        { endDate: nextDay },
      );
    }

    const creditPayments = await creditsQuery.getRawOne();

    // Get purchase returns credits
    let returnsQuery = this.purchaseReturnRepository
      .createQueryBuilder('ret')
      .select('COALESCE(SUM(ret.totalAmount), 0)', 'total')
      .where('ret.distributorId = :distributorId', { distributorId })
      .andWhere('ret.status = :status', { status: 'approved' });

    if (startDate) {
      returnsQuery = returnsQuery.andWhere('ret.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      returnsQuery = returnsQuery.andWhere('ret.createdAt < :endDate', {
        endDate: nextDay,
      });
    }

    const creditReturns = await returnsQuery.getRawOne();

    // Running balance = Total Debits (GRNs) - Total Credits (Payments + Returns)
    const totalDebits = parseFloat(debits.total);
    const totalPayments = parseFloat(creditPayments.total);
    const totalReturns = parseFloat(creditReturns.total);
    const totalCredits = totalPayments + totalReturns;
    const runningBalance = totalDebits - totalCredits;

    return {
      totalPurchases: totalDebits, // Debits from GRNs
      totalPayments: totalCredits, // Credits from Payments + Purchase Returns
      runningBalance,
    };
  }

  async deleteEntry(id: number) {
    await this.ledgerRepository.delete(id);
    return { message: 'Ledger entry deleted successfully' };
  }

  async generateLedgerPDF(distributorId: number): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Collect PDF content in buffer
    const chunks: any[] = [];
    return new Promise(async (resolve, reject) => {
      try {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Get ledger data
        const { data, totalCount } = await this.getDistributorLedger(
          distributorId,
          1000,
          0,
        );
        const summary = await this.getLedgerSummary(distributorId);

        // Header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('Distributor Ledger', { align: 'center' });
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Generated on ${new Date().toLocaleDateString()}`, {
            align: 'center',
          });
        doc.moveDown();

        // Summary Section
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Summary', { underline: true });
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Purchases: ₹${summary.totalPurchases.toFixed(2)}`);
        doc.text(`Total Payments: ₹${summary.totalPayments.toFixed(2)}`);
        doc.text(`Running Balance: ₹${summary.runningBalance.toFixed(2)}`);
        doc.moveDown();

        // Table Header
        const colX = {
          date: 40,
          type: 150,
          amount: 250,
          balance: 330,
          ref: 430,
        };
        const tableTop = doc.y;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Date', colX.date, tableTop);
        doc.text('Type', colX.type, tableTop);
        doc.text('Amount', colX.amount, tableTop);
        doc.text('Balance', colX.balance, tableTop);
        doc.text('Reference', colX.ref, tableTop);

        // Draw line
        doc
          .moveTo(40, tableTop + 15)
          .lineTo(550, tableTop + 15)
          .stroke();

        // Table Data
        doc.fontSize(8).font('Helvetica');
        let yPosition = tableTop + 25;

        data.forEach((entry) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 40;
          }

          const dateStr = new Date(entry.createdAt).toLocaleDateString();
          doc.text(dateStr, colX.date);
          doc.text(entry.transactionType, colX.type);
          doc.text(`₹${entry.amount.toFixed(2)}`, colX.amount);
          doc.text(`₹${entry.runningBalance.toFixed(2)}`, colX.balance);
          doc.text(entry.referenceNo || '-', colX.ref);

          yPosition += 15;
          doc
            .moveTo(40, yPosition - 10)
            .lineTo(550, yPosition - 10)
            .stroke('lightgray');
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async exportLedgerAsCSV(distributorId: number): Promise<string> {
    const { data } = await this.getDistributorLedger(distributorId, 10000, 0);
    const summary = await this.getLedgerSummary(distributorId);

    let csv = 'Distributor Ledger Export\n';
    csv += `Generated on,${new Date().toLocaleDateString()}\n\n`;

    csv += 'SUMMARY\n';
    csv += `Total Purchases,₹${summary.totalPurchases.toFixed(2)}\n`;
    csv += `Total Payments,₹${summary.totalPayments.toFixed(2)}\n`;
    csv += `Running Balance,₹${summary.runningBalance.toFixed(2)}\n\n`;

    csv += 'TRANSACTIONS\n';
    csv += 'Date,Type,Amount,Balance,Reference No,Description\n';

    data.forEach((entry) => {
      const dateStr = new Date(entry.createdAt).toLocaleDateString();
      csv += `${dateStr},"${entry.transactionType}",₹${entry.amount.toFixed(2)},₹${entry.runningBalance.toFixed(2)},"${entry.referenceNo || ''}","${entry.description || ''}"\n`;
    });

    return csv;
  }
}
