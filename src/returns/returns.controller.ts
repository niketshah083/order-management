import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnsService } from './returns.service';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { ApprovePurchaseReturnDto } from './dto/approve-purchase-return.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { DistributorEntity } from 'src/users/entities/distributor.entity';

@ApiBearerAuth('authorization')
@ApiTags('Returns')
@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly returnsService: ReturnsService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  // Helper method to get distributor ID from user ID

  // Purchase Returns
  @Post('purchase')
  async createPurchaseReturn(
    @Body() createPurchaseReturnDto: CreatePurchaseReturnDto,
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const distributorId = userId;
    const purchaseReturn = await this.returnsService.createPurchaseReturn(
      createPurchaseReturnDto,
      distributorId,
    );
    return { statusCode: 201, data: purchaseReturn };
  }

  @Get('purchase')
  async findAllPurchaseReturns(
    @Req() req: ExtendedRequest,
    @Query('distributorId') distributorId?: string,
    @Query('status') status?: string,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    // For distributors, only show their own purchase returns
    // For managers and admins, show all
    let filterDistributorId: number | undefined;
    if (userRole === 'distributor') {
      // Get distributor ID from user ID
      if (userId) {
        filterDistributorId = userId;
      }
    } else if (distributorId) {
      // Manager/Admin can filter by specific distributor
      filterDistributorId = +distributorId;
    }

    const purchases = await this.returnsService.findAllPurchaseReturns(
      filterDistributorId,
      status,
    );
    return { statusCode: 200, data: purchases, totalCount: purchases.length };
  }

  @Patch('purchase/:id/status')
  async updatePurchaseReturnStatus(
    @Param('id') id: string,
    @Body() body: { status: 'pending' | 'approved' | 'rejected' },
  ) {
    const purchaseReturn = await this.returnsService.updatePurchaseReturnStatus(
      +id,
      body.status,
    );
    return { statusCode: 200, data: purchaseReturn };
  }

  @Patch('purchase/:id/approve')
  async approvePurchaseReturn(
    @Param('id') id: string,
    @Body() body: ApprovePurchaseReturnDto,
    @Req() req: ExtendedRequest,
  ) {
    const userRole = req.userDetails?.role;
    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new BadRequestException(
        'Only admin or manager can approve returns',
      );
    }

    const purchaseReturn = await this.returnsService.approvePurchaseReturn(
      +id,
      body.status,
      body.rejectionReason,
      body.adminComments,
    );
    return { statusCode: 200, data: purchaseReturn };
  }

  // Sales Returns
  @Post('sales')
  async createSalesReturn(
    @Body() createSalesReturnDto: CreateSalesReturnDto,
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const distributorId = userId;
    const salesReturn = await this.returnsService.createSalesReturn(
      createSalesReturnDto,
      distributorId,
    );
    return { statusCode: 201, data: salesReturn };
  }

  @Get('sales')
  async findAllSalesReturns(
    @Req() req: ExtendedRequest,
    @Query('distributorId') distributorId?: string,
    @Query('status') status?: string,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    // For distributors, only show their own sales returns
    // For managers and admins, show all
    let filterDistributorId: number | undefined;
    if (userRole === 'distributor') {
      // Get distributor ID from user ID
      if (userId) {
        filterDistributorId = userId;
      }
    } else if (distributorId) {
      // Manager/Admin can filter by specific distributor
      filterDistributorId = +distributorId;
    }

    const sales = await this.returnsService.findAllSalesReturns(
      filterDistributorId,
      status,
    );
    return { statusCode: 200, data: sales, totalCount: sales.length };
  }

  @Patch('sales/:id/status')
  async updateSalesReturnStatus(
    @Param('id') id: string,
    @Body() body: { status: 'pending' | 'approved' | 'rejected' },
  ) {
    const salesReturn = await this.returnsService.updateSalesReturnStatus(
      +id,
      body.status,
    );
    return { statusCode: 200, data: salesReturn };
  }

  @Get('sales/prefill/:billNo')
  async prefillSalesReturnFromBilling(
    @Param('billNo') billNo: string,
    @Req() req: ExtendedRequest,
  ) {
    const userId = req.userDetails?.userId;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    const distributorId = userId;
    const prefillData =
      await this.returnsService.getPrefillDataFromBillingByBillNo(
        billNo,
        distributorId,
      );
    return { statusCode: 200, data: prefillData };
  }
}
