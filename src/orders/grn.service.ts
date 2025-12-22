import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrnEntity } from './entities/grn.entity';
import { GrnItemEntity } from './entities/grn-item.entity';
import { GrnBatchDetailEntity } from './entities/grn-batch-detail.entity';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from './entities/purchase-order-item.entity';
import { CreateGrnDto } from './dto/create-grn.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { InventoryCoreService } from 'src/inventory/inventory-core.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class GrnService {
  constructor(
    @InjectRepository(GrnEntity)
    private grnRepo: Repository<GrnEntity>,
    @InjectRepository(GrnItemEntity)
    private grnItemRepo: Repository<GrnItemEntity>,
    @InjectRepository(GrnBatchDetailEntity)
    private grnBatchDetailRepo: Repository<GrnBatchDetailEntity>,
    @InjectRepository(PurchaseOrderEntity)
    private poRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private poItemRepo: Repository<PurchaseOrderItemEntity>,
    private inventoryCoreService: InventoryCoreService,
    private usersService: UsersService,
  ) {}

  async createGrn(dto: CreateGrnDto, req: ExtendedRequest) {
    const userRole = req.userDetails.role;
    const userId = req.userDetails.userId;

    // Get PO with distributor info
    const po = await this.poRepo.findOne({
      where: { id: dto.purchaseOrderId },
      relations: ['items', 'items.item', 'distributor'],
    });

    if (!po) {
      throw new BadRequestException('Purchase Order not found');
    }

    // For distributors, enforce that they can only create GRN for POs assigned to their distributor
    if (userRole === 'distributor') {
      if (po.distributorId !== userId) {
        throw new ForbiddenException(
          'You can only create GRN for your own POs',
        );
      }
    }

    // Use the PO's distributorId
    const distributorId = po.distributorId;

    if (po.status !== 'DELIVERED') {
      throw new BadRequestException(
        'PO must be marked as DELIVERED to create GRN',
      );
    }

    const grnNo = `GRN-${Date.now()}`;
    const grn = this.grnRepo.create({
      grnNo,
      purchaseOrderId: po.id,
      distributorId,
      createdBy: userId,
      status: 'DRAFT',
      totalAmount: 0,
      remarks: dto.remarks,
    });

    const savedGrn = await this.grnRepo.save(grn);

    let totalAmount = 0;
    const grnItems: GrnItemEntity[] = [];

    // Validate batch/serial requirements for each item
    for (const item of dto.items) {
      // Get item details to check tracking flags
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      if (!poItem) {
        throw new BadRequestException(
          `PO item with ID ${item.poItemId} not found`,
        );
      }

      const itemMaster = poItem.item;

      // VALIDATION: Check if batch number is mandatory
      if (
        itemMaster.hasBatchTracking &&
        !item.batchNumber &&
        (!item.batchDetails || item.batchDetails.length === 0)
      ) {
        throw new BadRequestException(
          `Batch number is required for item "${itemMaster.name}" as it has batch tracking enabled`,
        );
      }

      // VALIDATION: Check if serial details are mandatory
      if (
        itemMaster.hasSerialTracking &&
        !item.serialNumber &&
        (!item.serialDetails || item.serialDetails.length === 0)
      ) {
        throw new BadRequestException(
          `Serial details are required for item "${itemMaster.name}" as it has serial tracking enabled`,
        );
      }

      // VALIDATION: If batch details provided, validate total quantity matches received quantity
      if (
        item.batchDetails &&
        Array.isArray(item.batchDetails) &&
        item.batchDetails.length > 0
      ) {
        const totalBatchQty = item.batchDetails.reduce(
          (sum, batch) => sum + (batch.quantity || 0),
          0,
        );

        if (totalBatchQty !== item.receivedQuantity) {
          throw new BadRequestException(
            `Total batch quantity (${totalBatchQty}) must equal received quantity (${item.receivedQuantity}) for item "${itemMaster.name}"`,
          );
        }

        // Validate each batch has required fields
        for (const batch of item.batchDetails) {
          if (!batch.batchNumber || !batch.batchNumber.trim()) {
            throw new BadRequestException(
              `Batch number is required for all batches of item "${itemMaster.name}"`,
            );
          }

          if (!batch.quantity || batch.quantity <= 0) {
            throw new BadRequestException(
              `Batch quantity must be greater than 0 for batch "${batch.batchNumber}" of item "${itemMaster.name}"`,
            );
          }
        }
      }

      // VALIDATION: If serial details provided, validate total quantity and uniqueness
      if (
        item.serialDetails &&
        Array.isArray(item.serialDetails) &&
        item.serialDetails.length > 0
      ) {
        // For serial tracking, each serial typically represents 1 unit
        // So the number of serial entries should match the received quantity
        const totalSerialQty = item.serialDetails.reduce(
          (sum, serial) => sum + (serial.quantity || 1),
          0,
        );

        if (totalSerialQty !== item.receivedQuantity) {
          throw new BadRequestException(
            `Total serial quantity (${totalSerialQty}) must equal received quantity (${item.receivedQuantity}) for item "${itemMaster.name}"`,
          );
        }

        // Validate each serial has required fields
        const serialNumbers: string[] = [];
        for (const serial of item.serialDetails) {
          if (!serial.serialNumber || !serial.serialNumber.trim()) {
            throw new BadRequestException(
              `Serial number is required for all serial entries of item "${itemMaster.name}"`,
            );
          }

          serialNumbers.push(serial.serialNumber);

          // Validate quantity if provided
          if (serial.quantity !== undefined && serial.quantity <= 0) {
            throw new BadRequestException(
              `Serial quantity must be greater than 0 for serial "${serial.serialNumber}" of item "${itemMaster.name}"`,
            );
          }
        }

        // Validate unique serial numbers
        const uniqueSerials = new Set(serialNumbers);
        if (uniqueSerials.size !== serialNumbers.length) {
          throw new BadRequestException(
            `Duplicate serial numbers found for item "${itemMaster.name}". Each serial number must be unique.`,
          );
        }
      }

      const pendingQty = item.originalQuantity - item.receivedQuantity;
      const grnItem = this.grnItemRepo.create({
        grnId: savedGrn.id,
        poItemId: item.poItemId,
        itemId: item.itemId,
        receivedQuantity: item.receivedQuantity,
        originalQuantity: item.originalQuantity,
        unitPrice: item.unitPrice,
        pendingQuantity: pendingQty,
        batchNumber: item.batchNumber,
        serialNumber: item.serialNumber,
        expiryDate: item.expiryDate,
      });
      grnItems.push(grnItem);
      totalAmount += item.unitPrice * item.receivedQuantity;
    }

    if (grnItems.length > 0) {
      await this.grnItemRepo.save(grnItems);

      // Create batch/serial details for each GRN item
      for (let i = 0; i < dto.items.length; i++) {
        const dtoItem = dto.items[i];
        const grnItem = grnItems[i];

        // Handle new batchDetails array format
        if (dtoItem.batchDetails && Array.isArray(dtoItem.batchDetails)) {
          for (const batch of dtoItem.batchDetails) {
            const batchDetail = this.grnBatchDetailRepo.create({
              grnItemId: grnItem.id,
              batchNumber: batch.batchNumber,
              quantity: batch.quantity,
              expiryDate: batch.expiryDate || null,
            });
            await this.grnBatchDetailRepo.save(batchDetail);
          }
        }

        // Handle legacy batches array format for backward compatibility
        if (dtoItem.batches && Array.isArray(dtoItem.batches)) {
          for (const batch of dtoItem.batches) {
            const batchDetail = this.grnBatchDetailRepo.create({
              grnItemId: grnItem.id,
              batchNumber: batch.batchNumber,
              quantity: batch.quantity || 1,
              expiryDate: batch.expiryDate || null,
            });
            await this.grnBatchDetailRepo.save(batchDetail);
          }
        }

        // Handle serialDetails array - link to batch if item has both batch and serial tracking
        if (dtoItem.serialDetails && Array.isArray(dtoItem.serialDetails)) {
          // Get the batch number from batchDetails if available (for items with both tracking)
          let linkedBatchNumber: string | null = null;
          if (dtoItem.batchDetails && dtoItem.batchDetails.length > 0) {
            linkedBatchNumber = dtoItem.batchDetails[0].batchNumber;
          } else if (dtoItem.batchNumber) {
            linkedBatchNumber = dtoItem.batchNumber;
          }

          for (const serial of dtoItem.serialDetails) {
            const batchDetail = this.grnBatchDetailRepo.create({
              grnItemId: grnItem.id,
              batchNumber: linkedBatchNumber || serial.serialNumber, // Use linked batch or serial as fallback
              quantity: serial.quantity || 1,
              serialNumber: serial.serialNumber,
              expiryDate:
                serial.expiryDate ||
                dtoItem.batchDetails?.[0]?.expiryDate ||
                null,
            });
            await this.grnBatchDetailRepo.save(batchDetail);
          }
        }
      }
    }

    savedGrn.totalAmount = totalAmount;
    po.grnStatus = 'IN_PROGRESS';
    po.grnId = savedGrn.id;
    await this.poRepo.save(po);
    await this.grnRepo.save(savedGrn);

    return await this.getGrnDetail(savedGrn.id);
  }

  async getGrnDetail(id: number, req?: ExtendedRequest) {
    const grn = await this.grnRepo.findOne({
      where: { id },
      relations: [
        'items',
        'items.item',
        'purchaseOrder',
        'purchaseOrder.items',
        'distributor',
      ],
    });

    // Authorization check: Distributors can only view their own GRNs
    if (req && req.userDetails) {
      if (
        req.userDetails.role === 'distributor' &&
        grn?.distributorId !== req.userDetails.userId
      ) {
        throw new ForbiddenException('You can only view your own GRNs');
      }
    }

    return grn;
  }

  async getGrnsByPo(poId: number) {
    return await this.grnRepo.find({
      where: { purchaseOrderId: poId },
      relations: ['items', 'items.item', 'createdByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async listGrnsForDistributor(distributorId: number, search?: string) {
    let query = this.grnRepo
      .createQueryBuilder('grn')
      .leftJoinAndSelect('grn.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .leftJoinAndSelect('grn.purchaseOrder', 'po')
      .leftJoinAndSelect('grn.createdByUser', 'createdBy')
      .where('grn.distributorId = :distributorId', { distributorId });

    if (search) {
      query = query.andWhere(
        '(grn.grnNo LIKE :search OR po.poNo LIKE :search)',
        { search: `%${search}%` },
      );
    }

    return await query.orderBy('grn.createdAt', 'DESC').getMany();
  }

  async listAllGrns(search?: string) {
    let query = this.grnRepo
      .createQueryBuilder('grn')
      .leftJoinAndSelect('grn.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .leftJoinAndSelect('grn.purchaseOrder', 'po')
      .leftJoinAndSelect('grn.createdByUser', 'createdBy');

    if (search) {
      query = query.where('(grn.grnNo LIKE :search OR po.poNo LIKE :search)', {
        search: `%${search}%`,
      });
    }

    return await query.orderBy('grn.createdAt', 'DESC').getMany();
  }

  async approveGrn(id: number, req: ExtendedRequest) {
    const grn = await this.getGrnDetail(id, req);

    if (!grn) {
      throw new BadRequestException('GRN not found');
    }

    // Distributors can only approve their own GRNs
    if (req.userDetails.role === 'distributor') {
      if (grn.distributorId !== req.userDetails.userId) {
        throw new ForbiddenException('You can only approve your own GRNs');
      }
    }

    if (grn.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT GRNs can be approved');
    }

    // Get distributor company ID for the user
    const user = await this.usersService.findOne(req.userDetails.userId);

    if (user?.role !== 'distributor') {
      throw new BadRequestException(
        'User must be associated with a distributor',
      );
    }
    const distributorId = req.userDetails.userId;

    // Get or create default warehouse for distributor (used for all items)
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    // ═══════════════════════════════════════════════════════════════
    // ENTERPRISE INVENTORY ONLY: Create lots, serials, and transactions
    // Requirements: 2.1, 2.2, 2.3, 2.4
    // ═══════════════════════════════════════════════════════════════
    for (const item of grn.items) {
      // Get batch/serial details for this GRN item
      const grnBatchDetails = await this.grnBatchDetailRepo.find({
        where: { grnItemId: item.id },
      });

      // Separate batch entries from serial entries
      // Serial entries have serialNumber field set, batch entries don't
      const batchEntries = grnBatchDetails.filter(
        (bd) => !bd.serialNumber && bd.batchNumber,
      );
      const serialEntries = grnBatchDetails.filter((bd) => bd.serialNumber);

      // Map to store created lots for linking serials
      const batchNumberToLotMap = new Map<number, number>(); // lotId -> lotId

      // Process batch entries - create inventory_lot and GRN_RECEIPT transaction
      // Requirements: 2.2 (batch-tracked items create inventory_lot)
      for (const batchDetail of batchEntries) {
        // Create lot in enterprise inventory
        const lot = await this.inventoryCoreService.createLot({
          lotNumber: batchDetail.batchNumber,
          itemId: item.itemId,
          expiryDate: batchDetail.expiryDate
            ? String(batchDetail.expiryDate)
            : undefined,
          receivedDate: new Date().toISOString().split('T')[0],
          grnId: grn.id,
          distributorId,
          warehouseId: warehouse.id,
          createdBy: req.userDetails.userId,
        });

        // Create inventory transaction (IN movement)
        // Requirements: 2.1, 2.4 (GRN_RECEIPT transaction with reference)
        await this.inventoryCoreService.createTransaction({
          transactionType: 'GRN_RECEIPT',
          movementType: 'IN',
          itemId: item.itemId,
          lotId: lot.id,
          quantity: batchDetail.quantity,
          warehouseId: warehouse.id,
          referenceType: 'GRN',
          referenceId: grn.id,
          referenceNo: grn.grnNo,
          distributorId,
          remarks: `GRN Approval - Batch: ${batchDetail.batchNumber}`,
          createdBy: req.userDetails.userId,
        });

        batchNumberToLotMap.set(lot.id, lot.id);
      }

      // Process serial entries - create inventory_serial and GRN_RECEIPT transaction
      // Requirements: 2.3 (serial-tracked items create inventory_serial with status AVAILABLE)
      for (const serialDetail of serialEntries) {
        // Find or create lot for this serial
        let lotId: number | undefined;
        let lotNumber: string | undefined;

        // If serial has a batchNumber, try to find existing lot or create one
        if (serialDetail.batchNumber) {
          const existingLot = await this.inventoryCoreService.getLotByNumber(
            serialDetail.batchNumber,
            item.itemId,
          );

          if (existingLot) {
            lotId = existingLot.id;
            lotNumber = existingLot.lotNumber;
          } else {
            // Create a new lot for this serial's batch
            const newLot = await this.inventoryCoreService.createLot({
              lotNumber: serialDetail.batchNumber,
              itemId: item.itemId,
              expiryDate: serialDetail.expiryDate
                ? String(serialDetail.expiryDate)
                : undefined,
              receivedDate: new Date().toISOString().split('T')[0],
              grnId: grn.id,
              distributorId,
              warehouseId: warehouse.id,
              createdBy: req.userDetails.userId,
            });
            lotId = newLot.id;
            lotNumber = newLot.lotNumber;
          }
        }

        // Create serial record in enterprise inventory
        const serial = await this.inventoryCoreService.createSerial({
          serialNumber: serialDetail.serialNumber,
          itemId: item.itemId,
          lotId,
          currentWarehouseId: warehouse.id,
          currentOwnerType: 'DISTRIBUTOR',
          currentOwnerId: distributorId,
          grnId: grn.id,
          receivedDate: new Date().toISOString().split('T')[0],
          distributorId,
          createdBy: req.userDetails.userId,
        });

        // Create inventory transaction for serial (IN movement)
        // Requirements: 2.1, 2.4 (GRN_RECEIPT transaction with reference)
        await this.inventoryCoreService.createTransaction({
          transactionType: 'GRN_RECEIPT',
          movementType: 'IN',
          itemId: item.itemId,
          lotId,
          serialId: serial.id,
          quantity: serialDetail.quantity || 1,
          warehouseId: warehouse.id,
          referenceType: 'GRN',
          referenceId: grn.id,
          referenceNo: grn.grnNo,
          distributorId,
          remarks: `GRN Approval - Serial: ${serialDetail.serialNumber}${lotNumber ? `, Batch: ${lotNumber}` : ''}`,
          createdBy: req.userDetails.userId,
        });
      }

      // Handle items without batch/serial tracking (plain quantity)
      // If no batch or serial details, create a default lot and transaction
      if (batchEntries.length === 0 && serialEntries.length === 0) {
        // Create a default lot for non-tracked items
        const defaultLotNumber = `GRN-${grn.id}-ITEM-${item.itemId}`;
        const lot = await this.inventoryCoreService.createLot({
          lotNumber: defaultLotNumber,
          itemId: item.itemId,
          receivedDate: new Date().toISOString().split('T')[0],
          grnId: grn.id,
          distributorId,
          warehouseId: warehouse.id,
          createdBy: req.userDetails.userId,
        });

        // Create inventory transaction (IN movement)
        await this.inventoryCoreService.createTransaction({
          transactionType: 'GRN_RECEIPT',
          movementType: 'IN',
          itemId: item.itemId,
          lotId: lot.id,
          quantity: item.receivedQuantity,
          warehouseId: warehouse.id,
          referenceType: 'GRN',
          referenceId: grn.id,
          referenceNo: grn.grnNo,
          distributorId,
          remarks: `GRN Approval - Item: ${item.itemId}`,
          createdBy: req.userDetails.userId,
        });
      }
    }

    grn.status = 'APPROVED';
    grn.approvedBy = req.userDetails.userId;
    grn.approvedAt = new Date();
    await this.grnRepo.save(grn);

    // Update PO status if all items received
    const po = await this.poRepo.findOne({
      where: { id: grn.purchaseOrderId },
      relations: ['items'],
    });

    const totalPending = grn.items.reduce(
      (sum, item) => sum + item.pendingQuantity,
      0,
    );
    if (totalPending === 0) {
      po.status = 'COMPLETED';
      po.grnStatus = 'COMPLETED';
    }
    await this.poRepo.save(po);

    return await this.getGrnDetail(id);
  }

  async updateGrnQuantities(id: number, updates: any, req: ExtendedRequest) {
    const grn = await this.getGrnDetail(id, req);

    if (!grn) {
      throw new BadRequestException('GRN not found');
    }

    // Distributors can only update their own GRNs
    if (
      req.userDetails.role === 'distributor' &&
      grn.distributorId !== req.userDetails.userId
    ) {
      throw new ForbiddenException('You can only update your own GRNs');
    }

    if (grn.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT GRNs can be updated');
    }

    let totalAmount = 0;
    for (const update of updates) {
      const item = grn.items.find((i) => i.id === update.id);
      if (item) {
        item.receivedQuantity = update.receivedQuantity;
        item.pendingQuantity = item.originalQuantity - update.receivedQuantity;
        totalAmount += item.unitPrice * update.receivedQuantity;
        await this.grnItemRepo.save(item);
      }
    }

    grn.totalAmount = totalAmount;
    await this.grnRepo.save(grn);

    return await this.getGrnDetail(id);
  }

  async closePo(poId: number, req: ExtendedRequest) {
    const po = await this.poRepo.findOne({ where: { id: poId } });

    if (!po) {
      throw new BadRequestException('PO not found');
    }

    if (po.distributorId !== req.userDetails.userId) {
      throw new ForbiddenException('You can only close your own POs');
    }

    po.status = 'CLOSED';
    po.grnStatus = 'COMPLETED';
    await this.poRepo.save(po);

    return po;
  }

  async splitPo(poId: number, items: any[], req: ExtendedRequest) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item'],
    });

    if (!po) {
      throw new BadRequestException('PO not found');
    }

    if (po.distributorId !== req.userDetails.userId) {
      throw new ForbiddenException('You can only split your own POs');
    }

    // Create new PO for pending items
    const newPoNo = `PO-${Date.now()}`;
    const newPo = this.poRepo.create({
      poNo: newPoNo,
      distributorId: po.distributorId,
      createdBy: po.createdBy,
      status: 'PENDING',
      totalAmount: 0,
    });

    const savedNewPo = await this.poRepo.save(newPo);

    let totalAmount = 0;
    const newItems: PurchaseOrderItemEntity[] = [];

    for (const itemId of items) {
      const poItem = po.items.find((i) => i.id === itemId);
      if (poItem) {
        const newPoItem = this.poItemRepo.create({
          purchaseOrderId: savedNewPo.id,
          itemId: poItem.itemId,
          quantity: poItem.quantity,
          unitPrice: poItem.unitPrice,
        });
        newItems.push(newPoItem);
        totalAmount += poItem.unitPrice * poItem.quantity;
      }
    }

    if (newItems.length > 0) {
      await this.poItemRepo.save(newItems);
    }

    savedNewPo.totalAmount = totalAmount;
    await this.poRepo.save(savedNewPo);

    return savedNewPo;
  }
}
