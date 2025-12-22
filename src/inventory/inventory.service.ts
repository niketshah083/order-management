import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  BulkBatchUploadDto,
  BulkSerialUploadDto,
} from './dto/bulk-batch-upload.dto';
import { ItemEntity } from 'src/items/entities/item.entity';
import { InventoryCoreService, InventoryView } from './inventory-core.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(ItemEntity)
    private itemRepository: Repository<ItemEntity>,
    @Inject(forwardRef(() => InventoryCoreService))
    private inventoryCoreService: InventoryCoreService,
  ) {}

  async create(distributorId: number, createInventoryDto: CreateInventoryDto) {
    // ═══════════════════════════════════════════════════════════════
    // ENTERPRISE INVENTORY: Create transactions instead of legacy records
    // Stock is calculated from transactions (IN - OUT - RESERVE + RELEASE)
    // ═══════════════════════════════════════════════════════════════

    const itemId = createInventoryDto.itemId;

    // Get or create default warehouse for the distributor
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    // Handle batch details
    if (
      createInventoryDto.batchDetails &&
      createInventoryDto.batchDetails.length > 0
    ) {
      for (const batch of createInventoryDto.batchDetails) {
        // Create lot first
        const lot = await this.inventoryCoreService.createLot({
          lotNumber: batch.batchNumber,
          itemId,
          expiryDate: batch.expiryDate,
          receivedDate: new Date().toISOString().split('T')[0],
          distributorId,
          warehouseId: warehouse.id,
          createdBy: distributorId,
        });

        // Create transaction with lotId
        await this.inventoryCoreService.createTransaction({
          transactionType: 'ADJUSTMENT_IN',
          movementType: 'IN',
          itemId,
          lotId: lot.id,
          warehouseId: warehouse.id,
          distributorId,
          quantity: batch.quantity,
          remarks: createInventoryDto.notes || 'Manual inventory addition',
          createdBy: distributorId,
        });
      }
    }
    // Handle serial details
    else if (
      createInventoryDto.serialDetails &&
      createInventoryDto.serialDetails.length > 0
    ) {
      for (const serial of createInventoryDto.serialDetails) {
        // Create serial first
        const serialRecord = await this.inventoryCoreService.createSerial({
          serialNumber: serial.serialNumber,
          itemId,
          currentWarehouseId: warehouse.id,
          currentOwnerType: 'DISTRIBUTOR',
          currentOwnerId: distributorId,
          receivedDate: new Date().toISOString().split('T')[0],
          distributorId,
          createdBy: distributorId,
        });

        // Create transaction with serialId
        await this.inventoryCoreService.createTransaction({
          transactionType: 'ADJUSTMENT_IN',
          movementType: 'IN',
          itemId,
          serialId: serialRecord.id,
          warehouseId: warehouse.id,
          distributorId,
          quantity: serial.quantity || 1,
          remarks: createInventoryDto.notes || 'Manual inventory addition',
          createdBy: distributorId,
        });
      }
    }
    // Handle single batch (backward compatibility)
    else if (createInventoryDto.batchNumber) {
      // Create lot first
      const lot = await this.inventoryCoreService.createLot({
        lotNumber: createInventoryDto.batchNumber,
        itemId,
        expiryDate: createInventoryDto.expiryDate,
        receivedDate: new Date().toISOString().split('T')[0],
        distributorId,
        warehouseId: warehouse.id,
        createdBy: distributorId,
      });

      await this.inventoryCoreService.createTransaction({
        transactionType: 'ADJUSTMENT_IN',
        movementType: 'IN',
        itemId,
        lotId: lot.id,
        warehouseId: warehouse.id,
        distributorId,
        quantity: createInventoryDto.quantity,
        remarks: createInventoryDto.notes || 'Manual inventory addition',
        createdBy: distributorId,
      });
    }
    // Handle single serial (backward compatibility)
    else if (createInventoryDto.serialNumber) {
      // Create serial first
      const serialRecord = await this.inventoryCoreService.createSerial({
        serialNumber: createInventoryDto.serialNumber,
        itemId,
        currentWarehouseId: warehouse.id,
        currentOwnerType: 'DISTRIBUTOR',
        currentOwnerId: distributorId,
        receivedDate: new Date().toISOString().split('T')[0],
        distributorId,
        createdBy: distributorId,
      });

      await this.inventoryCoreService.createTransaction({
        transactionType: 'ADJUSTMENT_IN',
        movementType: 'IN',
        itemId,
        serialId: serialRecord.id,
        warehouseId: warehouse.id,
        distributorId,
        quantity: 1,
        remarks: createInventoryDto.notes || 'Manual inventory addition',
        createdBy: distributorId,
      });
    }
    // Handle simple quantity (no batch/serial) - create default lot
    else {
      const defaultLotNumber = `ADJ-${distributorId}-${itemId}-${Date.now()}`;
      const lot = await this.inventoryCoreService.createLot({
        lotNumber: defaultLotNumber,
        itemId,
        receivedDate: new Date().toISOString().split('T')[0],
        distributorId,
        warehouseId: warehouse.id,
        createdBy: distributorId,
      });

      await this.inventoryCoreService.createTransaction({
        transactionType: 'ADJUSTMENT_IN',
        movementType: 'IN',
        itemId,
        lotId: lot.id,
        warehouseId: warehouse.id,
        distributorId,
        quantity: createInventoryDto.quantity,
        remarks: createInventoryDto.notes || 'Manual inventory addition',
        createdBy: distributorId,
      });
    }

    // Return the updated inventory view (enterprise format)
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);
    const inventoryView = inventoryViews.find((inv) => inv.itemId === itemId);

    return inventoryView || { itemId, quantity: createInventoryDto.quantity };
  }

  /**
   * Get all inventory for a distributor
   * Refactored to use InventoryCoreService.getInventoryView for transaction-based calculation
   *
   * @param distributorId - The distributor ID to filter by
   * @param search - Optional search string to filter by item name
   * @returns Array of InventoryView objects with calculated quantities
   *
   * _Requirements: 1.1, 8.1, 12.5_
   */
  async findAllByDistributor(
    distributorId: number,
    search?: string,
  ): Promise<InventoryView[]> {
    // Delegate to InventoryCoreService for transaction-based inventory calculation
    // This ensures stock balance is calculated from the sum of completed inventory transactions
    // (IN movements minus OUT movements minus RESERVE movements plus RELEASE movements)
    return await this.inventoryCoreService.getInventoryView(
      distributorId,
      search,
    );
  }

  // ENTERPRISE INVENTORY: Get inventory view by ID
  async findOne(id: number, distributorId: number) {
    // ID format: distributorId * 1000000 + itemId
    const itemId = id % 1000000;

    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);
    const inventory = inventoryViews.find((inv) => inv.itemId === itemId);

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return inventory;
  }

  // ENTERPRISE INVENTORY: Update is handled via adjustQuantity for quantity changes
  async update(
    id: number,
    distributorId: number,
    updateInventoryDto: UpdateInventoryDto,
  ) {
    // ID format: distributorId * 1000000 + itemId
    const itemId = id % 1000000;

    // For quantity updates, use adjustQuantity which creates proper transactions
    if (updateInventoryDto.quantity !== undefined) {
      const currentInventory = await this.findOne(id, distributorId);
      const currentQty = currentInventory.quantity || 0;
      const newQty = updateInventoryDto.quantity;
      const quantityChange = newQty - currentQty;

      if (quantityChange !== 0) {
        return await this.adjustQuantity(id, distributorId, quantityChange);
      }
    }

    // Return current inventory view
    return await this.findOne(id, distributorId);
  }

  // ENTERPRISE INVENTORY: Remove creates an OUT transaction to zero out stock
  async remove(id: number, distributorId: number) {
    const inventory = await this.findOne(id, distributorId);

    if (inventory.quantity > 0) {
      // Create OUT transaction to remove all stock
      await this.adjustQuantity(id, distributorId, -inventory.quantity);
    }

    return { message: 'Inventory item removed successfully' };
  }

  /**
   * Adjust inventory quantity by creating an inventory transaction
   * Refactored to use transaction-based inventory tracking instead of direct quantity updates
   *
   * @param id - The inventory ID (legacy format: distributorId * 1000000 + itemId)
   * @param distributorId - The distributor ID
   * @param quantityChange - Positive for increase, negative for decrease
   * @returns Updated inventory view
   *
   * _Requirements: 8.4, 13.1_
   */
  async adjustQuantity(
    id: number,
    distributorId: number,
    quantityChange: number,
  ): Promise<InventoryView> {
    // Extract itemId from the legacy inventory ID format
    // Legacy ID format: distributorId * 1000000 + itemId
    const itemId = id % 1000000;

    // Get or create default warehouse for the distributor
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    // Determine transaction type and movement type based on quantityChange sign
    const isIncrease = quantityChange > 0;
    const transactionType = isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const movementType = isIncrease ? 'IN' : 'OUT';
    const absoluteQuantity = Math.abs(quantityChange);

    // For OUT movements, validate that we have sufficient stock
    if (!isIncrease) {
      const availableQuantity =
        await this.inventoryCoreService.getAvailableQuantity(
          itemId,
          warehouse.id,
          distributorId,
        );

      if (availableQuantity < absoluteQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${availableQuantity}, Required: ${absoluteQuantity}`,
        );
      }
    }

    // Create the adjustment transaction
    await this.inventoryCoreService.createTransaction({
      transactionType,
      movementType,
      itemId,
      quantity: absoluteQuantity,
      warehouseId: warehouse.id,
      distributorId,
      referenceType: 'ADJUSTMENT',
      remarks: `Manual quantity adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange}`,
      createdBy: distributorId, // Using distributorId as createdBy for now
    });

    // Return the updated inventory view
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);

    // Find the specific item's inventory view
    const updatedInventory = inventoryViews.find(
      (inv) => inv.itemId === itemId,
    );

    if (!updatedInventory) {
      // If no inventory view found (shouldn't happen after adjustment), create a minimal response
      return {
        id,
        distributorId,
        itemId,
        quantity: isIncrease ? absoluteQuantity : 0,
        reorderLevel: 10,
        status: isIncrease ? 'in_stock' : 'out_of_stock',
        item: {
          id: itemId,
          name: 'Unknown Item',
        },
      };
    }

    return updatedInventory;
  }

  // ENTERPRISE INVENTORY: Find by distributor and item using inventory view
  async findByDistributorAndItem(distributorId: number, itemId: number) {
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);
    return inventoryViews.find((inv) => inv.itemId === itemId) || null;
  }

  // Batch Management Methods
  // ENTERPRISE INVENTORY: Create transactions for batch additions
  async bulkCreateBatches(
    inventoryId: number,
    distributorId: number,
    bulkBatchUploadDto: BulkBatchUploadDto,
  ) {
    // Extract itemId from the legacy inventory ID format
    const itemId = inventoryId % 1000000;

    // Get or create default warehouse
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    const results = [];

    // Create lot and transaction for each batch
    for (const batch of bulkBatchUploadDto.batches) {
      // Create lot first
      const lot = await this.inventoryCoreService.createLot({
        lotNumber: batch.batchNumber,
        itemId,
        expiryDate: batch.expiryDate,
        receivedDate: new Date().toISOString().split('T')[0],
        distributorId,
        warehouseId: warehouse.id,
        createdBy: distributorId,
      });

      await this.inventoryCoreService.createTransaction({
        transactionType: 'ADJUSTMENT_IN',
        movementType: 'IN',
        itemId,
        lotId: lot.id,
        warehouseId: warehouse.id,
        distributorId,
        quantity: batch.quantity,
        remarks: 'Bulk batch upload',
        createdBy: distributorId,
      });

      results.push({
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate,
      });
    }

    return results;
  }

  /**
   * Get batch details for an inventory item
   * Refactored to use InventoryCoreService.getBatchDetailsView for enterprise inventory
   *
   * @param inventoryId - The inventory ID (legacy format: distributorId * 1000000 + itemId)
   * @param distributorId - The distributor ID
   * @returns Array of batch details from inventory_lot table
   *
   * _Requirements: 8.2_
   */
  async getBatchDetails(inventoryId: number, distributorId: number) {
    // Extract itemId from the legacy inventory ID format
    // Legacy ID format: distributorId * 1000000 + itemId
    const itemId = inventoryId % 1000000;

    // Delegate to InventoryCoreService for enterprise inventory batch details
    return await this.inventoryCoreService.getBatchDetailsView(
      itemId,
      distributorId,
    );
  }

  // ENTERPRISE INVENTORY: Create transactions for serial additions
  async bulkCreateSerials(
    inventoryId: number,
    distributorId: number,
    bulkSerialUploadDto: BulkSerialUploadDto,
  ) {
    // Extract itemId from the legacy inventory ID format
    const itemId = inventoryId % 1000000;

    // Get or create default warehouse
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    const results = [];

    // Create serial and transaction for each serial number
    for (const serial of bulkSerialUploadDto.serials) {
      // Create serial first
      const serialRecord = await this.inventoryCoreService.createSerial({
        serialNumber: serial.serialNumber,
        itemId,
        currentWarehouseId: warehouse.id,
        currentOwnerType: 'DISTRIBUTOR',
        currentOwnerId: distributorId,
        receivedDate: new Date().toISOString().split('T')[0],
        distributorId,
        createdBy: distributorId,
      });

      await this.inventoryCoreService.createTransaction({
        transactionType: 'ADJUSTMENT_IN',
        movementType: 'IN',
        itemId,
        serialId: serialRecord.id,
        warehouseId: warehouse.id,
        distributorId,
        quantity: 1,
        remarks: 'Bulk serial upload',
        createdBy: distributorId,
      });

      results.push({
        serialNumber: serial.serialNumber,
        expiryDate: serial.expiryDate,
      });
    }

    return results;
  }

  /**
   * Get serial details for an inventory item
   * Refactored to use InventoryCoreService.getSerialDetailsView for enterprise inventory
   *
   * @param inventoryId - The inventory ID (legacy format: distributorId * 1000000 + itemId)
   * @param distributorId - The distributor ID
   * @returns Array of serial details from inventory_serial table
   *
   * _Requirements: 8.3_
   */
  async getSerialDetails(inventoryId: number, distributorId: number) {
    // Extract itemId from the legacy inventory ID format
    // Legacy ID format: distributorId * 1000000 + itemId
    const itemId = inventoryId % 1000000;

    // Delegate to InventoryCoreService for enterprise inventory serial details
    return await this.inventoryCoreService.getSerialDetailsView(
      itemId,
      distributorId,
    );
  }

  // ENTERPRISE INVENTORY: Create transactions for Excel batch uploads
  async bulkUploadBatchExcel(
    inventoryId: number,
    distributorId: number,
    file: Express.Multer.File,
  ) {
    try {
      // Extract itemId from the legacy inventory ID format
      const itemId = inventoryId % 1000000;

      // Get or create default warehouse
      const warehouse =
        await this.inventoryCoreService.getOrCreateDefaultWarehouse(
          distributorId,
        );

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          const batchNumber = row['Batch Number']?.toString().trim();
          const quantity = Number(row['Quantity']) || 0;
          const expiryDate = row['Expiry Date']?.trim() || null;

          if (!batchNumber || quantity <= 0) {
            results.failed++;
            results.errors.push(
              `Row ${i + 2}: Batch Number and Quantity are required`,
            );
            continue;
          }

          // Create lot first
          const lot = await this.inventoryCoreService.createLot({
            lotNumber: batchNumber,
            itemId,
            expiryDate,
            receivedDate: new Date().toISOString().split('T')[0],
            distributorId,
            warehouseId: warehouse.id,
            createdBy: distributorId,
          });

          await this.inventoryCoreService.createTransaction({
            transactionType: 'ADJUSTMENT_IN',
            movementType: 'IN',
            itemId,
            lotId: lot.id,
            warehouseId: warehouse.id,
            distributorId,
            quantity,
            remarks: 'Excel batch upload',
            createdBy: distributorId,
          });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      throw new BadRequestException(`Excel upload failed: ${error.message}`);
    }
  }

  // ENTERPRISE INVENTORY: Create transactions for Excel serial uploads
  async bulkUploadSerialExcel(
    inventoryId: number,
    distributorId: number,
    file: Express.Multer.File,
  ) {
    try {
      // Extract itemId from the legacy inventory ID format
      const itemId = inventoryId % 1000000;

      // Get or create default warehouse
      const warehouse =
        await this.inventoryCoreService.getOrCreateDefaultWarehouse(
          distributorId,
        );

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          const serialNumber = row['Serial Number']?.toString().trim();
          const expiryDate = row['Expiry Date']?.trim() || null;

          if (!serialNumber) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Serial Number is required`);
            continue;
          }

          // Create serial first
          const serialRecord = await this.inventoryCoreService.createSerial({
            serialNumber,
            itemId,
            currentWarehouseId: warehouse.id,
            currentOwnerType: 'DISTRIBUTOR',
            currentOwnerId: distributorId,
            receivedDate: new Date().toISOString().split('T')[0],
            distributorId,
            createdBy: distributorId,
          });

          await this.inventoryCoreService.createTransaction({
            transactionType: 'ADJUSTMENT_IN',
            movementType: 'IN',
            itemId,
            serialId: serialRecord.id,
            warehouseId: warehouse.id,
            distributorId,
            quantity: 1,
            remarks: 'Excel serial upload',
            createdBy: distributorId,
          });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      throw new BadRequestException(`Excel upload failed: ${error.message}`);
    }
  }

  /**
   * Get low stock items for a distributor
   * Refactored to use transaction-based quantity calculation instead of stored status field
   *
   * @param distributorId - The distributor ID to filter by
   * @returns Array of InventoryView objects where available quantity <= reorder level
   *
   * _Requirements: 11.1, 11.3_
   */
  async getLowStockItems(distributorId: number): Promise<InventoryView[]> {
    // Get all inventory items with transaction-based quantity calculation
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);

    // Filter items where quantity <= reorderLevel (low_stock status)
    // This includes both low_stock and out_of_stock items
    const lowStockItems = inventoryViews.filter(
      (inv) => inv.quantity <= inv.reorderLevel,
    );

    // Sort by quantity ascending (lowest stock first)
    return lowStockItems.sort((a, b) => a.quantity - b.quantity);
  }

  /**
   * Get out of stock items for a distributor
   * Refactored to use transaction-based quantity calculation instead of stored status field
   *
   * @param distributorId - The distributor ID to filter by
   * @returns Array of InventoryView objects where available quantity equals zero
   *
   * _Requirements: 11.2, 11.3_
   */
  async getOutOfStockItems(distributorId: number): Promise<InventoryView[]> {
    // Get all inventory items with transaction-based quantity calculation
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);

    // Filter items where quantity equals zero (out_of_stock status)
    const outOfStockItems = inventoryViews.filter((inv) => inv.quantity === 0);

    // Sort by item name for consistent ordering
    return outOfStockItems.sort((a, b) =>
      (a.item?.name || '').localeCompare(b.item?.name || ''),
    );
  }

  private getStatus(
    quantity: number,
    reorderLevel: number,
  ): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (quantity === 0) return 'out_of_stock';
    if (quantity <= reorderLevel) return 'low_stock';
    return 'in_stock';
  }

  async generateSampleInventoryExcel(): Promise<Buffer> {
    // Fetch all items from Item Master
    const items = await this.itemRepository.find({ take: 100 });

    if (!items || items.length === 0) {
      throw new BadRequestException('No items found in Item Master');
    }

    // Create Excel workbook and worksheet
    const ws_data = [
      [
        'Item ID',
        'Item Name',
        'Unit',
        'Rate (₹)',
        'Quantity',
        'Reorder Level',
        'Batch Number',
        'Serial Number',
        'Expiry Date',
        'Notes',
      ],
      ...items.map((item) => [
        item.id,
        item.name,
        item.unit || '',
        item.rate || 0,
        0,
        10,
        '',
        '',
        '',
        '',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    // Set column widths
    ws['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  }

  // ENTERPRISE INVENTORY: Create transactions for bulk inventory imports
  async bulkImportInventory(
    distributorId: number,
    file: Express.Multer.File,
  ): Promise<any> {
    try {
      // Get or create default warehouse
      const warehouse =
        await this.inventoryCoreService.getOrCreateDefaultWarehouse(
          distributorId,
        );

      // Read Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
        items: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const lineNo = i + 2; // Line number in Excel (accounting for header)

        try {
          const itemId = Number(row['Item ID']);
          const quantity = Number(row['Quantity']) || 0;
          const batchNumber = row['Batch Number']?.trim() || undefined;
          const serialNumber = row['Serial Number']?.trim() || undefined;
          const expiryDate = row['Expiry Date']?.trim() || undefined;
          const notes = row['Notes']?.trim() || undefined;

          if (!itemId) {
            results.failed++;
            results.errors.push(`Line ${lineNo}: Item ID is required`);
            continue;
          }

          if (quantity <= 0) {
            results.failed++;
            results.errors.push(
              `Line ${lineNo}: Quantity must be greater than 0`,
            );
            continue;
          }

          // Check if item exists
          const item = await this.itemRepository.findOne({
            where: { id: itemId },
          });
          if (!item) {
            results.failed++;
            results.errors.push(
              `Line ${lineNo}: Item ID ${itemId} not found in Item Master`,
            );
            continue;
          }

          // Create enterprise inventory transaction
          let lotId: number | undefined;
          let serialId: number | undefined;

          // Create lot if batch number provided
          if (batchNumber) {
            const lot = await this.inventoryCoreService.createLot({
              lotNumber: batchNumber,
              itemId,
              expiryDate,
              receivedDate: new Date().toISOString().split('T')[0],
              distributorId,
              warehouseId: warehouse.id,
              createdBy: distributorId,
            });
            lotId = lot.id;
          }

          // Create serial if serial number provided
          if (serialNumber) {
            const serial = await this.inventoryCoreService.createSerial({
              serialNumber,
              itemId,
              lotId,
              currentWarehouseId: warehouse.id,
              currentOwnerType: 'DISTRIBUTOR',
              currentOwnerId: distributorId,
              receivedDate: new Date().toISOString().split('T')[0],
              distributorId,
              createdBy: distributorId,
            });
            serialId = serial.id;
          }

          // If no batch or serial, create default lot
          if (!lotId && !serialId) {
            const defaultLotNumber = `IMPORT-${distributorId}-${itemId}-${Date.now()}`;
            const lot = await this.inventoryCoreService.createLot({
              lotNumber: defaultLotNumber,
              itemId,
              receivedDate: new Date().toISOString().split('T')[0],
              distributorId,
              warehouseId: warehouse.id,
              createdBy: distributorId,
            });
            lotId = lot.id;
          }

          await this.inventoryCoreService.createTransaction({
            transactionType: 'ADJUSTMENT_IN',
            movementType: 'IN',
            itemId,
            lotId,
            serialId,
            warehouseId: warehouse.id,
            distributorId,
            quantity: serialNumber ? 1 : quantity,
            remarks: notes || 'Bulk inventory import',
            createdBy: distributorId,
          });

          results.success++;
          results.items.push({
            itemId,
            itemName: item.name,
            quantity: serialNumber ? 1 : quantity,
            batchNumber: batchNumber || 'N/A',
            serialNumber: serialNumber || 'N/A',
            expiryDate: expiryDate || 'N/A',
          });
        } catch (error) {
          results.failed++;
          results.errors.push(`Line ${lineNo}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`,
      );
    }
  }
}
