import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseReturnEntity } from './entities/purchase-return.entity';
import { SalesReturnEntity } from './entities/sales-return.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { BillingEntity } from 'src/billing/entities/billing.entity';
import { InventoryCoreService } from 'src/inventory/inventory-core.service';
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(PurchaseReturnEntity)
    private purchaseReturnRepository: Repository<PurchaseReturnEntity>,
    @InjectRepository(SalesReturnEntity)
    private salesReturnRepository: Repository<SalesReturnEntity>,
    @InjectRepository(BillingEntity)
    private billingRepository: Repository<BillingEntity>,
    private inventoryCoreService: InventoryCoreService,
    private ledgerService: LedgerService,
  ) {}

  // Purchase Returns
  async createPurchaseReturn(
    createPurchaseReturnDto: CreatePurchaseReturnDto,
    distributorId: number,
  ) {
    const { poNumber, reason, notes, items } = createPurchaseReturnDto;
    const returnNo = `PRET-${Date.now()}`;
    const returnDate = new Date().toISOString().split('T')[0];

    const purchaseReturns = [];
    for (const item of items) {
      const totalAmount = item.quantity * item.unitPrice;
      const purchaseReturn = this.purchaseReturnRepository.create({
        returnNo: returnNo,
        returnDate: returnDate,
        distributorId: distributorId,
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.unitPrice,
        totalAmount: totalAmount,
        reason: reason,
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
        expiryDate: item.expiryDate || null,
        batchDetailId: item.batchDetailId || null,
        serialDetailId: item.serialDetailId || null,
      } as any);
      purchaseReturns.push(purchaseReturn);
    }

    return await this.purchaseReturnRepository.save(purchaseReturns);
  }

  async findAllPurchaseReturns(distributorId?: number, status?: string) {
    const query = this.purchaseReturnRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.distributor', 'distributor')
      .leftJoinAndSelect('pr.item', 'item');

    if (distributorId) {
      query.where('pr.distributorId = :distributorId', { distributorId });
    }
    if (status) {
      query.andWhere('pr.status = :status', { status });
    }

    return await query.orderBy('pr.returnDate', 'DESC').getMany();
  }

  async updatePurchaseReturnStatus(
    id: number,
    status: 'pending' | 'approved' | 'rejected',
  ) {
    const purchaseReturn = await this.purchaseReturnRepository.findOne({
      where: { id },
      relations: ['distributor', 'item'],
    });

    if (!purchaseReturn) {
      throw new NotFoundException(`Purchase return with ID ${id} not found`);
    }

    // Only allow state transitions from 'pending' to 'approved' or 'rejected'
    if (purchaseReturn.status !== 'pending') {
      throw new BadRequestException(
        `Cannot change status of a ${purchaseReturn.status} purchase return`,
      );
    }

    // When purchase return is approved by admin, create PURCHASE_RETURN transaction (OUT)
    if (status === 'approved') {
      await this.processPurchaseReturnInventory(purchaseReturn);
    }

    // Update the status
    await this.purchaseReturnRepository.update(id, { status });

    return await this.purchaseReturnRepository.findOne({
      where: { id },
      relations: ['distributor', 'item'],
    });
  }

  async approvePurchaseReturn(
    id: number,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
    adminComments?: string,
  ) {
    const purchaseReturn = await this.purchaseReturnRepository.findOne({
      where: { id },
      relations: ['distributor', 'item'],
    });

    if (!purchaseReturn) {
      throw new NotFoundException(`Purchase return with ID ${id} not found`);
    }

    if (purchaseReturn.status !== 'pending') {
      throw new BadRequestException(
        `Cannot change status of a ${purchaseReturn.status} purchase return`,
      );
    }

    if (status === 'approved') {
      // Process inventory using enterprise system - creates PURCHASE_RETURN transaction (OUT)
      await this.processPurchaseReturnInventory(purchaseReturn);

      // Create ledger entry for REFUND (CREDIT - decreases distributor's debt)
      try {
        await this.ledgerService.createEntry(
          purchaseReturn.distributorId,
          'REFUND',
          purchaseReturn.totalAmount,
          `Purchase return approved - ${purchaseReturn.returnNo}`,
          purchaseReturn.returnNo,
          'PURCHASE_RETURN',
          purchaseReturn.id,
        );
      } catch (error) {
        console.error(
          'Error creating ledger entry for purchase return:',
          error,
        );
        // Continue with approval even if ledger entry fails
      }
    }

    const updateData: any = { status };
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (adminComments) updateData.adminComments = adminComments;

    await this.purchaseReturnRepository.update(id, updateData);

    return await this.purchaseReturnRepository.findOne({
      where: { id },
      relations: ['distributor', 'item'],
    });
  }

  /**
   * Process purchase return inventory using enterprise system
   * Creates PURCHASE_RETURN transaction (OUT) and updates serial status if applicable
   *
   * Requirements: 9.1, 9.2, 9.3
   */
  private async processPurchaseReturnInventory(
    purchaseReturn: PurchaseReturnEntity,
  ): Promise<void> {
    // Get or create default warehouse for distributor
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        purchaseReturn.distributorId,
      );

    // Find lot if batch number is provided
    let lotId: number | undefined;
    if (purchaseReturn.batchNumber) {
      const lot = await this.inventoryCoreService.getLotByNumber(
        purchaseReturn.batchNumber,
        purchaseReturn.itemId,
      );
      if (lot) {
        lotId = lot.id;
      }
    }

    // Find serial if serial number is provided
    let serialId: number | undefined;
    if (purchaseReturn.serialNumber) {
      const serial = await this.inventoryCoreService.getSerialByNumber(
        purchaseReturn.serialNumber,
        purchaseReturn.itemId,
      );
      if (serial) {
        serialId = serial.id;
        // If serial has a lot, use that lot
        if (serial.lotId && !lotId) {
          lotId = serial.lotId;
        }
      }
    }

    // Create PURCHASE_RETURN transaction (OUT) - deducts from inventory
    // Requirements: 9.1
    await this.inventoryCoreService.createTransaction({
      transactionType: 'PURCHASE_RETURN',
      movementType: 'OUT',
      itemId: purchaseReturn.itemId,
      lotId,
      serialId,
      quantity: purchaseReturn.quantity,
      warehouseId: warehouse.id,
      referenceType: 'PURCHASE_RETURN',
      referenceId: purchaseReturn.id,
      referenceNo: purchaseReturn.returnNo,
      unitCost: Number(purchaseReturn.rate),
      distributorId: purchaseReturn.distributorId,
      remarks: purchaseReturn.reason || 'Purchase return',
      createdBy: purchaseReturn.distributorId, // Using distributorId as createdBy
    });

    // Update serial status to RETURNED if serial-tracked
    // Requirements: 9.3
    if (serialId) {
      await this.inventoryCoreService.updateSerialStatus(serialId, 'RETURNED', {
        currentOwnerType: 'COMPANY', // Returned to supplier/company
      });
    }
  }

  // Sales Returns - Auto-completed, immediately adds to inventory
  /**
   * Create sales return and process inventory using enterprise system
   * Creates SALES_RETURN transaction (IN) and updates serial status
   *
   * Requirements: 10.1, 10.2, 10.3
   */
  async createSalesReturn(
    createSalesReturnDto: CreateSalesReturnDto,
    distributorId: number,
  ) {
    const { customerId, reason, notes, items } = createSalesReturnDto;
    const returnNo = `SRET-${Date.now()}`;
    const returnDate = new Date().toISOString().split('T')[0];

    const salesReturns = [];
    for (const item of items) {
      const totalAmount = item.quantity * item.rate;

      // Create sales return with 'approved' status (no approval needed for sales returns)
      const salesReturn = this.salesReturnRepository.create({
        returnNo: returnNo,
        returnDate: returnDate,
        distributorId: distributorId,
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        totalAmount: totalAmount,
        reason: reason,
        status: 'approved', // Use 'approved' as final status for completed sales returns
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
        expiryDate: item.expiryDate || null,
        batchDetailId: item.batchDetailId || null,
        serialDetailId: item.serialDetailId || null,
        billNo: item.billNo || null,
        billId: item.billId || null,
      } as any);

      salesReturns.push(salesReturn);
    }

    // Save sales returns first to get IDs
    const savedReturns = await this.salesReturnRepository.save(salesReturns);

    // Process inventory for each saved return using enterprise system
    for (let i = 0; i < savedReturns.length; i++) {
      const savedReturn = savedReturns[i];
      const item = items[i];
      await this.processSalesReturnInventory(
        savedReturn,
        item.batchNumber,
        item.serialNumber,
        item.condition,
      );
    }

    return savedReturns;
  }

  /**
   * Process sales return inventory using enterprise system
   * Creates SALES_RETURN transaction (IN) and updates serial status if applicable
   *
   * Requirements: 10.1, 10.2, 10.3
   */
  private async processSalesReturnInventory(
    salesReturn: SalesReturnEntity,
    batchNumber?: string,
    serialNumber?: string,
    condition?: string,
  ): Promise<void> {
    // Get or create default warehouse for distributor
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        salesReturn.distributorId,
      );

    // Find lot if batch number is provided
    let lotId: number | undefined;
    if (batchNumber) {
      const lot = await this.inventoryCoreService.getLotByNumber(
        batchNumber,
        salesReturn.itemId,
      );
      if (lot) {
        lotId = lot.id;
      }
    }

    // Find serial if serial number is provided
    let serialId: number | undefined;
    if (serialNumber) {
      const serial = await this.inventoryCoreService.getSerialByNumber(
        serialNumber,
        salesReturn.itemId,
      );
      if (serial) {
        serialId = serial.id;
        // If serial has a lot, use that lot
        if (serial.lotId && !lotId) {
          lotId = serial.lotId;
        }
      }
    }

    // Create SALES_RETURN transaction (IN) - adds back to inventory
    // Requirements: 10.1
    await this.inventoryCoreService.createTransaction({
      transactionType: 'SALES_RETURN',
      movementType: 'IN',
      itemId: salesReturn.itemId,
      lotId,
      serialId,
      quantity: salesReturn.quantity,
      warehouseId: warehouse.id,
      referenceType: 'SALES_RETURN',
      referenceId: salesReturn.id,
      referenceNo: salesReturn.returnNo,
      unitCost: Number(salesReturn.rate),
      distributorId: salesReturn.distributorId,
      remarks: salesReturn.reason || 'Sales return',
      createdBy: salesReturn.distributorId, // Using distributorId as createdBy
    });

    // Update serial status based on condition
    // Requirements: 10.2
    if (serialId) {
      // Determine status based on condition: 'good' -> AVAILABLE, 'damaged' -> RETURNED
      const newStatus =
        condition === 'damaged' || condition === 'defective'
          ? 'RETURNED'
          : 'AVAILABLE';

      await this.inventoryCoreService.updateSerialStatus(serialId, newStatus, {
        currentOwnerType: 'DISTRIBUTOR',
        currentOwnerId: salesReturn.distributorId,
        customerId: null, // Clear customer since it's returned
        soldDate: null, // Clear sold date
        billingId: null, // Clear billing reference
      });
    }
  }

  async findAllSalesReturns(distributorId?: number, status?: string) {
    const query = this.salesReturnRepository
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.distributor', 'distributor')
      .leftJoinAndSelect('sr.item', 'item');

    if (distributorId) {
      query.where('sr.distributorId = :distributorId', { distributorId });
    }
    if (status) {
      query.andWhere('sr.status = :status', { status });
    }

    return await query.orderBy('sr.returnDate', 'DESC').getMany();
  }

  async updateSalesReturnStatus(
    id: number,
    status: 'pending' | 'approved' | 'rejected',
  ) {
    const salesReturn = await this.salesReturnRepository.findOne({
      where: { id },
      relations: ['distributor', 'item'],
    });

    if (!salesReturn) {
      throw new NotFoundException(`Sales return with ID ${id} not found`);
    }

    // Sales returns are auto-completed and cannot be changed
    throw new BadRequestException(
      'Sales returns are auto-completed and cannot be modified',
    );
  }

  async getPrefillDataFromBillingByBillNo(
    billNo: string,
    distributorId: number,
  ) {
    const billing = await this.billingRepository.findOne({
      where: { billNo, distributorId },
      relations: ['customer', 'distributor'],
    });

    if (!billing) {
      throw new NotFoundException(
        `Billing record ${billNo} not found for this distributor`,
      );
    }

    // Format the data for pre-filling the sales return form
    return {
      customerId: billing.customerId,
      customerName: billing.customer?.firstname || 'N/A',
      customerCity: billing.customer?.city || 'N/A',
      distributorId: billing.distributorId,
      distributorName: billing.distributor
        ? `${billing.distributor.firstName} ${billing.distributor.lastName || ''}`
        : 'N/A',
      billNo: billing.billNo,
      billDate: billing.billDate,
      items: (billing.billingItems || []).map((item: any) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        rate: item.rate,
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
        expiryDate: item.expiryDate || null,
        totalAmount: item.totalAmount,
      })),
      totalAmount: billing.finalAmount,
    };
  }
}
