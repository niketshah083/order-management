import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
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
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { Response } from 'express';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { DataAccessControlService } from 'src/common/services/data-access-control.service';

@ApiBearerAuth('authorization')
@ApiTags('Billings')
@Controller('billings')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly dataAccessControl: DataAccessControlService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create Billing',
    description:
      'Create a new billing record for an order. Distributors see only their own billings. Admin/Manager must specify which distributor the billing belongs to.',
  })
  @ApiBody({
    type: CreateBillingDto,
    description:
      'Billing details. distributorId is required for admin/manager users.',
  })
  @ApiOkResponse({ description: 'Billing created successfully' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid billing data or missing distributorId for admin/manager',
  })
  async create(
    @Body() createBillingDto: CreateBillingDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    // If distributor, auto-assign to their ID (userId IS the distributorId)
    if (userRole === 'distributor' && userId) {
      createBillingDto.distributorId = userId;
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      // For admin/manager, distributorId must be explicitly provided
      if (!createBillingDto.distributorId) {
        throw new BadRequestException(
          'distributorId is required. You must specify which distributor this billing belongs to.',
        );
      }
    }

    // Validate bill date
    const billDate = new Date(createBillingDto.billDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    billDate.setHours(0, 0, 0, 0);

    // Check if bill date is in the future
    if (billDate > today) {
      throw new BadRequestException('Bill date cannot be in the future');
    }

    // Check if bill date is more than 10 days back
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    if (billDate < tenDaysAgo) {
      throw new BadRequestException('Bill date cannot be older than 10 days');
    }

    try {
      const userIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const billing = await this.billingService.create(
        createBillingDto,
        userId,
        userIp,
      );
      return { data: billing, message: 'Billing created successfully' };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create billing: ${error.message}`,
      );
    }
  }

  @Get('items-by-batch-serial')
  @ApiOperation({
    summary: 'Search Items by Batch/Serial Number',
    description:
      'Find items available in distributor inventory with specific batch or serial number',
  })
  @ApiQuery({
    name: 'batchOrSerialNo',
    required: true,
    description: 'Batch number or serial number to search',
  })
  @ApiOkResponse({ description: 'Items retrieved successfully' })
  async getItemsByBatchSerial(
    @Req() req: ExtendedRequest,
    @Query('batchOrSerialNo') batchOrSerialNo: string,
  ) {
    try {
      const userRole = req.userDetails?.role;
      const userId = req.userDetails?.userId;

      if (userRole !== 'distributor') {
        throw new BadRequestException(
          'Only distributors can search for items by batch/serial',
        );
      }

      const distributorId = userId; // userId IS the distributorId

      const items = await this.billingService.findItemsByBatchSerial(
        batchOrSerialNo,
        distributorId,
      );
      return {
        statusCode: 200,
        data: items,
        message: 'Items retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch items: ${error.message}`);
    }
  }

  @Get('customers-by-batch-serial')
  @ApiOperation({
    summary: 'Search Customers by Batch/Serial Number',
    description:
      'Find customers who purchased items with specific batch or serial number (Distributor only)',
  })
  @ApiQuery({
    name: 'batchOrSerialNo',
    required: true,
    description: 'Batch number or serial number to search',
  })
  @ApiOkResponse({ description: 'Customers retrieved successfully' })
  async getCustomersByBatchSerial(
    @Req() req: ExtendedRequest,
    @Query('batchOrSerialNo') batchOrSerialNo: string,
  ) {
    try {
      const userRole = req.userDetails?.role;
      const userId = req.userDetails?.userId;

      if (userRole !== 'distributor') {
        throw new BadRequestException(
          'Only distributors can search for customers by batch/serial',
        );
      }

      const distributorId = userId; // userId IS the distributorId

      const customers = await this.billingService.findCustomersByBatchSerial(
        batchOrSerialNo,
        distributorId,
      );
      return {
        statusCode: 200,
        data: customers,
        message: 'Customers retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch customers: ${error.message}`,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Billings',
    description:
      'Retrieve list of all billing records with optional search and status filter. Data isolation enforced by role: Super Admin sees all, Distributor sees only their billings, Manager sees assigned distributors billings.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by billing reference, customer name, or order number',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status: draft, approved, completed',
  })
  @ApiOkResponse({ description: 'Billings retrieved successfully' })
  async findAll(
    @Req() req: ExtendedRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    try {
      const userRole = req.userDetails?.role;
      const userId = req.userDetails?.userId;

      const authorizedDistributorIds =
        await this.dataAccessControl.getAuthorizedDistributorIds(
          userId,
          userRole,
        );

      const billings = await this.billingService.findAll(
        search,
        status,
        authorizedDistributorIds,
      );
      return { data: billings, totalCount: billings.length };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch billings: ${error.message}`,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Billing Details',
    description: 'Retrieve details of a specific billing record',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiOkResponse({ description: 'Billing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  async findOne(@Param('id') id: string) {
    const billing = await this.billingService.findOne(+id);
    return { statusCode: 200, data: billing };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Billing',
    description: 'Update billing record details (only for DRAFT bills)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiBody({ type: CreateBillingDto, description: 'Updated billing details' })
  @ApiOkResponse({ description: 'Billing updated successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot update approved or completed bills',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBillingDto: Partial<CreateBillingDto>,
    @Req() req: ExtendedRequest,
  ) {
    try {
      const userId = req.userDetails?.userId;
      const userIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const billing = await this.billingService.update(
        +id,
        updateBillingDto,
        userId,
        userIp,
      );
      return { statusCode: 200, data: billing };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve Billing',
    description:
      'Approve a draft billing record. Invoice number is auto-generated. After approval, bill can only be viewed or printed, not edited.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiOkResponse({
    description: 'Billing approved successfully with audit trail',
  })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({
    status: 400,
    description: 'Bill is already approved or is not in draft status',
  })
  async approveBilling(@Param('id') id: string, @Req() req: ExtendedRequest) {
    try {
      const userId = req.userDetails?.userId;
      if (!userId) {
        throw new BadRequestException(
          'User ID is required for approval audit trail',
        );
      }
      const billing = await this.billingService.approveBilling(+id, userId);
      return {
        statusCode: 200,
        data: billing,
        message: 'Bill approved successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark Billing as Complete',
    description: 'Mark an approved billing record as completed/finalized',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiOkResponse({ description: 'Billing marked as complete' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({ status: 400, description: 'Bill must be approved first' })
  async complete(@Param('id') id: string) {
    try {
      const billing = await this.billingService.complete(+id);
      return { statusCode: 200, data: billing };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/record-payment')
  @ApiOperation({
    summary: 'Record Payment for Billing',
    description: 'Record a cash/manual payment against a billing invoice',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiBody({
    schema: {
      example: {
        amount: 5000,
        paymentMethod: 'cash',
        referenceNo: 'CASH-001',
        notes: 'Cash payment received',
      },
    },
  })
  @ApiOkResponse({ description: 'Payment recorded successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({ status: 400, description: 'Invalid payment amount' })
  async recordPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paymentMethod?: string;
      referenceNo?: string;
      notes?: string;
    },
    @Req() req: ExtendedRequest,
  ) {
    try {
      const billing = await this.billingService.recordPayment(
        +id,
        body.amount,
        body.paymentMethod || 'cash',
        body.referenceNo,
        body.notes,
      );
      return {
        statusCode: 200,
        data: billing,
        message: 'Payment recorded successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Billing',
    description: 'Delete a DRAFT billing record only',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiOkResponse({ description: 'Billing deleted successfully' })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete approved or completed bills',
  })
  async remove(@Param('id') id: string) {
    try {
      const result = await this.billingService.remove(+id);
      return { statusCode: 200, data: result };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/download-pdf')
  @ApiOperation({
    summary: 'Download Billing PDF Invoice',
    description:
      'Download approved billing record as PDF invoice (only available for approved bills)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Billing ID' })
  @ApiOkResponse({
    description: 'PDF file downloaded successfully',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Billing not found' })
  @ApiResponse({
    status: 400,
    description: 'Bill must be approved before printing',
  })
  async downloadPDF(@Param('id') id: string, @Res() res: Response) {
    try {
      const billing = await this.billingService.findOne(+id);
      if (!billing) {
        throw new BadRequestException('Billing not found');
      }
      if (billing.approvalStatus !== 'approved') {
        throw new BadRequestException(
          'Bill must be approved before printing invoice',
        );
      }
      const pdfBuffer = await this.billingService.generatePDF(+id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${billing.invoiceNo}.pdf"`,
      });
      res.send(pdfBuffer);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
