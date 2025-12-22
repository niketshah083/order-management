import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Res,
  ForbiddenException,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiOkResponse, ApiConsumes } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { responseMessage } from 'src/common/utilities/responseMessages.utils';

@ApiBearerAuth('authorization')
@ApiTags('Purchase Orders')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private svc: PurchaseOrdersService) {}

  @Post(':id/batch-details')
  @ApiOperation({ summary: 'Save Batch Details', description: 'Save batch, serial, and expiry details for PO items' })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  async saveBatchDetails(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() body: { batchDetails: Array<{itemId: number; batchNumber: string; serialNumber?: string; expiryDate: string}> }
  ) {
    const result = await this.svc.saveBatchDetails(+id, req.userDetails.userId, body.batchDetails);
    return { data: result, message: 'Batch details saved successfully' };
  }

  @Get(':id/batch-template')
  @ApiOperation({ summary: 'Download Batch Import Template', description: 'Download Excel template for batch import' })
  async downloadBatchTemplate(@Res() res: any) {
    const buffer = await this.svc.downloadBatchImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="batch-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post(':id/batch-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import Batch Details from Excel', description: 'Upload Excel file with batch, serial, and expiry details' })
  @ApiConsumes('multipart/form-data')
  async importBatchData(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.svc.processBatchExcelImport(+id, file);
    return { data: result, message: 'Batch data imported successfully' };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get Purchase Orders',
    description: 'Retrieve list of purchase orders with filtering and pagination'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by PO number or distributor name' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status: PENDING, APPROVED, COMPLETED, REJECTED' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for filtering (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for filtering (ISO format)' })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number', description: 'Filter by distributor ID' })
  @ApiOkResponse({ description: 'Purchase orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Req() req: ExtendedRequest) {
    const search = req.query?.search as string;
    const status = req.query?.status as string;
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 10;
    const startDate = req.query?.startDate as string;
    const endDate = req.query?.endDate as string;
    const distributorId = parseInt(req.query?.distributorId as string) || undefined;

    const result = await this.svc.findAll(
      req,
      search,
      status,
      page,
      limit,
      startDate,
      endDate,
      distributorId,
    );

    return {
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      message: responseMessage.fetchMessage('Purchase Orders'),
    };
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create Purchase Order',
    description: 'Create a new purchase order (distributors only)'
  })
  @ApiBody({ type: CreatePurchaseOrderDto, description: 'Purchase order details' })
  @ApiOkResponse({ description: 'Purchase order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid PO data' })
  @ApiResponse({ status: 403, description: 'Forbidden - only distributors can create POs' })
  async create(
    @Req() req: ExtendedRequest,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    if (req.userDetails.role !== 'distributor') {
      throw new ForbiddenException('Only distributors can create purchase orders');
    }
    const data = await this.svc.create(dto, req);
    return { data, message: responseMessage.addMessage('Purchase Order') };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Purchase Order Details',
    description: 'Retrieve details of a specific purchase order'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiOkResponse({ description: 'Purchase order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - distributors can only view their own POs' })
  async getOne(@Req() req: ExtendedRequest, @Param('id') id: number) {
    const po = await this.svc.findOne(+id);
    
    // Check if user can view this PO
    const role = req.userDetails.role;
    const userId = req.userDetails.userId;
    
    if (role === 'distributor' && po.distributorId !== userId) {
      throw new ForbiddenException('You can only view your own purchase orders');
    }
    
    return { data: po, message: responseMessage.fetchMessage('Purchase Order') };
  }

  @Put(':id/approve')
  @ApiOperation({ 
    summary: 'Approve Purchase Order',
    description: 'Approve a purchase order (admins and managers only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiOkResponse({ description: 'Purchase order approved successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Invalid approval state' })
  @ApiResponse({ status: 403, description: 'Forbidden - only admins and managers can approve' })
  async approvePurchaseOrder(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
  ) {
    const role = req.userDetails.role;
    const userId = req.userDetails.userId;
    
    if (role !== 'super_admin' && role !== 'manager') {
      throw new ForbiddenException('Only admins and managers can approve purchase orders');
    }

    const result = await this.svc.approvePurchaseOrder(+id, userId);
    return { data: result, message: 'Purchase order approved successfully' };
  }

  @Put(':id/reject')
  @ApiOperation({ 
    summary: 'Reject Purchase Order',
    description: 'Reject a purchase order with reason (admins and managers only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({ schema: { example: { reason: 'Items not available' }, properties: { reason: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Purchase order rejected successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Invalid rejection state or missing reason' })
  @ApiResponse({ status: 403, description: 'Forbidden - only admins and managers can reject' })
  async rejectPurchaseOrder(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() body: { reason: string },
  ) {
    const role = req.userDetails.role;
    const userId = req.userDetails.userId;
    
    if (role !== 'super_admin' && role !== 'manager') {
      throw new ForbiddenException('Only admins and managers can reject purchase orders');
    }

    if (!body.reason || body.reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required');
    }

    const result = await this.svc.rejectPurchaseOrder(+id, userId, body.reason);
    return { data: result, message: 'Purchase order rejected' };
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update Purchase Order Status',
    description: 'Change purchase order status (admins, managers, and distributors can mark their own as DELIVERED)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({ schema: { example: { status: 'APPROVED' }, properties: { status: { type: 'string', enum: ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'DELIVERED'] } } } })
  @ApiOkResponse({ description: 'Purchase order status updated successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 403, description: 'Forbidden - distributors can only mark their own POs as DELIVERED' })
  async updateStatus(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() updateDto: { status: string },
  ) {
    const role = req.userDetails.role;
    const userId = req.userDetails.userId;
    
    const validStatuses = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'DELIVERED'];
    if (!validStatuses.includes(updateDto.status)) {
      throw new BadRequestException('Invalid status');
    }

    // Distributors can only mark their own POs as DELIVERED
    if (role === 'distributor') {
      if (updateDto.status !== 'DELIVERED') {
        throw new ForbiddenException('Distributors can only mark their own purchase orders as DELIVERED');
      }
      const po = await this.svc.findOne(+id);
      if (!po || po.createdBy !== userId) {
        throw new ForbiddenException('You can only update your own purchase orders');
      }
    } else if (role !== 'super_admin' && role !== 'manager') {
      throw new ForbiddenException('Unauthorized to update purchase order status');
    }

    const result = await this.svc.updateStatus(+id, updateDto.status);
    return { data: result, message: 'Purchase order status updated successfully' };
  }

  @Post(':id/mark-delivered')
  @ApiOperation({ 
    summary: 'Mark Purchase Order as Delivered',
    description: 'Mark PO as delivered with optional batch details and auto-create inventory (admins, managers, and distributors can mark their own)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({ schema: { example: { batchDetails: [{itemId: 1, batchNumber: 'B001', serialNumber: 'SN-001', expiryDate: '2025-12-31'}] }, properties: { batchDetails: { type: 'array', items: { type: 'object', properties: { itemId: { type: 'number' }, batchNumber: { type: 'string' }, serialNumber: { type: 'string' }, expiryDate: { type: 'string' } } } } } } })
  @ApiOkResponse({ description: 'Purchase order marked as delivered and inventory created' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - distributors can only mark their own orders' })
  async markAsDelivered(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() body?: { batchDetails?: Array<{itemId: number; batchNumber?: string; serialNumber?: string; expiryDate?: string}> },
  ) {
    const role = req.userDetails.role;
    const userId = req.userDetails.userId;
    
    // Allow admins/managers to mark any PO as delivered
    // Allow distributors to mark only their own POs
    if (role === 'distributor') {
      const po = await this.svc.findOne(+id);
      if (!po || po.createdBy !== userId) {
        throw new ForbiddenException('You can only mark your own purchase orders as delivered');
      }
    } else if (role !== 'super_admin' && role !== 'manager') {
      throw new ForbiddenException('Unauthorized to mark orders as delivered');
    }

    const result = await this.svc.markAsDelivered(+id, body?.batchDetails);
    return { data: result, message: 'Purchase order marked as delivered and inventory created' };
  }

  @Post(':id/upload-invoice')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Upload Invoice for Purchase Order',
    description: 'Upload invoice PDF/image for a purchase order (admins and managers only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Invoice file (PDF, JPG, PNG)' }
      }
    }
  })
  @ApiOkResponse({ description: 'Invoice uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'No file provided' })
  @ApiResponse({ status: 403, description: 'Forbidden - only admins and managers can upload' })
  async uploadInvoice(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const role = req.userDetails.role;
    
    if (role !== 'super_admin' && role !== 'manager') {
      throw new ForbiddenException('Only admins and managers can upload invoices');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.svc.uploadInvoice(+id, file);
    return { 
      data: result, 
      message: 'Invoice uploaded successfully' 
    };
  }

  @Put(':id/edit')
  @ApiOperation({ summary: 'Update Purchase Order', description: 'Update items in a purchase order' })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({ schema: { type: 'object', properties: { items: { type: 'array' } } } })
  @ApiOkResponse({ description: 'Purchase order updated successfully' })
  async updatePurchaseOrder(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() body: { items: Array<{itemId: number; quantity: number}> },
  ) {
    const result = await this.svc.updatePurchaseOrder(+id, body);
    return { data: result, message: 'Purchase order updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Purchase Order', description: 'Delete a PENDING purchase order' })
  @ApiParam({ name: 'id', type: 'number', description: 'Purchase Order ID' })
  @ApiOkResponse({ description: 'Purchase order deleted successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete non-PENDING purchase orders' })
  async deletePurchaseOrder(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
  ) {
    const result = await this.svc.deletePurchaseOrder(+id);
    return { data: result, message: result.message };
  }
}
