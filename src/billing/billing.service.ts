import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BillingEntity } from './entities/billing.entity';
import { BillingItemEntity } from './entities/billing-item.entity';
import { BillingBatchDetailEntity } from './entities/billing-batch-detail.entity';
import { CreateBillingDto } from './dto/create-billing.dto';
import PDFDocument from 'pdfkit';
import { PaymentRequestsService } from 'src/payment-requests/payment-requests.service';
import { InventoryService } from 'src/inventory/inventory.service';
import { InventoryCoreService } from 'src/inventory/inventory-core.service';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingEntity)
    private billingRepository: Repository<BillingEntity>,
    @InjectRepository(BillingItemEntity)
    private billingItemRepository: Repository<BillingItemEntity>,
    @InjectRepository(BillingBatchDetailEntity)
    private billingBatchDetailRepository: Repository<BillingBatchDetailEntity>,
    private dataSource: DataSource,
    private paymentRequestsService?: PaymentRequestsService,
    private inventoryService?: InventoryService,
    private inventoryCoreService?: InventoryCoreService,
  ) {}

  async create(
    createBillingDto: CreateBillingDto,
    userId: number,
    userIp: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // CRITICAL: Validate stock availability BEFORE creating billing
      // Uses Enterprise Inventory System (transaction-based calculation)
      if (createBillingDto.items && createBillingDto.items.length > 0) {
        // Get or create default warehouse for this distributor
        const warehouse =
          await this.inventoryCoreService.getOrCreateDefaultWarehouse(
            createBillingDto.distributorId,
          );

        for (const item of createBillingDto.items) {
          // Get item tracking flags from item_master
          const itemRecords = await queryRunner.manager.query(
            `SELECT id, name, hasBatchTracking, hasSerialTracking
             FROM item_master WHERE id = ?`,
            [item.itemId],
          );

          if (!itemRecords || itemRecords.length === 0) {
            throw new BadRequestException(
              `Item "${item.itemName}" not found in the system`,
            );
          }

          const itemMaster = itemRecords[0];
          const hasBatch = itemMaster.hasBatchTracking;
          const hasSerial = itemMaster.hasSerialTracking;
          const providedBatch = item.batchNumber;
          const providedSerial = item.serialNumber;

          // VALIDATION: Check if batch/serial tracking is required
          // IMPORTANT: If item has BOTH batch AND serial tracking, serial is the PRIMARY identifier
          // because each serial represents a unique sellable unit within a batch
          if (hasBatch && hasSerial) {
            // Item has BOTH tracking - MUST provide serial number (serial is the sellable unit)
            // Batch is optional but recommended for traceability
            if (!providedSerial) {
              throw new BadRequestException(
                `Serial number is required for item "${item.itemName}" as it has serial tracking enabled. ` +
                  `Each unit must be identified by its serial number. Please select a specific serial to sell.`,
              );
            }

            // Validate serial using InventoryCoreService (Requirements 3.3)
            const serial = await this.inventoryCoreService.getSerialByNumber(
              providedSerial,
              parseInt(item.itemId as any),
            );

            if (!serial) {
              throw new BadRequestException(
                `Serial number "${providedSerial}" not found for item "${item.itemName}"`,
              );
            }

            // Validate serial belongs to this distributor
            if (serial.distributorId !== createBillingDto.distributorId) {
              throw new BadRequestException(
                `Serial number "${providedSerial}" not found for item "${item.itemName}"`,
              );
            }

            if (serial.status !== 'AVAILABLE') {
              throw new BadRequestException(
                `Serial number "${providedSerial}" is not available (Status: ${serial.status}). Please select an available serial.`,
              );
            }

            // For serial-tracked items, quantity must be 1 per serial
            if (item.quantity !== 1) {
              throw new BadRequestException(
                `For serial-tracked items, quantity must be 1 per serial number. ` +
                  `To sell ${item.quantity} units, please add ${item.quantity} separate line items with different serial numbers.`,
              );
            }
          } else if (hasBatch && !providedBatch) {
            // Item has ONLY batch tracking - auto-allocate using FEFO if batch not specified
            // Requirements 4.1: Use FEFO (First Expiry First Out) strategy by default
            // Auto-allocation will be done during transaction creation
            // For now, just validate that sufficient stock exists across all lots
            const availableLots =
              await this.inventoryCoreService.getAvailableLots(
                parseInt(item.itemId as any),
                warehouse.id,
                createBillingDto.distributorId,
                'FEFO',
              );

            const totalAvailable = availableLots.reduce(
              (sum, lot) => sum + lot.availableQuantity,
              0,
            );

            if (totalAvailable < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for "${item.itemName}". Available: ${totalAvailable}, Required: ${item.quantity}. ` +
                  `Note: Expired lots are excluded from available stock.`,
              );
            }

            // Store the auto-allocation info for later use during transaction creation
            (item as any)._autoAllocate = true;
            (item as any)._allocations =
              await this.inventoryCoreService.allocateStock(
                parseInt(item.itemId as any),
                warehouse.id,
                item.quantity,
                createBillingDto.distributorId,
                'FEFO',
              );
          } else if (hasSerial && !providedSerial) {
            // Item has ONLY serial tracking - require serial number
            throw new BadRequestException(
              `Serial number is required for item "${item.itemName}" as it has serial tracking enabled`,
            );
          }

          // Calculate available quantity using transaction-based calculation (Requirements 3.1)
          const availableQuantity =
            await this.inventoryCoreService.getAvailableQuantity(
              parseInt(item.itemId as any),
              warehouse.id,
              createBillingDto.distributorId,
            );

          if (availableQuantity <= 0) {
            throw new BadRequestException(
              `Item "${item.itemName}" is not available in your inventory`,
            );
          }

          if (availableQuantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${item.itemName}". Available: ${availableQuantity}, Required: ${item.quantity}`,
            );
          }

          // If batch tracked, validate batch quantity and expiry using lot-based calculation (Requirements 3.2)
          if (item.batchNumber) {
            const lot = await this.inventoryCoreService.getLotByNumber(
              item.batchNumber,
              parseInt(item.itemId as any),
            );

            if (!lot) {
              throw new BadRequestException(
                `Batch "${item.batchNumber}" not found for item "${item.itemName}"`,
              );
            }

            // Validate lot belongs to this distributor
            if (lot.distributorId !== createBillingDto.distributorId) {
              throw new BadRequestException(
                `Batch "${item.batchNumber}" not found for item "${item.itemName}"`,
              );
            }

            // Calculate available quantity for this specific lot
            const lotAvailableQuantity =
              await this.inventoryCoreService.getAvailableQuantity(
                parseInt(item.itemId as any),
                warehouse.id,
                createBillingDto.distributorId,
                lot.id,
              );

            if (lotAvailableQuantity < item.quantity) {
              throw new BadRequestException(
                `Insufficient quantity in batch "${item.batchNumber}". Available: ${lotAvailableQuantity}, Required: ${item.quantity}`,
              );
            }

            // Check expiry date
            if (lot.expiryDate) {
              const expiryDate = new Date(lot.expiryDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              expiryDate.setHours(0, 0, 0, 0);

              if (expiryDate < today) {
                throw new BadRequestException(
                  `Batch "${item.batchNumber}" has expired on ${expiryDate.toDateString()}. Cannot sell expired items.`,
                );
              }

              // Warn if expiring within 30 days (but allow sale)
              const thirtyDaysFromNow = new Date(today);
              thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

              if (expiryDate <= thirtyDaysFromNow) {
                console.warn(
                  `Warning: Batch "${item.batchNumber}" is expiring soon on ${expiryDate.toDateString()}`,
                );
              }
            }
          }

          // If serial tracked (without batch), validate serial using InventoryCoreService (Requirements 3.3)
          if (item.serialNumber && !hasBatch) {
            const serial = await this.inventoryCoreService.getSerialByNumber(
              item.serialNumber,
              parseInt(item.itemId as any),
            );

            if (!serial) {
              throw new BadRequestException(
                `Serial number "${item.serialNumber}" not found for item "${item.itemName}"`,
              );
            }

            // Validate serial belongs to this distributor
            if (serial.distributorId !== createBillingDto.distributorId) {
              throw new BadRequestException(
                `Serial number "${item.serialNumber}" not found for item "${item.itemName}"`,
              );
            }

            if (serial.status !== 'AVAILABLE') {
              throw new BadRequestException(
                `Serial number "${item.serialNumber}" is not available (Status: ${serial.status}). Please select an available serial.`,
              );
            }
          }
        }
      }

      // Create billing header
      console.log('=== BILLING CREATE DEBUG ===');
      console.log('DTO status:', createBillingDto.status);
      console.log(
        'Full DTO:',
        JSON.stringify(createBillingDto, null, 2).substring(0, 500),
      );

      const billing = this.billingRepository.create({
        ...createBillingDto,
        createdBy: userId,
        createdByIp: userIp,
      });

      console.log('Created billing entity status:', billing.status);

      // Generate billNo if not provided
      if (!billing.billNo) {
        const timestamp = Date.now();
        billing.billNo = `BILL-${timestamp}`;
      }

      // Set default paymentType if not provided
      if (!billing.paymentType) {
        billing.paymentType = 'cash';
      }

      // If status is 'completed', set approvalStatus to 'approved' and generate invoice number
      if (billing.status === 'completed') {
        billing.approvalStatus = 'approved';
        billing.approvedAt = new Date();
        billing.completedAt = new Date();
        // Generate invoice number
        const invoiceTimestamp = Date.now();
        billing.invoiceNo = `INV-${invoiceTimestamp}`;
        billing.invoiceDate = new Date().toISOString().split('T')[0];
      }

      // Set payment status based on payment type
      if (billing.paymentType === 'cash') {
        // Cash payment - mark as paid immediately
        billing.amountPaid = billing.finalAmount;
        billing.amountDue = 0;
        billing.paymentStatus = 'completed';
      } else {
        // Online or Credit - payment pending
        billing.amountPaid = 0;
        billing.amountDue = billing.finalAmount;
        billing.paymentStatus = 'pending';
      }

      const savedBilling = await queryRunner.manager.save(billing);

      // Create billing items (normalized)
      if (createBillingDto.items && createBillingDto.items.length > 0) {
        const billingItems = createBillingDto.items.map((item) => {
          return this.billingItemRepository.create({
            billingId: savedBilling.id,
            itemId: parseInt(item.itemId as any),
            itemName: item.itemName,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount || 0,
            discountType: item.discountType || 'percentage',
            taxableAmount: item.taxableAmount,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            totalAmount: item.totalAmount,
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            expiryDate: item.expiryDate,
            orderedByBox: item.orderedByBox || false,
            boxCount: item.boxCount || 0,
            boxRate: item.boxRate,
            unitsPerBox: item.unitsPerBox || 1,
          });
        });

        await queryRunner.manager.save(billingItems);

        // ═══════════════════════════════════════════════════════════════
        // ENTERPRISE INVENTORY: Create SALES_ISSUE transactions for billing
        // Requirements 3.4: Create inventory transaction with transactionType 'SALES_ISSUE' and movementType 'OUT'
        // Requirements 3.5: Update inventory_serial status to 'SOLD' and record customer as current owner
        // ═══════════════════════════════════════════════════════════════
        if (this.inventoryCoreService) {
          const warehouse =
            await this.inventoryCoreService.getOrCreateDefaultWarehouse(
              billing.distributorId,
            );

          for (const item of createBillingDto.items) {
            // Get item tracking flags
            const itemFlags = await queryRunner.manager.query(
              `SELECT hasBatchTracking, hasSerialTracking FROM item_master WHERE id = ?`,
              [item.itemId],
            );
            const hasBatch = itemFlags[0]?.hasBatchTracking;
            const hasSerial = itemFlags[0]?.hasSerialTracking;

            // Check if this item was auto-allocated using FEFO
            // Requirements 4.1: Use FEFO strategy for auto-allocation when batch not specified
            const autoAllocate = (item as any)._autoAllocate;
            const allocations = (item as any)._allocations;

            if (autoAllocate && allocations && allocations.length > 0) {
              // Create separate transactions for each allocated lot (FEFO order)
              for (const allocation of allocations) {
                await this.inventoryCoreService.createTransaction({
                  transactionType: 'SALES_ISSUE',
                  movementType: 'OUT',
                  itemId: parseInt(item.itemId as any),
                  lotId: allocation.lotId,
                  quantity: allocation.quantity,
                  warehouseId: warehouse.id,
                  referenceType: 'BILLING',
                  referenceId: savedBilling.id,
                  referenceNo: savedBilling.billNo,
                  unitCost: allocation.unitCost || item.rate,
                  distributorId: billing.distributorId,
                  remarks: `Sale - Invoice: ${savedBilling.billNo} (FEFO auto-allocated from batch ${allocation.lotNumber})`,
                  createdBy: userId,
                });

                // Create billing batch detail record for each allocation
                const batchDetail = this.billingBatchDetailRepository.create({
                  billingId: savedBilling.id,
                  itemId: parseInt(item.itemId as any),
                  batchNumber: allocation.lotNumber,
                  expiryDate: allocation.expiryDate || null,
                  quantity: allocation.quantity,
                  rate: item.rate,
                });
                await queryRunner.manager.save(batchDetail);
              }
              continue; // Skip the normal transaction creation for auto-allocated items
            }

            let lotId: number | undefined;
            let serialId: number | undefined;

            // If batch number provided, find the lot
            if (item.batchNumber) {
              const lot = await this.inventoryCoreService.getLotByNumber(
                item.batchNumber,
                parseInt(item.itemId as any),
              );
              if (lot) {
                lotId = lot.id;
              }
            }

            // If serial number provided, get serial and update status to SOLD
            // Requirements 3.5: Update inventory_serial status to 'SOLD' and record customer
            if (item.serialNumber) {
              const serial = await this.inventoryCoreService.getSerialByNumber(
                item.serialNumber,
                parseInt(item.itemId as any),
              );

              if (serial) {
                serialId = serial.id;
                // If serial has a linked lot, use that lot for the transaction
                if (serial.lotId && !lotId) {
                  lotId = serial.lotId;
                }

                // Update serial status to SOLD with customer info
                await this.inventoryCoreService.updateSerialStatus(
                  serial.id,
                  'SOLD',
                  {
                    soldDate: new Date().toISOString().split('T')[0],
                    currentOwnerType: 'CUSTOMER',
                    currentOwnerId: billing.customerId,
                    billingId: savedBilling.id,
                    customerId: billing.customerId,
                  },
                );
              }
            }

            // Create SALES_ISSUE transaction
            // Requirements 3.4: Create transaction with referenceType 'BILLING' and referenceId
            await this.inventoryCoreService.createTransaction({
              transactionType: 'SALES_ISSUE',
              movementType: 'OUT',
              itemId: parseInt(item.itemId as any),
              lotId: lotId,
              serialId: serialId,
              quantity: item.quantity,
              warehouseId: warehouse.id,
              referenceType: 'BILLING',
              referenceId: savedBilling.id,
              referenceNo: savedBilling.billNo,
              unitCost: item.rate,
              distributorId: billing.distributorId,
              remarks: `Sale - Invoice: ${savedBilling.billNo}`,
              createdBy: userId,
            });

            // Create billing batch detail record for traceability
            if (item.batchNumber || item.serialNumber) {
              const batchDetail = this.billingBatchDetailRepository.create({
                billingId: savedBilling.id,
                itemId: parseInt(item.itemId as any),
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                expiryDate: item.expiryDate || null,
                quantity: item.quantity,
                rate: item.rate,
              });
              await queryRunner.manager.save(batchDetail);
            }
          }
        }
      }

      // Auto-create payment request for CREDIT invoices
      if (billing.paymentType === 'credit' && this.paymentRequestsService) {
        try {
          const distributorId = billing.distributorId || 1;
          await this.paymentRequestsService.createForCreditBilling(
            savedBilling.id,
            distributorId,
            savedBilling.finalAmount,
          );
        } catch (error) {
          console.error(
            'Failed to create payment request for credit invoice:',
            error,
          );
        }
      }

      await queryRunner.commitTransaction();
      return await this.findOne(savedBilling.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `Failed to create billing: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    search?: string,
    status?: string,
    authorizedDistributorIds?: number[] | null,
  ) {
    let query = this.billingRepository
      .createQueryBuilder('billing')
      .leftJoinAndSelect('billing.customer', 'customer')
      .leftJoinAndSelect('billing.billingItems', 'billingItems')
      .orderBy('billing.createdAt', 'DESC');

    // Apply distributor filter based on authorized IDs
    if (
      authorizedDistributorIds !== null &&
      authorizedDistributorIds !== undefined
    ) {
      query = query.where('billing.distributorId IN (:...distributorIds)', {
        distributorIds: authorizedDistributorIds,
      });
    }

    // Apply status filter if provided
    if (status) {
      query = query.andWhere('billing.approvalStatus = :status', { status });
    }

    // Apply search if provided
    if (search) {
      query = query.andWhere('billing.billNo LIKE :search', {
        search: `%${search}%`,
      });
    }

    return await query.getMany();
  }

  async findOne(id: number) {
    const billing = await this.billingRepository.findOne({
      where: { id },
      relations: ['customer', 'billingItems', 'billingItems.item'],
    });

    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    return billing;
  }

  async update(
    id: number,
    updateBillingDto: Partial<CreateBillingDto>,
    userId: number,
    userIp: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const billing = await this.billingRepository.findOne({ where: { id } });
      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      // Can only update if in draft status
      if (billing.approvalStatus !== 'draft') {
        throw new BadRequestException(
          'Cannot update approved or completed bills',
        );
      }

      // Update billing header
      await queryRunner.manager.update(BillingEntity, id, {
        ...updateBillingDto,
        updatedBy: userId,
        updatedByIp: userIp,
      });

      // Update billing items if provided
      if (updateBillingDto.items) {
        // Delete existing items
        await queryRunner.manager.delete(BillingItemEntity, { billingId: id });

        // Create new items
        const billingItems = updateBillingDto.items.map((item) => {
          return this.billingItemRepository.create({
            billingId: id,
            itemId: parseInt(item.itemId as any),
            itemName: item.itemName,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount || 0,
            discountType: item.discountType || 'percentage',
            taxableAmount: item.taxableAmount,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            totalAmount: item.totalAmount,
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            expiryDate: item.expiryDate,
            orderedByBox: item.orderedByBox || false,
            boxCount: item.boxCount || 0,
            boxRate: item.boxRate,
            unitsPerBox: item.unitsPerBox || 1,
          });
        });

        await queryRunner.manager.save(billingItems);
      }

      await queryRunner.commitTransaction();
      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `Failed to update billing: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async approveBilling(id: number, approvedByUserId: number) {
    const billing = await this.billingRepository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    if (billing.approvalStatus === 'approved') {
      throw new BadRequestException('Bill is already approved');
    }

    // Generate invoice number if not exists
    const invoiceNo = billing.invoiceNo || `INV-${Date.now()}`;

    await this.billingRepository.update(id, {
      approvalStatus: 'approved',
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: approvedByUserId,
      invoiceNo,
    });

    return await this.findOne(id);
  }

  async remove(id: number) {
    const billing = await this.billingRepository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    // Can only delete draft bills
    if (billing.approvalStatus !== 'draft') {
      throw new BadRequestException(
        'Cannot delete approved or completed bills',
      );
    }

    await this.billingRepository.delete(id);
    return { message: 'Billing deleted successfully' };
  }

  async complete(id: number) {
    const billing = await this.billingRepository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    if (billing.status === 'completed') {
      throw new BadRequestException('Bill is already completed');
    }

    // Generate invoice number if not exists
    const invoiceNo = billing.invoiceNo || `INV-${Date.now()}`;

    await this.billingRepository.update(id, {
      status: 'completed',
      approvalStatus: 'approved',
      invoiceNo,
      completedAt: new Date(),
    });

    return await this.findOne(id);
  }

  async recordPayment(
    id: number,
    amount: number,
    paymentMethod: string = 'cash',
    referenceNo?: string,
    notes?: string,
  ) {
    const billing = await this.billingRepository.findOne({ where: { id } });
    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const finalAmount = parseFloat(billing.finalAmount?.toString() || '0');
    const currentAmountPaid = parseFloat(billing.amountPaid?.toString() || '0');
    const newAmountPaid = currentAmountPaid + amount;

    if (newAmountPaid > finalAmount) {
      throw new BadRequestException(
        `Payment amount (₹${amount}) exceeds the remaining due amount (₹${finalAmount - currentAmountPaid})`,
      );
    }

    // Update billing payment status
    billing.amountPaid = newAmountPaid;
    billing.amountDue = Math.max(0, finalAmount - newAmountPaid);

    if (newAmountPaid >= finalAmount) {
      billing.paymentStatus = 'completed';
    } else if (newAmountPaid > 0) {
      billing.paymentStatus = 'partial';
    }

    // Add payment note if provided
    if (notes || referenceNo) {
      const paymentNote = `Payment of ₹${amount} received via ${paymentMethod}${referenceNo ? ` (Ref: ${referenceNo})` : ''}${notes ? ` - ${notes}` : ''}`;
      billing.notes = billing.notes
        ? `${billing.notes}\n${paymentNote}`
        : paymentNote;
    }

    await this.billingRepository.save(billing);
    return await this.findOne(id);
  }

  async generatePDF(id: number): Promise<Buffer> {
    const billing = await this.findOne(id);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        const pageWidth = 595.28; // A4 width in points
        const margin = 40;
        const contentWidth = pageWidth - margin * 2;

        // Helper functions
        const formatCurrency = (amount: number | string) => {
          const num = typeof amount === 'string' ? parseFloat(amount) : amount;
          return `₹${(num || 0).toFixed(2)}`;
        };

        const formatDate = (dateStr: string) => {
          if (!dateStr) return '-';
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        };

        const drawLine = (y: number, color = '#E5E7EB') => {
          doc
            .strokeColor(color)
            .lineWidth(1)
            .moveTo(margin, y)
            .lineTo(pageWidth - margin, y)
            .stroke();
        };

        // ═══════════════════════════════════════════════════════════════
        // HEADER SECTION
        // ═══════════════════════════════════════════════════════════════

        // Company Header Background
        doc.rect(0, 0, pageWidth, 100).fill('#4F46E5');

        // Company Name
        doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold');
        doc.text('TAX INVOICE', margin, 30, { align: 'center' });

        // Invoice Number Badge
        doc.fontSize(12).font('Helvetica');
        doc.text(
          `Invoice: ${billing.invoiceNo || billing.billNo}`,
          margin,
          60,
          { align: 'center' },
        );

        // Reset position
        doc.fillColor('#000000');
        let currentY = 120;

        // ═══════════════════════════════════════════════════════════════
        // INVOICE INFO & CUSTOMER DETAILS (Two Columns)
        // ═══════════════════════════════════════════════════════════════

        const leftColX = margin;
        const rightColX = pageWidth / 2 + 20;
        const colWidth = contentWidth / 2 - 20;

        // Left Column - Invoice Details
        doc
          .rect(leftColX, currentY, colWidth, 100)
          .fill('#F9FAFB')
          .stroke('#E5E7EB');

        doc.fillColor('#4F46E5').fontSize(11).font('Helvetica-Bold');
        doc.text('INVOICE DETAILS', leftColX + 10, currentY + 10);

        doc.fillColor('#374151').fontSize(10).font('Helvetica');
        doc.text(
          `Invoice No: ${billing.invoiceNo || billing.billNo}`,
          leftColX + 10,
          currentY + 30,
        );
        doc.text(
          `Bill Date: ${formatDate(billing.billDate)}`,
          leftColX + 10,
          currentY + 45,
        );
        doc.text(
          `Payment: ${(billing.paymentType || 'cash').toUpperCase()}`,
          leftColX + 10,
          currentY + 60,
        );
        doc.text(
          `Status: ${(billing.approvalStatus || billing.status || 'draft').toUpperCase()}`,
          leftColX + 10,
          currentY + 75,
        );

        // Right Column - Customer Details
        doc
          .rect(rightColX, currentY, colWidth, 100)
          .fill('#F9FAFB')
          .stroke('#E5E7EB');

        doc.fillColor('#4F46E5').fontSize(11).font('Helvetica-Bold');
        doc.text('BILL TO', rightColX + 10, currentY + 10);

        doc.fillColor('#374151').fontSize(10).font('Helvetica');
        const customerName = billing.customer
          ? `${billing.customer.firstname || ''} ${billing.customer.lastname || ''}`.trim()
          : 'N/A';
        doc.text(customerName, rightColX + 10, currentY + 30);
        doc.text(
          `Mobile: ${billing.customer?.mobileNo || '-'}`,
          rightColX + 10,
          currentY + 45,
        );
        doc.text(
          `City: ${billing.customer?.city || '-'}`,
          rightColX + 10,
          currentY + 60,
        );
        if (billing.customer?.gstin) {
          doc.text(
            `GSTIN: ${billing.customer.gstin}`,
            rightColX + 10,
            currentY + 75,
          );
        }

        currentY += 115;

        // ═══════════════════════════════════════════════════════════════
        // ITEMS TABLE
        // ═══════════════════════════════════════════════════════════════

        // Table Header
        doc.rect(margin, currentY, contentWidth, 25).fill('#4F46E5');

        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('#', margin + 5, currentY + 8, { width: 20 });
        doc.text('ITEM DESCRIPTION', margin + 25, currentY + 8, { width: 150 });
        doc.text('BATCH/SERIAL', margin + 180, currentY + 8, { width: 80 });
        doc.text('QTY', margin + 265, currentY + 8, {
          width: 40,
          align: 'center',
        });
        doc.text('RATE', margin + 310, currentY + 8, {
          width: 55,
          align: 'right',
        });
        doc.text('TAX', margin + 370, currentY + 8, {
          width: 50,
          align: 'right',
        });
        doc.text('AMOUNT', margin + 425, currentY + 8, {
          width: 70,
          align: 'right',
        });

        currentY += 25;

        // Table Rows
        doc.fillColor('#374151').fontSize(9).font('Helvetica');

        billing.billingItems.forEach((item, index) => {
          const rowHeight = 35;
          const isEven = index % 2 === 0;

          // Alternate row background
          if (isEven) {
            doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F9FAFB');
          }

          const rowY = currentY + 8;

          doc.fillColor('#374151');
          doc.text((index + 1).toString(), margin + 5, rowY, { width: 20 });

          // Item name and unit
          doc
            .font('Helvetica-Bold')
            .text(item.itemName || 'Unknown', margin + 25, rowY, {
              width: 150,
            });
          doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
          doc.text(`Unit: ${item.unit || '-'}`, margin + 25, rowY + 12, {
            width: 150,
          });

          // Batch/Serial info
          doc.fontSize(8).fillColor('#6B7280');
          const batchInfo = item.batchNumber ? `B: ${item.batchNumber}` : '';
          const serialInfo = item.serialNumber ? `S: ${item.serialNumber}` : '';
          doc.text(batchInfo || serialInfo || '-', margin + 180, rowY + 4, {
            width: 80,
          });

          // Quantity
          doc.fontSize(9).fillColor('#374151');
          doc.text(item.quantity?.toString() || '0', margin + 265, rowY + 4, {
            width: 40,
            align: 'center',
          });

          // Rate
          doc.text(formatCurrency(item.rate), margin + 310, rowY + 4, {
            width: 55,
            align: 'right',
          });

          // Tax (CGST + SGST or IGST)
          const taxAmount =
            parseFloat(item.cgst?.toString() || '0') +
            parseFloat(item.sgst?.toString() || '0') +
            parseFloat(item.igst?.toString() || '0');
          doc.text(formatCurrency(taxAmount), margin + 370, rowY + 4, {
            width: 50,
            align: 'right',
          });

          // Total Amount
          doc.font('Helvetica-Bold').fillColor('#1F2937');
          doc.text(formatCurrency(item.totalAmount), margin + 425, rowY + 4, {
            width: 70,
            align: 'right',
          });

          currentY += rowHeight;

          // Check for page break
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
          }
        });

        // Table bottom border
        drawLine(currentY, '#4F46E5');
        currentY += 15;

        // ═══════════════════════════════════════════════════════════════
        // SUMMARY SECTION
        // ═══════════════════════════════════════════════════════════════

        const summaryX = pageWidth - margin - 200;
        const summaryWidth = 200;

        // Summary Box
        doc
          .rect(summaryX, currentY, summaryWidth, 140)
          .fill('#F9FAFB')
          .stroke('#E5E7EB');

        let summaryY = currentY + 10;
        const labelX = summaryX + 10;
        const valueX = summaryX + summaryWidth - 10;

        doc.fontSize(9).font('Helvetica').fillColor('#6B7280');

        // Subtotal
        doc.text('Subtotal:', labelX, summaryY);
        doc.text(formatCurrency(billing.subtotal), valueX - 80, summaryY, {
          width: 80,
          align: 'right',
        });
        summaryY += 18;

        // Discount
        if (parseFloat(billing.overallDiscount?.toString() || '0') > 0) {
          const subtotalNum = parseFloat(billing.subtotal?.toString() || '0');
          const discountValue = parseFloat(
            billing.overallDiscount?.toString() || '0',
          );

          // Calculate actual discount amount based on type
          let actualDiscountAmount: number;
          let discountLabel: string;

          if (billing.overallDiscountType === 'percentage') {
            actualDiscountAmount = (subtotalNum * discountValue) / 100;
            discountLabel = `Discount (${discountValue}%):`;
          } else {
            actualDiscountAmount = discountValue;
            discountLabel = 'Discount:';
          }

          doc.text(discountLabel, labelX, summaryY);
          doc
            .fillColor('#DC2626')
            .text(
              `-${formatCurrency(actualDiscountAmount)}`,
              valueX - 80,
              summaryY,
              { width: 80, align: 'right' },
            );
          doc.fillColor('#6B7280');
          summaryY += 18;
        }

        // CGST
        if (parseFloat(billing.cgstTotal?.toString() || '0') > 0) {
          doc.text('CGST:', labelX, summaryY);
          doc.text(formatCurrency(billing.cgstTotal), valueX - 80, summaryY, {
            width: 80,
            align: 'right',
          });
          summaryY += 18;
        }

        // SGST
        if (parseFloat(billing.sgstTotal?.toString() || '0') > 0) {
          doc.text('SGST:', labelX, summaryY);
          doc.text(formatCurrency(billing.sgstTotal), valueX - 80, summaryY, {
            width: 80,
            align: 'right',
          });
          summaryY += 18;
        }

        // IGST
        if (parseFloat(billing.igstTotal?.toString() || '0') > 0) {
          doc.text('IGST:', labelX, summaryY);
          doc.text(formatCurrency(billing.igstTotal), valueX - 80, summaryY, {
            width: 80,
            align: 'right',
          });
          summaryY += 18;
        }

        // Round Off
        if (parseFloat(billing.roundOff?.toString() || '0') !== 0) {
          doc.text('Round Off:', labelX, summaryY);
          doc.text(formatCurrency(billing.roundOff), valueX - 80, summaryY, {
            width: 80,
            align: 'right',
          });
          summaryY += 18;
        }

        // Divider
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .moveTo(summaryX + 10, summaryY)
          .lineTo(summaryX + summaryWidth - 10, summaryY)
          .stroke();
        summaryY += 10;

        // Grand Total
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#4F46E5');
        doc.text('TOTAL:', labelX, summaryY);
        doc.text(formatCurrency(billing.finalAmount), valueX - 80, summaryY, {
          width: 80,
          align: 'right',
        });

        currentY += 155;

        // ═══════════════════════════════════════════════════════════════
        // NOTES SECTION (if any)
        // ═══════════════════════════════════════════════════════════════

        if (billing.notes) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
          doc.text('Notes:', margin, currentY);
          doc.font('Helvetica').fontSize(9).fillColor('#6B7280');
          doc.text(billing.notes, margin, currentY + 15, {
            width: contentWidth,
          });
          currentY += 40;
        }

        // ═══════════════════════════════════════════════════════════════
        // FOOTER
        // ═══════════════════════════════════════════════════════════════

        const footerY = 780;
        drawLine(footerY - 10, '#E5E7EB');

        doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF');
        doc.text(
          'This is a computer-generated invoice. No signature required.',
          margin,
          footerY,
          { align: 'center', width: contentWidth },
        );
        doc.text(
          `Generated on: ${new Date().toLocaleString('en-IN')}`,
          margin,
          footerY + 12,
          { align: 'center', width: contentWidth },
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async findCustomersByBatchSerial(
    batchOrSerialNo: string,
    distributorId: number,
  ) {
    try {
      // Use raw query to find customers who purchased items with this batch/serial
      const query = `
        SELECT DISTINCT c.* FROM customers c
        INNER JOIN billings b ON c.id = b.customerId
        INNER JOIN billing_batch_details bbd ON b.id = bbd.billingId
        WHERE b.distributorId = ? 
        AND (LOWER(bbd.batchNumber) LIKE LOWER(?) OR LOWER(bbd.serialNumber) LIKE LOWER(?))
      `;

      const customers = await this.billingRepository.query(query, [
        distributorId,
        `%${batchOrSerialNo}%`,
        `%${batchOrSerialNo}%`,
      ]);

      return customers;
    } catch (error) {
      console.error('Error finding customers by batch/serial:', error);
      throw new BadRequestException(
        `Failed to search customers: ${error.message}`,
      );
    }
  }

  async findItemsByBatchSerial(batchOrSerialNo: string, distributorId: number) {
    try {
      // ═══════════════════════════════════════════════════════════════
      // ENTERPRISE INVENTORY: Search using inventory_lot, inventory_serial, and inventory_transaction
      // This replaces the legacy query that used distributor_inventory, batch_details, serial_details
      // Stock is now calculated from transactions (IN - OUT - RESERVE + RELEASE)
      // ═══════════════════════════════════════════════════════════════

      // Get the default warehouse for this distributor
      const warehouse =
        await this.inventoryCoreService.getOrCreateDefaultWarehouse(
          distributorId,
        );

      // Query 1: Search by item name - get items with stock from transactions
      const itemsByNameQuery = `
        SELECT DISTINCT
          im.id,
          im.name,
          im.rate,
          im.unit,
          im.gstRate,
          im.hasBatchTracking,
          im.hasSerialTracking,
          im.hasExpiryDate,
          im.hasBoxPackaging,
          im.unitsPerBox,
          im.boxRate
        FROM item_master im
        INNER JOIN inventory_transaction it ON im.id = it.itemId
        WHERE it.distributorId = ?
        AND it.status = 'COMPLETED'
        AND LOWER(im.name) LIKE LOWER(?)
        GROUP BY im.id
        HAVING SUM(CASE 
          WHEN it.movementType = 'IN' THEN it.quantity
          WHEN it.movementType = 'OUT' THEN -it.quantity
          WHEN it.movementType = 'RESERVE' THEN -it.quantity
          WHEN it.movementType = 'RELEASE' THEN it.quantity
          ELSE 0 
        END) > 0
      `;

      // Query 2: Search by batch number in inventory_lot
      const batchQuery = `
        SELECT 
          im.id,
          im.name,
          im.rate,
          im.unit,
          im.gstRate,
          im.hasBatchTracking,
          im.hasSerialTracking,
          im.hasExpiryDate,
          im.hasBoxPackaging,
          im.unitsPerBox,
          im.boxRate,
          il.id as lotId,
          il.lotNumber as batchNumber,
          NULL as serialNumber,
          NULL as linkedBatchNumber,
          il.expiryDate,
          'batch' as recordType,
          NULL as serialStatus,
          (
            SELECT COALESCE(SUM(CASE 
              WHEN t.movementType = 'IN' THEN t.quantity
              WHEN t.movementType = 'OUT' THEN -t.quantity
              WHEN t.movementType = 'RESERVE' THEN -t.quantity
              WHEN t.movementType = 'RELEASE' THEN t.quantity
              ELSE 0 
            END), 0)
            FROM inventory_transaction t
            WHERE t.lotId = il.id
            AND t.distributorId = ?
            AND t.status = 'COMPLETED'
          ) as batchQuantity
        FROM item_master im
        INNER JOIN inventory_lot il ON im.id = il.itemId
        WHERE il.distributorId = ?
        AND LOWER(il.lotNumber) LIKE LOWER(?)
        AND il.status = 'ACTIVE'
        HAVING batchQuantity > 0
      `;

      // Query 3: Search by serial number in inventory_serial
      const serialQuery = `
        SELECT 
          im.id,
          im.name,
          im.rate,
          im.unit,
          im.gstRate,
          im.hasBatchTracking,
          im.hasSerialTracking,
          im.hasExpiryDate,
          im.hasBoxPackaging,
          im.unitsPerBox,
          im.boxRate,
          ils.lotId,
          il.lotNumber as linkedBatchNumber,
          ils.serialNumber,
          il.expiryDate,
          'serial' as recordType,
          ils.status as serialStatus,
          1 as batchQuantity
        FROM item_master im
        INNER JOIN inventory_serial ils ON im.id = ils.itemId
        LEFT JOIN inventory_lot il ON ils.lotId = il.id
        WHERE ils.distributorId = ?
        AND LOWER(ils.serialNumber) LIKE LOWER(?)
        AND ils.status = 'AVAILABLE'
      `;

      // Execute all queries
      const [itemsByName, batchResults, serialResults] = await Promise.all([
        this.billingRepository.query(itemsByNameQuery, [
          distributorId,
          `%${batchOrSerialNo}%`,
        ]),
        this.billingRepository.query(batchQuery, [
          distributorId,
          distributorId,
          `%${batchOrSerialNo}%`,
        ]),
        this.billingRepository.query(serialQuery, [
          distributorId,
          `%${batchOrSerialNo}%`,
        ]),
      ]);

      // Group results by item ID with batches array
      const itemsMap = new Map();
      const now = new Date();

      // Helper function to calculate expiry status
      const getExpiryStatus = (expiryDate: string | null) => {
        if (!expiryDate) return 'not_tracked';
        const expiry = new Date(expiryDate);
        const daysToExpiry = Math.floor(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysToExpiry < 0) return 'expired';
        if (daysToExpiry <= 30) return 'expiring_soon';
        return 'valid';
      };

      // Helper function to add item to map
      const addItemToMap = (row: any) => {
        if (!itemsMap.has(row.id)) {
          itemsMap.set(row.id, {
            id: row.id,
            name: row.name,
            rate: row.rate,
            unit: row.unit,
            gstRate: row.gstRate || 0,
            hasBatchTracking: row.hasBatchTracking,
            hasSerialTracking: row.hasSerialTracking,
            hasExpiryDate: row.hasExpiryDate,
            hasBoxPackaging: row.hasBoxPackaging,
            unitsPerBox: row.unitsPerBox,
            boxRate: row.boxRate,
            batches: [],
          });
        }
        return itemsMap.get(row.id);
      };

      // Process items found by name - need to get their batches/serials
      for (const row of itemsByName) {
        const item = addItemToMap(row);

        // Get available lots for this item
        if (row.hasBatchTracking) {
          const lots = await this.inventoryCoreService.getAvailableLots(
            row.id,
            warehouse.id,
            distributorId,
            'FEFO',
          );

          for (const lot of lots) {
            if (lot.availableQuantity > 0) {
              item.batches.push({
                inventoryId: distributorId * 1000000 + row.id,
                lotId: lot.lotId,
                batchNumber: lot.lotNumber,
                serialNumber: null,
                linkedBatchNumber: null,
                expiryDate: lot.expiryDate,
                quantity: lot.availableQuantity,
                expiryStatus: getExpiryStatus(lot.expiryDate),
                recordType: 'batch',
                serialStatus: null,
              });
            }
          }
        }

        // Get available serials for this item
        if (row.hasSerialTracking) {
          const serials = await this.inventoryCoreService.getSerialDetailsView(
            row.id,
            distributorId,
          );

          for (const serial of serials) {
            if (serial.status === 'AVAILABLE') {
              item.batches.push({
                inventoryId: distributorId * 1000000 + row.id,
                lotId: serial.batchDetailId, // batchDetailId is the lotId in SerialDetailsView
                batchNumber: null,
                serialNumber: serial.serialNumber,
                linkedBatchNumber: serial.batchNumber,
                expiryDate: serial.expiryDate,
                quantity: 1,
                expiryStatus: getExpiryStatus(serial.expiryDate),
                recordType: 'serial',
                serialStatus: serial.status,
              });
            }
          }
        }

        // If no batch/serial tracking, add a default entry with total quantity
        if (!row.hasBatchTracking && !row.hasSerialTracking) {
          const availableQty =
            await this.inventoryCoreService.getAvailableQuantity(
              row.id,
              warehouse.id,
              distributorId,
            );

          if (availableQty > 0) {
            item.batches.push({
              inventoryId: distributorId * 1000000 + row.id,
              lotId: null,
              batchNumber: null,
              serialNumber: null,
              linkedBatchNumber: null,
              expiryDate: null,
              quantity: availableQty,
              expiryStatus: 'not_tracked',
              recordType: 'stock',
              serialStatus: null,
            });
          }
        }
      }

      // Process batch results
      for (const row of batchResults) {
        const item = addItemToMap(row);
        const expiryStatus = getExpiryStatus(row.expiryDate);

        // Skip expired batches
        if (expiryStatus === 'expired') continue;

        item.batches.push({
          inventoryId: distributorId * 1000000 + row.id,
          lotId: row.lotId,
          batchNumber: row.batchNumber,
          serialNumber: null,
          linkedBatchNumber: null,
          expiryDate: row.expiryDate,
          quantity: Number(row.batchQuantity) || 0,
          expiryStatus,
          recordType: 'batch',
          serialStatus: null,
        });
      }

      // Process serial results
      for (const row of serialResults) {
        const item = addItemToMap(row);

        item.batches.push({
          inventoryId: distributorId * 1000000 + row.id,
          lotId: row.lotId,
          batchNumber: null,
          serialNumber: row.serialNumber,
          linkedBatchNumber: row.linkedBatchNumber,
          expiryDate: row.expiryDate,
          quantity: 1,
          expiryStatus: getExpiryStatus(row.expiryDate),
          recordType: 'serial',
          serialStatus: row.serialStatus,
        });
      }

      // Remove duplicates from batches array
      for (const item of itemsMap.values()) {
        const seen = new Set();
        item.batches = item.batches.filter((batch: any) => {
          const key =
            batch.recordType === 'serial'
              ? `serial-${batch.serialNumber}`
              : batch.recordType === 'batch'
                ? `batch-${batch.batchNumber}`
                : `stock-${batch.inventoryId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort batches by expiry date (FEFO)
        item.batches.sort((a: any, b: any) => {
          if (!a.expiryDate && !b.expiryDate) return 0;
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return (
            new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
          );
        });
      }

      // Filter out items with no available batches
      const result = Array.from(itemsMap.values()).filter(
        (item: any) => item.batches.length > 0,
      );

      return result;
    } catch (error) {
      console.error('Error finding items by batch/serial:', error);
      throw new BadRequestException(`Failed to search items: ${error.message}`);
    }
  }
}
