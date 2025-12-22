import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { InventoryCoreService } from './inventory-core.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { CreateSerialDto } from './dto/create-serial.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';

@ApiBearerAuth('authorization')
@ApiTags('Enterprise Inventory')
@Controller('inventory-v2')
export class InventoryEnterpriseController {
  constructor(private readonly inventoryCoreService: InventoryCoreService) {}

  // ═══════════════════════════════════════════════════════════════
  // WAREHOUSE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('warehouses')
  @ApiOperation({ summary: 'Get Warehouses for Distributor' })
  @ApiOkResponse({ description: 'Warehouses retrieved successfully' })
  async getWarehouses(@Req() req: ExtendedRequest) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    let distributorId = userId;
    if (userRole === 'super_admin' || userRole === 'manager') {
      distributorId = null; // Get all warehouses
    }

    const warehouses = distributorId
      ? await this.inventoryCoreService.getWarehousesByDistributor(
          distributorId,
        )
      : [];

    return {
      statusCode: 200,
      data: warehouses,
      message: 'Warehouses retrieved successfully',
    };
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Create Warehouse' })
  @ApiOkResponse({ description: 'Warehouse created successfully' })
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    if (userRole !== 'distributor' && userRole !== 'super_admin') {
      throw new BadRequestException(
        'Only distributors or admins can create warehouses',
      );
    }

    const distributorId =
      userRole === 'distributor' ? userId : dto.distributorId;

    const warehouse =
      await this.inventoryCoreService.getOrCreateDefaultWarehouse(
        distributorId,
        dto.name,
      );

