import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryLotEntity } from './entities/inventory-lot.entity';
import { InventorySerialEntity } from './entities/inventory-serial.entity';
import {
  InventoryTransactionEntity,
  TransactionType,
  MovementType,
  ReferenceType,
} from './entities/inventory-transaction.entity';
import { WarehouseEntity } from './entities/warehouse.entity';
import { ItemEntity } from '../items/entities/item.entity';

// ═══════════════════════════════════════════════════════════════
// VIEW INTERFACES (Backward Compatibility with Legacy System)
// ═══════════════════════════════════════════════════════════════

/**
 * Legacy-compatible inventory view format
 * Matches the structure returned by the legacy InventoryService.findAllByDistributor
 */
export interface InventoryView {
  id: number; // Generated from itemId + distributorId combination
  distributorId: number;
  itemId: number;
  quantity: number; // Calculated from transactions
  reorderLevel: number; // From item config or default
  status: 'in_stock' | 'low_stock' | 'out_of_stock'; // Calculated
  notes?: string;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  item: {
    id: number;
    name: string;
    unit?: string;
    rate?: number;
    hsn?: string;
    gstRate?: number;
    hasBatchTracking?: boolean;
    hasSerialTracking?: boolean;
    hasExpiryDate?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Legacy-compatible batch details view format
 * Matches the structure returned by the legacy InventoryService.getBatchDetails
 */
export interface BatchDetailsView {
  id: number;
  inventoryId: number;
  batchNumber: string;
  quantity: number; // Calculated from transactions
  expiryDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Legacy-compatible serial details view format
 * Matches the structure returned by the legacy InventoryService.getSerialDetails
 */
export interface SerialDetailsView {
  id: number;
  inventoryId: number;
  serialNumber: string;
  quantity: number;
  expiryDate?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'RETURNED' | 'DAMAGED';
  batchDetailId?: number;
  batchNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// DTOs
export interface CreateTransactionDto {
  transactionType: TransactionType;
  movementType: MovementType;
  itemId: number;
  lotId?: number;
  serialId?: number;
  quantity: number;
  unit?: string;
  warehouseId: number;
  fromWarehouseId?: number;
  toWarehouseId?: number;
  referenceType?: ReferenceType;
  referenceId?: number;
  referenceNo?: string;
  referenceLineId?: number;
  unitCost?: number;
  distributorId?: number;
  remarks?: string;
  createdBy: number;
  ipAddress?: string;
}

export interface CreateLotDto {
  lotNumber: string;
  itemId: number;
  manufactureDate?: string;
  expiryDate?: string;
  receivedDate?: string;
  supplierId?: number;
  supplierBatchNo?: string;
  purchaseOrderId?: number;
  grnId?: number;
  unitCost?: number;
  landedCost?: number;
  distributorId?: number;
  warehouseId?: number;
  createdBy?: number;
  attributes?: Record<string, any>;
}

export interface CreateSerialDto {
  serialNumber: string;
  itemId: number;
  lotId?: number;
  currentWarehouseId?: number;
  currentOwnerType?: 'COMPANY' | 'DISTRIBUTOR' | 'CUSTOMER';
  currentOwnerId?: number;
  purchaseOrderId?: number;
  grnId?: number;
  receivedDate?: string;
  unitCost?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyTerms?: string;
  distributorId?: number;
  createdBy?: number;
  attributes?: Record<string, any>;
}

export interface StockBalanceParams {
  itemId?: number;
  warehouseId?: number;
  distributorId?: number;
  lotId?: number;
}

export interface StockBalance {
  itemId: number;
  itemName: string;
  warehouseId: number;
  warehouseName: string;
  lotId?: number;
  lotNumber?: string;
  expiryDate?: string;
  onHand: number;
  reserved: number;
  available: number;
  avgCost?: number;
}

export interface StockAllocation {
  lotId: number;
  lotNumber: string;
  quantity: number;
  expiryDate?: string;
  unitCost?: number;
}

@Injectable()
export class InventoryCoreService {
  constructor(
    @InjectRepository(InventoryLotEntity)
    private lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(InventorySerialEntity)
    private serialRepo: Repository<InventorySerialEntity>,
    @InjectRepository(InventoryTransactionEntity)
    private transactionRepo: Repository<InventoryTransactionEntity>,
    @InjectRepository(WarehouseEntity)
    private warehouseRepo: Repository<WarehouseEntity>,
    @InjectRepository(ItemEntity)
    private itemRepo: Repository<ItemEntity>,
    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTION METHODS (Single Source of Truth)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate unique transaction number
   */
  private generateTransactionNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * Create inventory transaction - ALL stock movements go through this
   */
  async createTransaction(
    dto: CreateTransactionDto,
  ): Promise<InventoryTransactionEntity> {
    // Validate stock availability for OUT movements
    if (dto.movementType === 'OUT' || dto.movementType === 'RESERVE') {
      const available = await this.getAvailableQuantity(
        dto.itemId,
        dto.warehouseId,
        dto.distributorId,
        dto.lotId,
      );

      if (available < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${available}, Required: ${dto.quantity}`,
        );
      }
    }

    // Create transaction record
    const transaction = this.transactionRepo.create({
      transactionNo: this.generateTransactionNo(),
      transactionDate: new Date(),
      transactionType: dto.transactionType,
      movementType: dto.movementType,
      itemId: dto.itemId,
      lotId: dto.lotId,
      serialId: dto.serialId,
      quantity: dto.quantity,
      unit: dto.unit,
      warehouseId: dto.warehouseId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      referenceNo: dto.referenceNo,
      referenceLineId: dto.referenceLineId,
      unitCost: dto.unitCost,
      totalCost: dto.unitCost ? dto.unitCost * dto.quantity : null,
      distributorId: dto.distributorId,
      remarks: dto.remarks,
      createdBy: dto.createdBy,
      ipAddress: dto.ipAddress,
      status: 'COMPLETED',
    });

    const saved = await this.transactionRepo.save(transaction);

    // Update running balance
    await this.updateRunningBalance(saved);

    return saved;
  }

  /**
   * Update running balance after transaction
   */
  private async updateRunningBalance(
    transaction: InventoryTransactionEntity,
  ): Promise<void> {
    const balance = await this.getAvailableQuantity(
      transaction.itemId,
      transaction.warehouseId,
      transaction.distributorId,
      transaction.lotId,
    );

    await this.transactionRepo.update(transaction.id, {
      runningBalance: balance,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // STOCK QUERY METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get available quantity (calculated from transactions)
   */
  async getAvailableQuantity(
    itemId: number,
    warehouseId: number,
    distributorId?: number,
    lotId?: number,
  ): Promise<number> {
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .select(
        `SUM(CASE 
          WHEN t.movementType = 'IN' THEN t.quantity
          WHEN t.movementType = 'OUT' THEN -t.quantity
          WHEN t.movementType = 'RESERVE' THEN -t.quantity
          WHEN t.movementType = 'RELEASE' THEN t.quantity
          ELSE 0 
        END)`,
        'available',
      )
      .where('t.itemId = :itemId', { itemId })
      .andWhere('t.warehouseId = :warehouseId', { warehouseId })
      .andWhere('t.status = :status', { status: 'COMPLETED' });

    if (distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId,
      });
    }

    if (lotId) {
      query = query.andWhere('t.lotId = :lotId', { lotId });
    }

    const result = await query.getRawOne();
    return Number(result?.available) || 0;
  }

  /**
   * Get stock balance with details
   */
  async getStockBalance(params: StockBalanceParams): Promise<StockBalance[]> {
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.item', 'item')
      .leftJoin('t.warehouse', 'warehouse')
      .leftJoin('t.lot', 'lot')
      .select('t.itemId', 'itemId')
      .addSelect('item.name', 'itemName')
      .addSelect('t.warehouseId', 'warehouseId')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('t.lotId', 'lotId')
      .addSelect('lot.lotNumber', 'lotNumber')
      .addSelect('lot.expiryDate', 'expiryDate')
      .addSelect(
        `SUM(CASE WHEN t.movementType IN ('IN') THEN t.quantity ELSE 0 END) - 
         SUM(CASE WHEN t.movementType IN ('OUT') THEN t.quantity ELSE 0 END)`,
        'onHand',
      )
      .addSelect(
        `SUM(CASE WHEN t.movementType = 'RESERVE' THEN t.quantity ELSE 0 END) - 
         SUM(CASE WHEN t.movementType = 'RELEASE' THEN t.quantity ELSE 0 END)`,
        'reserved',
      )
      .addSelect(
        `AVG(CASE WHEN t.movementType = 'IN' THEN t.unitCost END)`,
        'avgCost',
      )
      .where('t.status = :status', { status: 'COMPLETED' })
      .groupBy('t.itemId')
      .addGroupBy('t.warehouseId')
      .addGroupBy('t.lotId');

    if (params.itemId) {
      query = query.andWhere('t.itemId = :itemId', { itemId: params.itemId });
    }
    if (params.warehouseId) {
      query = query.andWhere('t.warehouseId = :warehouseId', {
        warehouseId: params.warehouseId,
      });
    }
    if (params.distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId: params.distributorId,
      });
    }
    if (params.lotId) {
      query = query.andWhere('t.lotId = :lotId', { lotId: params.lotId });
    }

    const results = await query.getRawMany();

    return results.map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      lotId: r.lotId,
      lotNumber: r.lotNumber,
      expiryDate: r.expiryDate,
      onHand: Number(r.onHand) || 0,
      reserved: Number(r.reserved) || 0,
      available: (Number(r.onHand) || 0) - (Number(r.reserved) || 0),
      avgCost: r.avgCost ? Number(r.avgCost) : undefined,
    }));
  }

  /**
   * Get available lots for FIFO/FEFO picking
   */
  async getAvailableLots(
    itemId: number,
    warehouseId: number,
    distributorId?: number,
    strategy: 'FIFO' | 'FEFO' = 'FEFO',
  ): Promise<
    Array<{
      lotId: number;
      lotNumber: string;
      expiryDate: string;
      unitCost: number;
      availableQuantity: number;
    }>
  > {
    const orderBy =
      strategy === 'FEFO' ? 'lot.expiryDate ASC' : 'lot.receivedDate ASC';

    // Get all lots with their available quantities
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.lot', 'lot')
      .select('t.lotId', 'lotId')
      .addSelect('lot.lotNumber', 'lotNumber')
      .addSelect('lot.expiryDate', 'expiryDate')
      .addSelect('lot.unitCost', 'unitCost')
      .addSelect('lot.receivedDate', 'receivedDate')
      .addSelect(
        `SUM(CASE 
          WHEN t.movementType = 'IN' THEN t.quantity
          WHEN t.movementType = 'OUT' THEN -t.quantity
          WHEN t.movementType = 'RESERVE' THEN -t.quantity
          WHEN t.movementType = 'RELEASE' THEN t.quantity
          ELSE 0 
        END)`,
        'availableQuantity',
      )
      .where('t.itemId = :itemId', { itemId })
      .andWhere('t.warehouseId = :warehouseId', { warehouseId })
      .andWhere('t.lotId IS NOT NULL')
      .andWhere('t.status = :status', { status: 'COMPLETED' })
      .andWhere('lot.status = :lotStatus', { lotStatus: 'ACTIVE' })
      .groupBy('t.lotId')
      .having('availableQuantity > 0');

    if (distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId,
      });
    }

    // Filter out expired lots
    query = query.andWhere(
      '(lot.expiryDate IS NULL OR lot.expiryDate > CURDATE())',
    );

    // Order by strategy
    if (strategy === 'FEFO') {
      query = query.orderBy('lot.expiryDate', 'ASC', 'NULLS LAST');
    } else {
      query = query.orderBy('lot.receivedDate', 'ASC', 'NULLS LAST');
    }

    const results = await query.getRawMany();

    return results.map((r) => ({
      lotId: r.lotId,
      lotNumber: r.lotNumber,
      expiryDate: r.expiryDate,
      unitCost: Number(r.unitCost) || 0,
      availableQuantity: Number(r.availableQuantity) || 0,
    }));
  }

  /**
   * Auto-allocate stock using FIFO/FEFO
   */
  async allocateStock(
    itemId: number,
    warehouseId: number,
    requiredQty: number,
    distributorId?: number,
    strategy: 'FIFO' | 'FEFO' = 'FEFO',
  ): Promise<StockAllocation[]> {
    const availableLots = await this.getAvailableLots(
      itemId,
      warehouseId,
      distributorId,
      strategy,
    );

    const allocations: StockAllocation[] = [];
    let remainingQty = requiredQty;

    for (const lot of availableLots) {
      if (remainingQty <= 0) break;

      const allocateQty = Math.min(remainingQty, lot.availableQuantity);
      allocations.push({
        lotId: lot.lotId,
        lotNumber: lot.lotNumber,
        quantity: allocateQty,
        expiryDate: lot.expiryDate,
        unitCost: lot.unitCost,
      });

      remainingQty -= allocateQty;
    }

    if (remainingQty > 0) {
      throw new BadRequestException(
        `Insufficient stock. Required: ${requiredQty}, Available: ${requiredQty - remainingQty}`,
      );
    }

    return allocations;
  }

  // ═══════════════════════════════════════════════════════════════
  // LOT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new lot
   */
  async createLot(dto: CreateLotDto): Promise<InventoryLotEntity> {
    // Check for duplicate lot number for same item
    const existing = await this.lotRepo.findOne({
      where: { lotNumber: dto.lotNumber, itemId: dto.itemId },
    });

    if (existing) {
      // Return existing lot instead of creating duplicate
      return existing;
    }

    const lot = this.lotRepo.create({
      lotNumber: dto.lotNumber,
      itemId: dto.itemId,
      manufactureDate: dto.manufactureDate,
      expiryDate: dto.expiryDate,
      receivedDate: dto.receivedDate || new Date().toISOString().split('T')[0],
      supplierId: dto.supplierId,
      supplierBatchNo: dto.supplierBatchNo,
      purchaseOrderId: dto.purchaseOrderId,
      grnId: dto.grnId,
      unitCost: dto.unitCost,
      landedCost: dto.landedCost,
      distributorId: dto.distributorId,
      warehouseId: dto.warehouseId,
      createdBy: dto.createdBy,
      attributes: dto.attributes,
      status: 'ACTIVE',
      qualityStatus: 'APPROVED',
    });

    return this.lotRepo.save(lot);
  }

  /**
   * Get lot by ID
   */
  async getLotById(lotId: number): Promise<InventoryLotEntity> {
    const lot = await this.lotRepo.findOne({
      where: { id: lotId },
      relations: ['item'],
    });

    if (!lot) {
      throw new NotFoundException(`Lot with ID ${lotId} not found`);
    }

    return lot;
  }

  /**
   * Get lot by number and item
   */
  async getLotByNumber(
    lotNumber: string,
    itemId: number,
  ): Promise<InventoryLotEntity | null> {
    return this.lotRepo.findOne({
      where: { lotNumber, itemId },
      relations: ['item'],
    });
  }

  /**
   * Get all lots for an item
   */
  async getLotsByItem(
    itemId: number,
    distributorId?: number,
  ): Promise<InventoryLotEntity[]> {
    let query = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .where('lot.itemId = :itemId', { itemId })
      .andWhere('lot.status = :status', { status: 'ACTIVE' });

    if (distributorId) {
      query = query.andWhere('lot.distributorId = :distributorId', {
        distributorId,
      });
    }

    return query.orderBy('lot.expiryDate', 'ASC').getMany();
  }

  /**
   * Update lot status
   */
  async updateLotStatus(
    lotId: number,
    status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'CONSUMED',
    reason?: string,
    userId?: number,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'BLOCKED') {
      updateData.blockedReason = reason;
      updateData.blockedBy = userId;
      updateData.blockedAt = new Date();
    }

    await this.lotRepo.update(lotId, updateData);
  }

  // ═══════════════════════════════════════════════════════════════
  // SERIAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new serial
   */
  async createSerial(dto: CreateSerialDto): Promise<InventorySerialEntity> {
    // Check for duplicate serial number for same item
    const existing = await this.serialRepo.findOne({
      where: { serialNumber: dto.serialNumber, itemId: dto.itemId },
    });

    if (existing) {
      throw new BadRequestException(
        `Serial ${dto.serialNumber} already exists for this item`,
      );
    }

    const serial = this.serialRepo.create({
      serialNumber: dto.serialNumber,
      itemId: dto.itemId,
      lotId: dto.lotId,
      currentWarehouseId: dto.currentWarehouseId,
      currentOwnerType: dto.currentOwnerType || 'DISTRIBUTOR',
      currentOwnerId: dto.currentOwnerId,
      purchaseOrderId: dto.purchaseOrderId,
      grnId: dto.grnId,
      receivedDate: dto.receivedDate || new Date().toISOString().split('T')[0],
      unitCost: dto.unitCost,
      warrantyStartDate: dto.warrantyStartDate,
      warrantyEndDate: dto.warrantyEndDate,
      warrantyTerms: dto.warrantyTerms,
      distributorId: dto.distributorId,
      createdBy: dto.createdBy,
      attributes: dto.attributes,
      status: 'AVAILABLE',
      qualityStatus: 'APPROVED',
    });

    return this.serialRepo.save(serial);
  }

  /**
   * Get serial by number
   */
  async getSerialByNumber(
    serialNumber: string,
    itemId?: number,
  ): Promise<InventorySerialEntity | null> {
    const where: any = { serialNumber };
    if (itemId) {
      where.itemId = itemId;
    }

    return this.serialRepo.findOne({
      where,
      relations: ['item', 'lot', 'currentWarehouse', 'customer'],
    });
  }

  /**
   * Get available serials for an item
   */
  async getAvailableSerials(
    itemId: number,
    warehouseId?: number,
    distributorId?: number,
  ): Promise<InventorySerialEntity[]> {
    let query = this.serialRepo
      .createQueryBuilder('serial')
      .leftJoinAndSelect('serial.item', 'item')
      .leftJoinAndSelect('serial.lot', 'lot')
      .where('serial.itemId = :itemId', { itemId })
      .andWhere('serial.status = :status', { status: 'AVAILABLE' });

    if (warehouseId) {
      query = query.andWhere('serial.currentWarehouseId = :warehouseId', {
        warehouseId,
      });
    }

    if (distributorId) {
      query = query.andWhere('serial.distributorId = :distributorId', {
        distributorId,
      });
    }

    return query.orderBy('serial.receivedDate', 'ASC').getMany();
  }

  /**
   * Update serial status
   */
  async updateSerialStatus(
    serialId: number,
    status:
      | 'AVAILABLE'
      | 'RESERVED'
      | 'SOLD'
      | 'RETURNED'
      | 'DAMAGED'
      | 'SCRAPPED',
    additionalData?: Partial<InventorySerialEntity>,
  ): Promise<void> {
    await this.serialRepo.update(serialId, {
      status,
      ...additionalData,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // WAREHOUSE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get or create default warehouse for distributor
   */
  async getOrCreateDefaultWarehouse(
    distributorId: number,
    distributorName?: string,
  ): Promise<WarehouseEntity> {
    // Check if warehouse exists
    let warehouse = await this.warehouseRepo.findOne({
      where: { distributorId, type: 'MAIN' },
    });

    if (!warehouse) {
      // Create default warehouse
      warehouse = this.warehouseRepo.create({
        code: `WH-${distributorId}`,
        name: distributorName
          ? `${distributorName} - Main Warehouse`
          : `Distributor ${distributorId} - Main Warehouse`,
        type: 'MAIN',
        distributorId,
        isActive: true,
      });
      warehouse = await this.warehouseRepo.save(warehouse);
    }

    return warehouse;
  }

  /**
   * Get all warehouses for distributor
   */
  async getWarehousesByDistributor(
    distributorId: number,
  ): Promise<WarehouseEntity[]> {
    return this.warehouseRepo.find({
      where: { distributorId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get transaction history
   */
  async getTransactionHistory(params: {
    itemId?: number;
    lotId?: number;
    serialId?: number;
    warehouseId?: number;
    distributorId?: number;
    referenceType?: ReferenceType;
    referenceId?: number;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<InventoryTransactionEntity[]> {
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.item', 'item')
      .leftJoinAndSelect('t.lot', 'lot')
      .leftJoinAndSelect('t.serial', 'serial')
      .leftJoinAndSelect('t.warehouse', 'warehouse')
      .leftJoinAndSelect('t.createdByUser', 'createdBy')
      .where('t.status = :status', { status: 'COMPLETED' });

    if (params.itemId) {
      query = query.andWhere('t.itemId = :itemId', { itemId: params.itemId });
    }
    if (params.lotId) {
      query = query.andWhere('t.lotId = :lotId', { lotId: params.lotId });
    }
    if (params.serialId) {
      query = query.andWhere('t.serialId = :serialId', {
        serialId: params.serialId,
      });
    }
    if (params.warehouseId) {
      query = query.andWhere('t.warehouseId = :warehouseId', {
        warehouseId: params.warehouseId,
      });
    }
    if (params.distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId: params.distributorId,
      });
    }
    if (params.referenceType) {
      query = query.andWhere('t.referenceType = :referenceType', {
        referenceType: params.referenceType,
      });
    }
    if (params.referenceId) {
      query = query.andWhere('t.referenceId = :referenceId', {
        referenceId: params.referenceId,
      });
    }
    if (params.fromDate) {
      query = query.andWhere('t.transactionDate >= :fromDate', {
        fromDate: params.fromDate,
      });
    }
    if (params.toDate) {
      query = query.andWhere('t.transactionDate <= :toDate', {
        toDate: params.toDate,
      });
    }

    query = query.orderBy('t.transactionDate', 'DESC');

    if (params.limit) {
      query = query.limit(params.limit);
    }

    return query.getMany();
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPIRY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get expiring lots
   */
  async getExpiringLots(
    daysThreshold: number = 30,
    distributorId?: number,
  ): Promise<
    Array<{
      lot: InventoryLotEntity;
      availableQuantity: number;
      daysToExpiry: number;
    }>
  > {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    let query = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .where('lot.status = :status', { status: 'ACTIVE' })
      .andWhere('lot.expiryDate IS NOT NULL')
      .andWhere('lot.expiryDate <= :thresholdDate', {
        thresholdDate: thresholdDate.toISOString().split('T')[0],
      });

    if (distributorId) {
      query = query.andWhere('lot.distributorId = :distributorId', {
        distributorId,
      });
    }

    const lots = await query.orderBy('lot.expiryDate', 'ASC').getMany();

    const results = [];
    for (const lot of lots) {
      const availableQuantity = await this.getAvailableQuantity(
        lot.itemId,
        lot.warehouseId,
        lot.distributorId,
        lot.id,
      );

      if (availableQuantity > 0) {
        const expiryDate = new Date(lot.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        const daysToExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        results.push({
          lot,
          availableQuantity,
          daysToExpiry,
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKWARD COMPATIBILITY METHODS (Legacy API Support)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Default reorder level when not specified
   */
  private readonly DEFAULT_REORDER_LEVEL = 10;

  /**
   * Calculate stock status based on quantity and reorder level
   */
  private calculateStatus(
    quantity: number,
    reorderLevel: number,
  ): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (quantity === 0) return 'out_of_stock';
    if (quantity <= reorderLevel) return 'low_stock';
    return 'in_stock';
  }

  /**
   * Get inventory view in legacy format
   * Calculates quantity from transactions and returns data matching legacy InventoryService format
   *
   * @param distributorId - The distributor ID to filter by
   * @param search - Optional search string to filter by item name
   * @returns Array of InventoryView objects matching legacy format
   *
   * **Feature: inventory-consolidation, Property 8: API Backward Compatibility**
   * **Validates: Requirements 8.1**
   */
  async getInventoryView(
    distributorId: number,
    search?: string,
  ): Promise<InventoryView[]> {
    // Get all items that have transactions for this distributor
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.item', 'item')
      .select('t.itemId', 'itemId')
      .addSelect('item.id', 'item_id')
      .addSelect('item.name', 'item_name')
      .addSelect('item.unit', 'item_unit')
      .addSelect('item.rate', 'item_rate')
      .addSelect('item.hsn', 'item_hsn')
      .addSelect('item.gstRate', 'item_gstRate')
      .addSelect('item.hasBatchTracking', 'item_hasBatchTracking')
      .addSelect('item.hasSerialTracking', 'item_hasSerialTracking')
      .addSelect('item.hasExpiryDate', 'item_hasExpiryDate')
      .addSelect('MIN(t.createdAt)', 'createdAt')
      .addSelect('MAX(t.updatedAt)', 'updatedAt')
      .addSelect(
        `SUM(CASE 
          WHEN t.movementType = 'IN' THEN t.quantity
          WHEN t.movementType = 'OUT' THEN -t.quantity
          WHEN t.movementType = 'RESERVE' THEN -t.quantity
          WHEN t.movementType = 'RELEASE' THEN t.quantity
          ELSE 0 
        END)`,
        'quantity',
      )
      .where('t.distributorId = :distributorId', { distributorId })
      .andWhere('t.status = :status', { status: 'COMPLETED' })
      .groupBy('t.itemId');

    if (search) {
      query = query.andWhere('item.name LIKE :search', {
        search: `%${search}%`,
      });
    }

    const results = await query
      .orderBy('MAX(t.createdAt)', 'DESC')
      .getRawMany();

    // Transform to InventoryView format
    return results.map((r, index) => {
      const quantity = Number(r.quantity) || 0;
      const reorderLevel = this.DEFAULT_REORDER_LEVEL;

      return {
        // Generate a unique ID based on itemId and distributorId
        // Using a formula that creates a unique composite ID
        id: distributorId * 1000000 + r.itemId,
        distributorId,
        itemId: r.itemId,
        quantity,
        reorderLevel,
        status: this.calculateStatus(quantity, reorderLevel),
        item: {
          id: r.item_id,
          name: r.item_name,
          unit: r.item_unit,
          rate: r.item_rate ? Number(r.item_rate) : undefined,
          hsn: r.item_hsn,
          gstRate: r.item_gstRate ? Number(r.item_gstRate) : undefined,
          hasBatchTracking: r.item_hasBatchTracking,
          hasSerialTracking: r.item_hasSerialTracking,
          hasExpiryDate: r.item_hasExpiryDate,
        },
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
      };
    });
  }

  /**
   * Get batch details view in legacy format
   * Queries inventory_lot and calculates available quantity per lot from transactions
   *
   * @param itemId - The item ID to get batch details for
   * @param distributorId - The distributor ID to filter by
   * @returns Array of BatchDetailsView objects matching legacy format
   *
   * **Feature: inventory-consolidation, Property 8: API Backward Compatibility**
   * **Validates: Requirements 8.2**
   */
  async getBatchDetailsView(
    itemId: number,
    distributorId: number,
  ): Promise<BatchDetailsView[]> {
    // Get all lots for this item and distributor
    const lots = await this.lotRepo.find({
      where: {
        itemId,
        distributorId,
        status: 'ACTIVE',
      },
      order: { createdAt: 'DESC' },
    });

    // Calculate available quantity for each lot from transactions
    const results: BatchDetailsView[] = [];

    for (const lot of lots) {
      // Get quantity from transactions for this lot
      const quantityResult = await this.transactionRepo
        .createQueryBuilder('t')
        .select(
          `SUM(CASE 
            WHEN t.movementType = 'IN' THEN t.quantity
            WHEN t.movementType = 'OUT' THEN -t.quantity
            WHEN t.movementType = 'RESERVE' THEN -t.quantity
            WHEN t.movementType = 'RELEASE' THEN t.quantity
            ELSE 0 
          END)`,
          'quantity',
        )
        .where('t.lotId = :lotId', { lotId: lot.id })
        .andWhere('t.distributorId = :distributorId', { distributorId })
        .andWhere('t.status = :status', { status: 'COMPLETED' })
        .getRawOne();

      const quantity = Number(quantityResult?.quantity) || 0;

      // Generate inventoryId matching the pattern used in getInventoryView
      const inventoryId = distributorId * 1000000 + itemId;

      results.push({
        id: lot.id,
        inventoryId,
        batchNumber: lot.lotNumber,
        quantity,
        expiryDate: lot.expiryDate,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
      });
    }

    return results;
  }

  /**
   * Get serial details view in legacy format
   * Queries inventory_serial and returns data matching legacy serial_details format
   *
   * @param itemId - The item ID to get serial details for
   * @param distributorId - The distributor ID to filter by
   * @returns Array of SerialDetailsView objects matching legacy format
   *
   * **Feature: inventory-consolidation, Property 8: API Backward Compatibility**
   * **Validates: Requirements 8.3**
   */
  async getSerialDetailsView(
    itemId: number,
    distributorId: number,
  ): Promise<SerialDetailsView[]> {
    // Get all serials for this item and distributor
    const serials = await this.serialRepo.find({
      where: {
        itemId,
        distributorId,
      },
      relations: ['lot'],
      order: { createdAt: 'DESC' },
    });

    // Generate inventoryId matching the pattern used in getInventoryView
    const inventoryId = distributorId * 1000000 + itemId;

    // Transform to SerialDetailsView format
    return serials.map((serial) => ({
      id: serial.id,
      inventoryId,
      serialNumber: serial.serialNumber,
      quantity: 1, // Serials always have quantity of 1
      expiryDate: serial.lot?.expiryDate,
      status: serial.status as
        | 'AVAILABLE'
        | 'RESERVED'
        | 'SOLD'
        | 'RETURNED'
        | 'DAMAGED',
      batchDetailId: serial.lotId,
      batchNumber: serial.lot?.lotNumber,
      createdAt: serial.createdAt,
      updatedAt: serial.updatedAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN CUMULATIVE REPORTS
  // Requirements 14.1, 14.2, 14.3, 14.4, 14.5
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get cumulative stock balance report (all distributors)
   * Requirements 14.1: Aggregate stock balances across all distributors
   *
   * **Feature: inventory-consolidation, Property 9: Admin Cumulative vs Individual Reports**
   * **Validates: Requirements 14.1, 14.2**
   */
  async getAdminCumulativeStockBalance(params?: {
    itemId?: number;
    warehouseId?: number;
    distributorId?: number;
  }): Promise<
    Array<{
      itemId: number;
      itemName: string;
      distributorId: number;
      distributorName: string;
      warehouseId: number;
      warehouseName: string;
      onHand: number;
      reserved: number;
      available: number;
    }>
  > {
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.item', 'item')
      .leftJoin('t.warehouse', 'warehouse')
      .leftJoin('t.distributor', 'distributor')
      .select('t.itemId', 'itemId')
      .addSelect('item.name', 'itemName')
      .addSelect('t.distributorId', 'distributorId')
      .addSelect(
        "CONCAT(distributor.firstName, ' ', COALESCE(distributor.lastName, ''))",
        'distributorName',
      )
      .addSelect('t.warehouseId', 'warehouseId')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect(
        `SUM(CASE WHEN t.movementType IN ('IN') THEN t.quantity ELSE 0 END) - 
         SUM(CASE WHEN t.movementType IN ('OUT') THEN t.quantity ELSE 0 END)`,
        'onHand',
      )
      .addSelect(
        `SUM(CASE WHEN t.movementType = 'RESERVE' THEN t.quantity ELSE 0 END) - 
         SUM(CASE WHEN t.movementType = 'RELEASE' THEN t.quantity ELSE 0 END)`,
        'reserved',
      )
      .where('t.status = :status', { status: 'COMPLETED' })
      .groupBy('t.itemId')
      .addGroupBy('t.distributorId')
      .addGroupBy('t.warehouseId');

    if (params?.itemId) {
      query = query.andWhere('t.itemId = :itemId', { itemId: params.itemId });
    }
    if (params?.warehouseId) {
      query = query.andWhere('t.warehouseId = :warehouseId', {
        warehouseId: params.warehouseId,
      });
    }
    if (params?.distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId: params.distributorId,
      });
    }

    const results = await query.getRawMany();

    return results.map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      distributorId: r.distributorId,
      distributorName: r.distributorName?.trim() || 'Unknown',
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName || 'Unknown',
      onHand: Number(r.onHand) || 0,
      reserved: Number(r.reserved) || 0,
      available: (Number(r.onHand) || 0) - (Number(r.reserved) || 0),
    }));
  }

  /**
   * Get cumulative transaction report (all distributors)
   * Requirements 14.3: Show all inventory transactions with distributor name
   *
   * **Feature: inventory-consolidation, Property 9: Admin Cumulative vs Individual Reports**
   * **Validates: Requirements 14.3**
   */
  async getAdminCumulativeTransactions(params?: {
    itemId?: number;
    warehouseId?: number;
    distributorId?: number;
    transactionType?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<InventoryTransactionEntity[]> {
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.item', 'item')
      .leftJoinAndSelect('t.lot', 'lot')
      .leftJoinAndSelect('t.serial', 'serial')
      .leftJoinAndSelect('t.warehouse', 'warehouse')
      .leftJoinAndSelect('t.distributor', 'distributor')
      .leftJoinAndSelect('t.createdByUser', 'createdBy')
      .where('t.status = :status', { status: 'COMPLETED' });

    if (params?.itemId) {
      query = query.andWhere('t.itemId = :itemId', { itemId: params.itemId });
    }
    if (params?.warehouseId) {
      query = query.andWhere('t.warehouseId = :warehouseId', {
        warehouseId: params.warehouseId,
      });
    }
    if (params?.distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId: params.distributorId,
      });
    }
    if (params?.transactionType) {
      query = query.andWhere('t.transactionType = :transactionType', {
        transactionType: params.transactionType,
      });
    }
    if (params?.fromDate) {
      query = query.andWhere('t.transactionDate >= :fromDate', {
        fromDate: params.fromDate,
      });
    }
    if (params?.toDate) {
      query = query.andWhere('t.transactionDate <= :toDate', {
        toDate: params.toDate,
      });
    }

    query = query.orderBy('t.transactionDate', 'DESC');

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    return query.getMany();
  }

  /**
   * Get cumulative expiring lots report (all distributors)
   * Requirements 14.4: Show expiring lots with distributor name
   *
   * **Feature: inventory-consolidation, Property 9: Admin Cumulative vs Individual Reports**
   * **Validates: Requirements 14.4**
   */
  async getAdminCumulativeExpiringLots(
    daysThreshold: number = 30,
    distributorId?: number,
  ): Promise<
    Array<{
      lot: InventoryLotEntity;
      availableQuantity: number;
      daysToExpiry: number;
      distributorName: string;
    }>
  > {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    let query = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .leftJoinAndSelect('lot.distributor', 'distributor')
      .where('lot.status = :status', { status: 'ACTIVE' })
      .andWhere('lot.expiryDate IS NOT NULL')
      .andWhere('lot.expiryDate <= :thresholdDate', {
        thresholdDate: thresholdDate.toISOString().split('T')[0],
      });

    if (distributorId) {
      query = query.andWhere('lot.distributorId = :distributorId', {
        distributorId,
      });
    }

    const lots = await query.orderBy('lot.expiryDate', 'ASC').getMany();

    const results = [];
    for (const lot of lots) {
      const availableQuantity = await this.getAvailableQuantity(
        lot.itemId,
        lot.warehouseId,
        lot.distributorId,
        lot.id,
      );

      if (availableQuantity > 0) {
        const expiryDate = new Date(lot.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        const daysToExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const distributorName = (lot as any).distributor
          ? `${(lot as any).distributor.firstName || ''} ${(lot as any).distributor.lastName || ''}`.trim()
          : 'Unknown';

        results.push({
          lot,
          availableQuantity,
          daysToExpiry,
          distributorName,
        });
      }
    }

    return results;
  }

  /**
   * Get cumulative low stock report (all distributors)
   * Requirements 14.5: Show low stock items with distributor name
   *
   * **Feature: inventory-consolidation, Property 9: Admin Cumulative vs Individual Reports**
   * **Validates: Requirements 14.5**
   */
  async getAdminCumulativeLowStock(
    distributorId?: number,
    reorderLevel: number = 10,
  ): Promise<
    Array<{
      itemId: number;
      itemName: string;
      distributorId: number;
      distributorName: string;
      availableQuantity: number;
      reorderLevel: number;
      status: 'low_stock' | 'out_of_stock';
    }>
  > {
    // Get all items with their stock levels grouped by distributor
    let query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.item', 'item')
      .leftJoin('t.distributor', 'distributor')
      .select('t.itemId', 'itemId')
      .addSelect('item.name', 'itemName')
      .addSelect('t.distributorId', 'distributorId')
      .addSelect(
        "CONCAT(distributor.firstName, ' ', COALESCE(distributor.lastName, ''))",
        'distributorName',
      )
      .addSelect(
        `SUM(CASE 
          WHEN t.movementType = 'IN' THEN t.quantity
          WHEN t.movementType = 'OUT' THEN -t.quantity
          WHEN t.movementType = 'RESERVE' THEN -t.quantity
          WHEN t.movementType = 'RELEASE' THEN t.quantity
          ELSE 0 
        END)`,
        'availableQuantity',
      )
      .where('t.status = :status', { status: 'COMPLETED' })
      .groupBy('t.itemId')
      .addGroupBy('t.distributorId')
      .having('availableQuantity <= :reorderLevel', { reorderLevel });

    if (distributorId) {
      query = query.andWhere('t.distributorId = :distributorId', {
        distributorId,
      });
    }

    const results = await query.getRawMany();

    return results.map((r) => {
      const qty = Number(r.availableQuantity) || 0;
      return {
        itemId: r.itemId,
        itemName: r.itemName,
        distributorId: r.distributorId,
        distributorName: r.distributorName?.trim() || 'Unknown',
        availableQuantity: qty,
        reorderLevel,
        status: qty === 0 ? ('out_of_stock' as const) : ('low_stock' as const),
      };
    });
  }
}
