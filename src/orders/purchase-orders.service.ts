import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from './entities/purchase-order-item.entity';
import { ItemEntity } from 'src/items/entities/item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { S3Service } from 'src/common/services/s3.service';
import { InventoryService } from 'src/inventory/inventory.service';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { LedgerService } from 'src/ledger/ledger.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private poRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private poItemRepo: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(ItemEntity)
    private itemRepo: Repository<ItemEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepo: Repository<DistributorEntity>,
    private s3Service: S3Service,
    private ledgerService: LedgerService,
    private inventoryService?: InventoryService,
    private usersService?: UsersService,
  ) {}

  async create(dto: CreatePurchaseOrderDto, req: ExtendedRequest) {
    // Use user_master.id directly as distributorId
    const distributorId = req.userDetails.userId;

    const poNo = `PO-${Date.now()}`;
    const po = this.poRepo.create({
      poNo,
      distributorId,
      createdBy: req.userDetails.userId,
      totalAmount: 0,
      status: 'PENDING',
    });

    const savedPo = await this.poRepo.save(po);

    let totalAmount = 0;
    const items: PurchaseOrderItemEntity[] = [];

    for (const item of dto.items) {
      const dbItem = await this.itemRepo.findOne({
        where: { id: item.itemId },
      });
      if (dbItem) {
        const poItem = this.poItemRepo.create({
          purchaseOrderId: savedPo.id,
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: dbItem.rate,
        });
        items.push(poItem);
        totalAmount += dbItem.rate * item.quantity;
      }
    }

    if (items.length > 0) {
      await this.poItemRepo.save(items);
    }

    savedPo.totalAmount = totalAmount;
    await this.poRepo.save(savedPo);

    // NOTE: Inventory is NOT updated here during PO creation.
    // Inventory should only be updated when GRN is approved (goods actually received).
    // This follows standard inventory management practice.

    return await this.poRepo.findOne({
      where: { id: savedPo.id },
      relations: ['items', 'items.item', 'distributor'],
    });
  }

  async findAll(
    req: ExtendedRequest,
    search?: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
    distributorId?: number,
  ) {
    const userId = req.userDetails.userId;
    const role = req.userDetails.role;

    let query = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .leftJoinAndSelect('po.distributor', 'distributor')
      .leftJoinAndSelect('distributor.distributor', 'distributorDetails');

    if (role === 'distributor') {
      query = query.where('po.distributorId = :userId', {
        userId,
      });
    }

    if (search) {
      query = query.andWhere(
        '(po.poNo LIKE :search OR distributor.name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      query = query.andWhere('po.status = :status', { status });
    }

    if (distributorId && (role === 'super_admin' || role === 'manager')) {
      query = query.andWhere('po.distributorId = :distributorId', {
        distributorId,
      });
    }

    if (startDate) {
      query = query.andWhere('po.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      query = query.andWhere('po.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const totalCount = await query.getCount();
    query = query.orderBy('po.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    query = query.skip(skip).take(limit);

    const data = await query.getMany();

    return {
      data,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findOne(id: number) {
    return await this.poRepo.findOne({
      where: { id },
      relations: ['items', 'items.item', 'distributor'],
    });
  }

  async updateStatus(poId: number, newStatus: string) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });
    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    // Prevent modifications to approved purchase orders
    // if (po.approvalStatus === 'APPROVED') {
    //   throw new BadRequestException('Cannot modify an approved Purchase Order');
    // }

    po.status = newStatus;
    await this.poRepo.save(po);

    // NOTE: Inventory is NOT updated here when PO status changes to COMPLETED.
    // Inventory should only be updated when GRN is approved (goods actually received).
    // PO COMPLETED status is set automatically after GRN approval when all items are received.

    return await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });
  }

  async uploadInvoice(poId: number, file: Express.Multer.File) {
    const po = await this.poRepo.findOne({ where: { id: poId } });
    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    // Invoice upload is only allowed after approval, but changes like status still blocked
    // if (po.approvalStatus !== 'APPROVED') {
    //   throw new BadRequestException('Purchase order must be approved before uploading invoice');
    // }

    try {
      const fileKey = `po-invoices/${uuidv4()}-${file.originalname}`;
      const bucket = process.env.AWS_S3_BUCKET || 'omniordera';

      const invoiceUrl = await this.s3Service.uploadS3File(
        file,
        bucket,
        fileKey,
      );

      po.invoiceUrl = invoiceUrl;
      po.invoiceFileName = file.originalname;
      await this.poRepo.save(po);

      return {
        id: po.id,
        poNo: po.poNo,
        invoiceUrl,
        invoiceFileName: file.originalname,
        message: 'Invoice uploaded successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload invoice: ${error.message}`,
      );
    }
  }

  async approvePurchaseOrder(poId: number, approvedBy: number) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });

    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    if (po.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Purchase order is already approved');
    }

    if (po.approvalStatus === 'REJECTED') {
      throw new BadRequestException('Cannot approve a rejected purchase order');
    }

    po.approvalStatus = 'APPROVED';
    po.approvedBy = approvedBy;
    po.approvedAt = new Date();
    po.rejectionReason = null;

    await this.poRepo.save(po);

    return await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor', 'approvedByUser'],
    });
  }

  async rejectPurchaseOrder(poId: number, rejectedBy: number, reason: string) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });

    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    if (po.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Cannot reject an approved purchase order');
    }

    if (po.approvalStatus === 'REJECTED') {
      throw new BadRequestException('Purchase order is already rejected');
    }

    po.approvalStatus = 'REJECTED';
    po.rejectedBy = rejectedBy;
    po.rejectedAt = new Date();
    po.rejectionReason = reason;
    po.status = 'REJECTED';

    await this.poRepo.save(po);

    return await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor', 'rejectedByUser'],
    });
  }

  async markAsDelivered(
    poId: number,
    batchDetails?: Array<{
      itemId: number;
      batchNumber?: string;
      serialNumber?: string;
      expiryDate?: string;
    }>,
  ) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });

    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    // CRITICAL: Check approval status before marking as delivered
    if (po.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Purchase order must be approved before marking as delivered',
      );
    }

    // Save batch details to PO items if provided
    if (batchDetails && batchDetails.length > 0) {
      for (const detail of batchDetails) {
        const poItem = po.items.find((i) => i.itemId === detail.itemId);
        if (poItem) {
          poItem.batchNumber = detail.batchNumber || undefined;
          poItem.serialNumber = detail.serialNumber || undefined;
          poItem.expiryDate = detail.expiryDate || undefined;
          await this.poItemRepo.save(poItem);
        }
      }
    }

    po.status = 'DELIVERED';
    po.grnStatus = 'PENDING';
    await this.poRepo.save(po);

    // Create ledger entry for PURCHASE (DEBIT - increases distributor's debt)
    await this.ledgerService.createEntry(
      po.distributorId,
      'PURCHASE',
      po.totalAmount,
      `Purchase order delivered - ${po.poNo}`,
      po.poNo,
      'PURCHASE_ORDER',
      po.id,
    );

    // Inventory will be updated when distributor approves GRN, not when admin marks as delivered
    // GRN is now responsible for inventory management

    return await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });
  }

  async saveBatchDetails(
    poId: number,
    distributorId: number,
    batchDetails: Array<{
      itemId: number;
      batchNumber: string;
      serialNumber?: string;
      expiryDate: string;
    }>,
  ) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items'],
    });
    if (!po) throw new BadRequestException('Purchase order not found');

    // if (po.approvalStatus !== 'APPROVED') {
    //   throw new BadRequestException('Can only add batch details to approved purchase orders');
    // }

    // NOTE: Batch/serial details are now handled through GRN process
    // This endpoint is kept for backward compatibility but doesn't update inventory
    // Batch details will be properly recorded when GRN is approved
    return {
      message:
        'Batch details noted. They will be applied when GRN is approved.',
      poId,
    };
  }

  async downloadBatchImportTemplate(): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [
        'Item ID',
        'Item Name',
        'Batch Number',
        'Serial Number (Optional)',
        'Expiry Date (YYYY-MM-DD)',
      ],
      [1, 'Sample Item', 'BATCH-001', 'SN-12345', '2025-12-31'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch Template');
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }

  async processBatchExcelImport(poId: number, file: Express.Multer.File) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items'],
    });
    if (!po) throw new BadRequestException('Purchase order not found');

    // if (po.approvalStatus !== 'APPROVED') {
    //   throw new BadRequestException('Can only import batch details for approved purchase orders');
    // }

    try {
      const workbook = XLSX.read(file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      // NOTE: Batch/serial details are now handled through GRN process
      // This endpoint is kept for backward compatibility but doesn't update inventory
      // Batch details will be properly recorded when GRN is approved
      return {
        message: 'Batch data noted. They will be applied when GRN is approved.',
        poId,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to import batch data: ${error.message}`,
      );
    }
  }

  async updatePurchaseOrder(
    poId: number,
    updateData: { items?: Array<{ itemId: number; quantity: number }> },
  ) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });
    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    // Prevent modifications to approved purchase orders for distributors
    // (admins can modify even approved POs)
    // if (po.approvalStatus === 'APPROVED') {
    //   throw new BadRequestException('Cannot modify an approved Purchase Order');
    // }

    // Update items if provided
    if (updateData.items && updateData.items.length > 0) {
      // Remove old items
      await this.poItemRepo.remove(po.items);

      // Add new items
      let totalAmount = 0;
      for (const itemData of updateData.items) {
        const item = await this.itemRepo.findOne({
          where: { id: itemData.itemId },
        });
        if (!item) {
          throw new BadRequestException(
            `Item with ID ${itemData.itemId} not found`,
          );
        }

        const poItem = this.poItemRepo.create({
          purchaseOrder: po,
          item,
          itemId: item.id,
          quantity: itemData.quantity,
          unitPrice: item.rate || 0,
        });
        await this.poItemRepo.save(poItem);
        totalAmount += (item.rate || 0) * itemData.quantity;
      }

      po.totalAmount = totalAmount;
      await this.poRepo.save(po);
    }

    return await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items', 'items.item', 'distributor'],
    });
  }

  async deletePurchaseOrder(poId: number) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: ['items'],
    });
    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    // Only allow deletion of PENDING POs
    if (po.status !== 'PENDING') {
      throw new BadRequestException(
        'Can only delete Purchase Orders with PENDING status',
      );
    }

    // Remove items first
    if (po.items && po.items.length > 0) {
      await this.poItemRepo.remove(po.items);
    }

    // Remove PO
    await this.poRepo.remove(po);
    return { message: 'Purchase order deleted successfully', poId };
  }
}