    return {
      statusCode: 201,
      data: warehouse,
      message: 'Warehouse created successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // STOCK BALANCE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('stock-balance')
  @ApiOperation({
    summary: 'Get Real-time Stock Balance (Calculated from Transactions)',
  })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiOkResponse({ description: 'Stock balance retrieved successfully' })
  async getStockBalance(
    @Req() req: ExtendedRequest,
    @Query('itemId') itemId?: number,
    @Query('warehouseId') warehouseId?: number,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const stockBalance = await this.inventoryCoreService.getStockBalance({
      itemId: itemId ? +itemId : undefined,
      warehouseId: warehouseId ? +warehouseId : undefined,
      distributorId,
    });

    return {
      statusCode: 200,
      data: stockBalance,
      totalCount: stockBalance.length,
      message: 'Stock balance retrieved successfully',
    };
  }

  @Get('available-lots/:itemId')
  @ApiOperation({ summary: 'Get Available Lots for Item (FIFO/FEFO)' })
  @ApiParam({ name: 'itemId', type: 'number' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiQuery({ name: 'strategy', required: false, enum: ['FIFO', 'FEFO'] })
  @ApiOkResponse({ description: 'Available lots retrieved successfully' })
  async getAvailableLots(
    @Param('itemId') itemId: number,
    @Query('warehouseId') warehouseId: number,
    @Query('strategy') strategy: 'FIFO' | 'FEFO' = 'FEFO',
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const lots = await this.inventoryCoreService.getAvailableLots(
      +itemId,
      +warehouseId,
      distributorId,
      strategy,
    );

    return {
      statusCode: 200,
      data: lots,
      totalCount: lots.length,
      message: 'Available lots retrieved successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LOT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('lots')
  @ApiOperation({ summary: 'Get All Lots for Item' })
  @ApiQuery({ name: 'itemId', required: true })
  @ApiOkResponse({ description: 'Lots retrieved successfully' })
  async getLots(@Query('itemId') itemId: number, @Req() req: ExtendedRequest) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const lots = await this.inventoryCoreService.getLotsByItem(
      +itemId,
      distributorId,
    );

    return {
      statusCode: 200,
      data: lots,
      totalCount: lots.length,
      message: 'Lots retrieved successfully',
    };
  }

  @Get('lots/:id')
  @ApiOperation({ summary: 'Get Lot Details' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ description: 'Lot details retrieved successfully' })
  async getLotById(@Param('id') id: number) {
    const lot = await this.inventoryCoreService.getLotById(+id);

    return {
      statusCode: 200,
      data: lot,
      message: 'Lot details retrieved successfully',
    };
  }

  @Post('lots')
  @ApiOperation({ summary: 'Create New Lot' })
  @ApiOkResponse({ description: 'Lot created successfully' })
  async createLot(@Body() dto: CreateLotDto, @Req() req: ExtendedRequest) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId =
      userRole === 'distributor' ? userId : dto.distributorId;

    const lot = await this.inventoryCoreService.createLot({
      ...dto,
      distributorId,
      createdBy: userId,
    });

    return {
      statusCode: 201,
      data: lot,
      message: 'Lot created successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SERIAL ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('serials')
  @ApiOperation({ summary: 'Get Available Serials for Item' })
  @ApiQuery({ name: 'itemId', required: true })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiOkResponse({ description: 'Serials retrieved successfully' })
  async getSerials(
    @Query('itemId') itemId: number,
    @Query('warehouseId') warehouseId?: number,
    @Req() req?: ExtendedRequest,
  ) {
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const serials = await this.inventoryCoreService.getAvailableSerials(
      +itemId,
      warehouseId ? +warehouseId : undefined,
      distributorId,
    );

    return {
      statusCode: 200,
      data: serials,
      totalCount: serials.length,
      message: 'Serials retrieved successfully',
    };
  }

  @Get('serials/lookup/:serialNumber')
  @ApiOperation({ summary: 'Lookup Serial Number' })
  @ApiParam({ name: 'serialNumber', type: 'string' })
  @ApiOkResponse({ description: 'Serial details retrieved successfully' })
  async lookupSerial(@Param('serialNumber') serialNumber: string) {
    const serial =
      await this.inventoryCoreService.getSerialByNumber(serialNumber);

    if (!serial) {
      throw new BadRequestException(`Serial number ${serialNumber} not found`);
    }

    return {
      statusCode: 200,
      data: serial,
      message: 'Serial details retrieved successfully',
    };
  }

  @Post('serials')
  @ApiOperation({ summary: 'Create New Serial' })
  @ApiOkResponse({ description: 'Serial created successfully' })
  async createSerial(
    @Body() dto: CreateSerialDto,
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId =
      userRole === 'distributor' ? userId : dto.distributorId;

    const serial = await this.inventoryCoreService.createSerial({
      ...dto,
      distributorId,
      createdBy: userId,
    });

    return {
      statusCode: 201,
      data: serial,
      message: 'Serial created successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('transactions')
  @ApiOperation({ summary: 'Get Transaction History' })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'lotId', required: false })
  @ApiQuery({ name: 'serialId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Transactions retrieved successfully' })
  async getTransactions(
    @Req() req: ExtendedRequest,
    @Query('itemId') itemId?: number,
    @Query('lotId') lotId?: number,
    @Query('serialId') serialId?: number,
    @Query('warehouseId') warehouseId?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const transactions = await this.inventoryCoreService.getTransactionHistory({
      itemId: itemId ? +itemId : undefined,
      lotId: lotId ? +lotId : undefined,
      serialId: serialId ? +serialId : undefined,
      warehouseId: warehouseId ? +warehouseId : undefined,
      distributorId,
      limit: limit ? +limit : 100,
    });

    return {
      statusCode: 200,
      data: transactions,
      totalCount: transactions.length,
      message: 'Transactions retrieved successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPIRY MANAGEMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('expiring-lots')
  @ApiOperation({ summary: 'Get Expiring Lots' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Days threshold (default: 30)',
  })
  @ApiOkResponse({ description: 'Expiring lots retrieved successfully' })
  async getExpiringLots(
    @Req() req: ExtendedRequest,
    @Query('days') days?: number,
  ) {
    const userId = req.userDetails?.userId;
    const userRole = req.userDetails?.role;

    const distributorId = userRole === 'distributor' ? userId : undefined;

    const expiringLots = await this.inventoryCoreService.getExpiringLots(
      days ? +days : 30,
      distributorId,
    );

    return {
      statusCode: 200,
      data: expiringLots,
      totalCount: expiringLots.length,
      message: 'Expiring lots retrieved successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN CUMULATIVE REPORTS
  // Requirements 14.1, 14.2, 14.3, 14.4, 14.5
  // ═══════════════════════════════════════════════════════════════

  @Get('admin/stock-balance')
  @ApiOperation({
    summary: 'Admin: Get Cumulative Stock Balance (All Distributors)',
  })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiOkResponse({
    description: 'Cumulative stock balance retrieved successfully',
  })
  async getAdminStockBalance(
    @Req() req: ExtendedRequest,
    @Query('itemId') itemId?: number,
    @Query('warehouseId') warehouseId?: number,
    @Query('distributorId') distributorId?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can access cumulative reports',
      );
    }

    const stockBalance =
      await this.inventoryCoreService.getAdminCumulativeStockBalance({
        itemId: itemId ? +itemId : undefined,
        warehouseId: warehouseId ? +warehouseId : undefined,
        distributorId: distributorId ? +distributorId : undefined,
      });

    return {
      statusCode: 200,
      data: stockBalance,
      totalCount: stockBalance.length,
      message: 'Cumulative stock balance retrieved successfully',
    };
  }

  @Get('admin/transactions')
  @ApiOperation({
    summary: 'Admin: Get Cumulative Transaction Report (All Distributors)',
  })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiQuery({ name: 'transactionType', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({
    description: 'Cumulative transactions retrieved successfully',
  })
  async getAdminTransactions(
    @Req() req: ExtendedRequest,
    @Query('itemId') itemId?: number,
    @Query('warehouseId') warehouseId?: number,
    @Query('distributorId') distributorId?: number,
    @Query('transactionType') transactionType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can access cumulative reports',
      );
    }

    const transactions =
      await this.inventoryCoreService.getAdminCumulativeTransactions({
        itemId: itemId ? +itemId : undefined,
        warehouseId: warehouseId ? +warehouseId : undefined,
        distributorId: distributorId ? +distributorId : undefined,
        transactionType,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        limit: limit ? +limit : 100,
      });

    return {
      statusCode: 200,
      data: transactions,
      totalCount: transactions.length,
      message: 'Cumulative transactions retrieved successfully',
    };
  }

  @Get('admin/expiring-lots')
  @ApiOperation({
    summary: 'Admin: Get Cumulative Expiring Lots (All Distributors)',
  })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiOkResponse({
    description: 'Cumulative expiring lots retrieved successfully',
  })
  async getAdminExpiringLots(
    @Req() req: ExtendedRequest,
    @Query('days') days?: number,
    @Query('distributorId') distributorId?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can access cumulative reports',
      );
    }

    const expiringLots =
      await this.inventoryCoreService.getAdminCumulativeExpiringLots(
        days ? +days : 30,
        distributorId ? +distributorId : undefined,
      );

    return {
      statusCode: 200,
      data: expiringLots,
      totalCount: expiringLots.length,
      message: 'Cumulative expiring lots retrieved successfully',
    };
  }

  @Get('admin/low-stock')
  @ApiOperation({
    summary: 'Admin: Get Cumulative Low Stock Report (All Distributors)',
  })
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiQuery({ name: 'reorderLevel', required: false })
  @ApiOkResponse({
    description: 'Cumulative low stock items retrieved successfully',
  })
  async getAdminLowStock(
    @Req() req: ExtendedRequest,
    @Query('distributorId') distributorId?: number,
    @Query('reorderLevel') reorderLevel?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can access cumulative reports',
      );
    }

    const lowStockItems =
      await this.inventoryCoreService.getAdminCumulativeLowStock(
        distributorId ? +distributorId : undefined,
        reorderLevel ? +reorderLevel : 10,
      );

    return {
      statusCode: 200,
      data: lowStockItems,
      totalCount: lowStockItems.length,
      message: 'Cumulative low stock items retrieved successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXCEL EXPORT ENDPOINTS
  // Requirements 14.7: Provide option to export data to Excel format
  // ═══════════════════════════════════════════════════════════════

  @Get('admin/stock-balance/export')
  @ApiOperation({ summary: 'Admin: Export Stock Balance to Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  async exportStockBalance(
    @Req() req: ExtendedRequest,
    @Res() res: Response,
    @Query('itemId') itemId?: number,
    @Query('warehouseId') warehouseId?: number,
    @Query('distributorId') distributorId?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can export reports',
      );
    }

    const data = await this.inventoryCoreService.getAdminCumulativeStockBalance(
      {
        itemId: itemId ? +itemId : undefined,
        warehouseId: warehouseId ? +warehouseId : undefined,
        distributorId: distributorId ? +distributorId : undefined,
      },
    );

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Balance');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=stock-balance-${Date.now()}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('admin/transactions/export')
  @ApiOperation({ summary: 'Admin: Export Transactions to Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiQuery({ name: 'transactionType', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  async exportTransactions(
    @Req() req: ExtendedRequest,
    @Res() res: Response,
    @Query('itemId') itemId?: number,
    @Query('warehouseId') warehouseId?: number,
    @Query('distributorId') distributorId?: number,
    @Query('transactionType') transactionType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can export reports',
      );
    }

    const transactions =
      await this.inventoryCoreService.getAdminCumulativeTransactions({
        itemId: itemId ? +itemId : undefined,
        warehouseId: warehouseId ? +warehouseId : undefined,
        distributorId: distributorId ? +distributorId : undefined,
        transactionType,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        limit: 10000, // Higher limit for export
      });

    // Transform for Excel export
    const exportData = transactions.map((t) => ({
      transactionNo: t.transactionNo,
      transactionDate: t.transactionDate,
      transactionType: t.transactionType,
      movementType: t.movementType,
      itemName: t.item?.name,
      lotNumber: t.lot?.lotNumber,
      serialNumber: t.serial?.serialNumber,
      quantity: t.quantity,
      warehouseName: t.warehouse?.name,
      distributorName: t.distributor
        ? `${t.distributor.firstName || ''} ${t.distributor.lastName || ''}`.trim()
        : '',
      referenceType: t.referenceType,
      referenceNo: t.referenceNo,
      unitCost: t.unitCost,
      totalCost: t.totalCost,
      runningBalance: t.runningBalance,
      status: t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=transactions-${Date.now()}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('admin/expiring-lots/export')
  @ApiOperation({ summary: 'Admin: Export Expiring Lots to Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'distributorId', required: false })
  async exportExpiringLots(
    @Req() req: ExtendedRequest,
    @Res() res: Response,
    @Query('days') days?: number,
    @Query('distributorId') distributorId?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can export reports',
      );
    }

    const expiringLots =
      await this.inventoryCoreService.getAdminCumulativeExpiringLots(
        days ? +days : 30,
        distributorId ? +distributorId : undefined,
      );

    // Transform for Excel export
    const exportData = expiringLots.map((item) => ({
      lotNumber: item.lot.lotNumber,
      itemName: item.lot.item?.name,
      expiryDate: item.lot.expiryDate,
      daysToExpiry: item.daysToExpiry,
      availableQuantity: item.availableQuantity,
      distributorName: item.distributorName,
      status: item.lot.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expiring Lots');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=expiring-lots-${Date.now()}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('admin/low-stock/export')
  @ApiOperation({ summary: 'Admin: Export Low Stock Items to Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'distributorId', required: false })
  @ApiQuery({ name: 'reorderLevel', required: false })
  async exportLowStock(
    @Req() req: ExtendedRequest,
    @Res() res: Response,
    @Query('distributorId') distributorId?: number,
    @Query('reorderLevel') reorderLevel?: number,
  ) {
    const userRole = req.userDetails?.role;

    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admins and managers can export reports',
      );
    }

    const lowStockItems =
      await this.inventoryCoreService.getAdminCumulativeLowStock(
        distributorId ? +distributorId : undefined,
        reorderLevel ? +reorderLevel : 10,
      );

    const ws = XLSX.utils.json_to_sheet(lowStockItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Low Stock');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=low-stock-${Date.now()}.xlsx`,
    );
    res.send(buffer);
  }
}
