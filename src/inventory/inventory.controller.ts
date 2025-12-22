import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryCoreService } from './inventory-core.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  BulkBatchUploadDto,
  BulkSerialUploadDto,
} from './dto/bulk-batch-upload.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { UsersService } from 'src/users/users.service';

@ApiBearerAuth('authorization')
@ApiTags('Distributor Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryCoreService: InventoryCoreService,
    private readonly usersService: UsersService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add Item to Inventory' })
  @ApiBody({ type: CreateInventoryDto })
  @ApiOkResponse({ description: 'Item added to inventory successfully' })
  async create(
    @Body() createInventoryDto: CreateInventoryDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can manage their inventory',
      );
    }

    try {
      const inventory = await this.inventoryService.create(
        userId,
        createInventoryDto,
      );
      return {
        statusCode: 201,
        data: inventory,
        message: 'Item added to inventory successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get Distributor Inventory' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by item name',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    description: 'Filter by distributor (admin only)',
  })
  @ApiOkResponse({ description: 'Inventory retrieved successfully' })
  async findAll(
    @Req() req: ExtendedRequest,
    @Query('search') search?: string,
    @Query('distributorId') queryDistributorId?: number,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    let distributorId: number | null = null;

    if (userRole === 'distributor') {
      // Distributors can only view their own inventory
      distributorId = userId;
      if (!distributorId) {
        throw new BadRequestException(
          'Distributor account not properly configured',
        );
      }
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      // Admins/managers can view any distributor's inventory
      if (queryDistributorId) {
        distributorId = queryDistributorId;
      } else {
        // Default to distributor ID 1 if not specified
        distributorId = 1;
      }
    } else {
      throw new BadRequestException('Unauthorized to view inventory');
    }

    const inventory = await this.inventoryService.findAllByDistributor(
      distributorId,
      search,
    );
    return {
      statusCode: 200,
      data: inventory,
      totalCount: inventory.length,
      message: 'Inventory retrieved successfully',
    };
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get Low Stock Items' })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    description: 'Filter by distributor (admin only)',
  })
  @ApiOkResponse({ description: 'Low stock items retrieved successfully' })
  async getLowStockItems(
    @Req() req: ExtendedRequest,
    @Query('distributorId') queryDistributorId?: number,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    let distributorId: number | null = null;

    if (userRole === 'distributor') {
      distributorId = userId;
      if (!distributorId) {
        throw new BadRequestException(
          'Distributor account not properly configured',
        );
      }
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      distributorId = queryDistributorId || 1;
    } else {
      throw new BadRequestException('Unauthorized to view inventory');
    }

    const items = await this.inventoryService.getLowStockItems(distributorId);
    return {
      statusCode: 200,
      data: items,
      totalCount: items.length,
      message: 'Low stock items retrieved successfully',
    };
  }

  @Get('out-of-stock')
  @ApiOperation({ summary: 'Get Out of Stock Items' })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    description: 'Filter by distributor (admin only)',
  })
  @ApiOkResponse({ description: 'Out of stock items retrieved successfully' })
  async getOutOfStockItems(
    @Req() req: ExtendedRequest,
    @Query('distributorId') queryDistributorId?: number,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    let distributorId: number | null = null;

    if (userRole === 'distributor') {
      distributorId = userId;
      if (!distributorId) {
        throw new BadRequestException(
          'Distributor account not properly configured',
        );
      }
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      distributorId = queryDistributorId || 1;
    } else {
      throw new BadRequestException('Unauthorized to view inventory');
    }

    const items = await this.inventoryService.getOutOfStockItems(distributorId);
    return {
      statusCode: 200,
      data: items,
      totalCount: items.length,
      message: 'Out of stock items retrieved successfully',
    };
  }

  @Get('available-for-billing/all')
  @ApiOperation({
    summary: 'Get Available Inventory for Billing (with batch/serial/expiry)',
  })
  @ApiQuery({
    name: 'itemId',
    required: false,
    description: 'Filter by item ID',
  })
  @ApiOkResponse({ description: 'Available inventory retrieved successfully' })
  async getAvailableForBilling(
    @Req() req: ExtendedRequest,
    @Query('itemId') itemId?: number,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can view their inventory',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ENTERPRISE INVENTORY: Use inventory_lot, inventory_serial, and inventory_transaction
    // Stock is calculated from transactions (IN - OUT - RESERVE + RELEASE)
    // ═══════════════════════════════════════════════════════════════

    const now = new Date();
    const inventoryWithStatus: any[] = [];

    // Get the default warehouse for this distributor
    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
      );

    // If itemId is specified, get data for that item only
    // Otherwise, get all items with stock for this distributor
    if (itemId) {
      // Get available lots for this item (FEFO order)
      const lots = await this.inventoryCoreService.getAvailableLots(
        itemId,
        warehouse.id,
        distributorId,
        'FEFO',
      );

      for (const lot of lots) {
        if (lot.availableQuantity > 0) {
          const expiryDate = lot.expiryDate ? new Date(lot.expiryDate) : null;
          const daysToExpiry = expiryDate
            ? Math.floor(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null;
          let expiryStatus = 'not_tracked';

          if (expiryDate) {
            if (daysToExpiry < 0) {
              expiryStatus = 'expired';
            } else if (daysToExpiry <= 30) {
              expiryStatus = 'expiring_soon';
            } else {
              expiryStatus = 'valid';
            }
          }

          inventoryWithStatus.push({
            id: lot.lotId,
            inventoryId: distributorId * 1000000 + itemId,
            itemId: itemId,
            distributorId: distributorId,
            batchNumber: lot.lotNumber,
            serialNumber: null,
            quantity: lot.availableQuantity,
            expiryDate: lot.expiryDate,
            expiryStatus,
            isExpired: daysToExpiry !== null && daysToExpiry < 0,
            daysToExpiry,
            item: {
              id: itemId,
              name: '', // Item name will be fetched by frontend if needed
            },
          });
        }
      }

      // Get available serials for this item
      const serials = await this.inventoryCoreService.getSerialDetailsView(
        itemId,
        distributorId,
      );

      for (const serial of serials) {
        if (serial.status === 'AVAILABLE') {
          const expiryDate = serial.expiryDate
            ? new Date(serial.expiryDate)
            : null;
          const daysToExpiry = expiryDate
            ? Math.floor(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null;
          let expiryStatus = 'not_tracked';

          if (expiryDate) {
            if (daysToExpiry < 0) {
              expiryStatus = 'expired';
            } else if (daysToExpiry <= 30) {
              expiryStatus = 'expiring_soon';
            } else {
              expiryStatus = 'valid';
            }
          }

          inventoryWithStatus.push({
            id: serial.id,
            inventoryId: serial.inventoryId,
            itemId: itemId,
            distributorId: distributorId,
            batchNumber: serial.batchNumber || null,
            serialNumber: serial.serialNumber,
            quantity: 1,
            expiryDate: serial.expiryDate,
            expiryStatus,
            isExpired: daysToExpiry !== null && daysToExpiry < 0,
            daysToExpiry,
            item: {
              id: itemId,
              name: '',
            },
          });
        }
      }
    } else {
      // Get all inventory items for this distributor
      const inventoryViews =
        await this.inventoryCoreService.getInventoryView(distributorId);

      for (const inv of inventoryViews) {
        if (inv.quantity > 0) {
          // Get batch details for this item
          const batchDetails =
            await this.inventoryCoreService.getBatchDetailsView(
              inv.itemId,
              distributorId,
            );

          for (const batch of batchDetails) {
            if (batch.quantity > 0) {
              const expiryDate = batch.expiryDate
                ? new Date(batch.expiryDate)
                : null;
              const daysToExpiry = expiryDate
                ? Math.floor(
                    (expiryDate.getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;
              let expiryStatus = 'not_tracked';

              if (expiryDate) {
                if (daysToExpiry < 0) {
                  expiryStatus = 'expired';
                } else if (daysToExpiry <= 30) {
                  expiryStatus = 'expiring_soon';
                } else {
                  expiryStatus = 'valid';
                }
              }

              inventoryWithStatus.push({
                id: batch.id,
                inventoryId: inv.id,
                itemId: inv.itemId,
                distributorId: distributorId,
                batchNumber: batch.batchNumber,
                serialNumber: null,
                quantity: batch.quantity,
                expiryDate: batch.expiryDate,
                expiryStatus,
                isExpired: daysToExpiry !== null && daysToExpiry < 0,
                daysToExpiry,
                item: inv.item,
              });
            }
          }

          // Get serial details for this item
          const serialDetails =
            await this.inventoryCoreService.getSerialDetailsView(
              inv.itemId,
              distributorId,
            );

          for (const serial of serialDetails) {
            if (serial.status === 'AVAILABLE') {
              const expiryDate = serial.expiryDate
                ? new Date(serial.expiryDate)
                : null;
              const daysToExpiry = expiryDate
                ? Math.floor(
                    (expiryDate.getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;
              let expiryStatus = 'not_tracked';

              if (expiryDate) {
                if (daysToExpiry < 0) {
                  expiryStatus = 'expired';
                } else if (daysToExpiry <= 30) {
                  expiryStatus = 'expiring_soon';
                } else {
                  expiryStatus = 'valid';
                }
              }

              inventoryWithStatus.push({
                id: serial.id,
                inventoryId: inv.id,
                itemId: inv.itemId,
                distributorId: distributorId,
                batchNumber: serial.batchNumber || null,
                serialNumber: serial.serialNumber,
                quantity: 1,
                expiryDate: serial.expiryDate,
                expiryStatus,
                isExpired: daysToExpiry !== null && daysToExpiry < 0,
                daysToExpiry,
                item: inv.item,
              });
            }
          }

          // If no batch/serial tracking, add item-level entry
          if (batchDetails.length === 0 && serialDetails.length === 0) {
            inventoryWithStatus.push({
              id: inv.id,
              inventoryId: inv.id,
              itemId: inv.itemId,
              distributorId: distributorId,
              batchNumber: null,
              serialNumber: null,
              quantity: inv.quantity,
              expiryDate: null,
              expiryStatus: 'not_tracked',
              isExpired: false,
              daysToExpiry: null,
              item: inv.item,
            });
          }
        }
      }
    }

    // Sort by expiry date (FEFO)
    inventoryWithStatus.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return (
        new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );
    });

    return {
      statusCode: 200,
      data: inventoryWithStatus,
      totalCount: inventoryWithStatus.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Inventory Item Details' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Inventory item retrieved successfully' })
  async findOne(@Param('id') id: string, @Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can view their inventory',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    const inventory = await this.inventoryService.findOne(+id, distributorId);
    return { statusCode: 200, data: inventory };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Inventory Item' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateInventoryDto })
  @ApiOkResponse({ description: 'Inventory item updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can manage their inventory',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const inventory = await this.inventoryService.update(
        +id,
        distributorId,
        updateInventoryDto,
      );
      return {
        statusCode: 200,
        data: inventory,
        message: 'Inventory item updated successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Adjust Inventory Quantity' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    schema: {
      properties: {
        quantityChange: {
          type: 'number',
          description: 'Positive or negative quantity change',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Inventory adjusted successfully' })
  async adjustQuantity(
    @Param('id') id: string,
    @Body('quantityChange') quantityChange: number,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can manage their inventory',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const inventory = await this.inventoryService.adjustQuantity(
        +id,
        distributorId,
        quantityChange,
      );
      return {
        statusCode: 200,
        data: inventory,
        message: 'Inventory adjusted successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Item from Inventory' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Inventory item deleted successfully' })
  async remove(@Param('id') id: string, @Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can manage their inventory',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    return await this.inventoryService.remove(+id, distributorId);
  }

  @Get('download/sample-inventory')
  @ApiOperation({ summary: 'Download Sample Inventory Excel Template' })
  @ApiOkResponse({
    description: 'Sample inventory template downloaded successfully',
  })
  async downloadSampleInventory(@Response() res: any) {
    try {
      const buffer = await this.inventoryService.generateSampleInventoryExcel();
      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="Inventory_Sample_Template.xlsx"',
      });
      res.send(buffer);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk Import Inventory from Excel' })
  @ApiOkResponse({ description: 'Inventory bulk import completed' })
  async bulkImportInventory(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can import inventory');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const result = await this.inventoryService.bulkImportInventory(
        distributorId,
        file,
      );
      return {
        statusCode: 200,
        data: result,
        message: `Bulk import completed. Success: ${result.success}, Failed: ${result.failed}`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // BATCH MANAGEMENT ENDPOINTS
  @Post(':id/batches')
  @ApiOperation({ summary: 'Add Multiple Batches to Inventory Item' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: BulkBatchUploadDto })
  @ApiOkResponse({ description: 'Batches added successfully' })
  async createBatches(
    @Param('id') id: string,
    @Body() bulkBatchUploadDto: BulkBatchUploadDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can manage batches');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const batches = await this.inventoryService.bulkCreateBatches(
        +id,
        distributorId,
        bulkBatchUploadDto,
      );
      return {
        statusCode: 201,
        data: batches,
        message: `${batches.length} batches added successfully`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/batches')
  @ApiOperation({ summary: 'Get Batch Details for Inventory Item' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Batch details retrieved successfully' })
  async getBatchDetails(@Param('id') id: string, @Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can view batch details');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const batches = await this.inventoryService.getBatchDetails(
        +id,
        distributorId,
      );
      return {
        statusCode: 200,
        data: batches,
        totalCount: batches.length,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/batches/upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk Upload Batch Data from Excel' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Batch Excel upload completed' })
  async uploadBatchExcel(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can upload batch data');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const result = await this.inventoryService.bulkUploadBatchExcel(
        +id,
        distributorId,
        file,
      );
      return {
        statusCode: 200,
        data: result,
        message: `Batch upload completed. Success: ${result.success}, Failed: ${result.failed}`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // SERIAL MANAGEMENT ENDPOINTS
  @Post(':id/serials')
  @ApiOperation({ summary: 'Add Multiple Serial Numbers to Inventory Item' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: BulkSerialUploadDto })
  @ApiOkResponse({ description: 'Serial numbers added successfully' })
  async createSerials(
    @Param('id') id: string,
    @Body() bulkSerialUploadDto: BulkSerialUploadDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can manage serials');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const serials = await this.inventoryService.bulkCreateSerials(
        +id,
        distributorId,
        bulkSerialUploadDto,
      );
      return {
        statusCode: 201,
        data: serials,
        message: `${serials.length} serial numbers added successfully`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/serials')
  @ApiOperation({ summary: 'Get Serial Numbers for Inventory Item' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Serial numbers retrieved successfully' })
  async getSerialDetails(@Param('id') id: string, @Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException(
        'Only distributors can view serial details',
      );
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const serials = await this.inventoryService.getSerialDetails(
        +id,
        distributorId,
      );
      return {
        statusCode: 200,
        data: serials,
        totalCount: serials.length,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/serials/upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk Upload Serial Numbers from Excel' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Serial Excel upload completed' })
  async uploadSerialExcel(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    if (userRole !== 'distributor') {
      throw new BadRequestException('Only distributors can upload serial data');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const distributorId = userId;
    if (!distributorId) {
      throw new BadRequestException(
        'Distributor account not properly configured',
      );
    }

    try {
      const result = await this.inventoryService.bulkUploadSerialExcel(
        +id,
        distributorId,
        file,
      );
      return {
        statusCode: 200,
        data: result,
        message: `Serial upload completed. Success: ${result.success}, Failed: ${result.failed}`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
