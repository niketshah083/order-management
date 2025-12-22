import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  BadRequestException,
  Res,
  Req,
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
import { LedgerService } from './ledger.service';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { InjectRepository } from '@nestjs/typeorm';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { Repository } from 'typeorm';

@ApiBearerAuth('authorization')
@ApiTags('Distributor Ledger')
@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create Ledger Entry',
    description: 'Create a new transaction entry in the distributor ledger',
  })
  @ApiBody({
    schema: {
      example: {
        distributorId: 1,
        transactionType: 'PURCHASE',
        amount: 5000,
        description: 'Purchase order PO001',
      },
    },
  })
  @ApiOkResponse({ description: 'Ledger entry created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing required fields or invalid data',
  })
  async createEntry(@Body() body: any) {
    const {
      distributorId,
      transactionType,
      amount,
      description,
      referenceNo,
      referenceType,
      referenceId,
    } = body;

    if (!distributorId || !transactionType || amount === undefined) {
      throw new BadRequestException(
        'distributorId, transactionType, and amount are required',
      );
    }

    const entry = await this.ledgerService.createEntry(
      distributorId,
      transactionType,
      amount,
      description,
      referenceNo,
      referenceType,
      referenceId,
    );

    return { statusCode: 201, data: entry };
  }

  @Post('opening-balance')
  @ApiOperation({
    summary: 'Set Opening Balance',
    description: 'Set the opening balance for a distributor',
  })
  @ApiBody({
    schema: {
      example: {
        distributorId: 1,
        openingBalance: 10000,
        description: 'Opening balance as of 01-01-2025',
      },
    },
  })
  @ApiOkResponse({ description: 'Opening balance set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async setOpeningBalance(@Body() body: any) {
    const { distributorId, openingBalance, description } = body;

    if (!distributorId || openingBalance === undefined) {
      throw new BadRequestException(
        'distributorId and openingBalance are required',
      );
    }

    const entry = await this.ledgerService.createEntry(
      distributorId,
      'OPENING_BALANCE',
      openingBalance,
      description || 'Opening Balance',
      'OPENING',
      'OPENING_BALANCE',
      0,
    );

    return { statusCode: 201, data: entry };
  }

  @Get()
  @ApiOperation({
    summary: 'Get Ledger (Auth-aware)',
    description:
      'Retrieve transaction history with authorization - distributors see their own, admins see any',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Distributor ID (for admins only)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Number of entries per page (default: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: 'number',
    description: 'Number of entries to skip (default: 0)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: 'Ledger entries retrieved successfully' })
  async getLedger(
    @Req() req: ExtendedRequest,
    @Query('distributorId') queryDistributorId?: number,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;

    let distributorId: number | null = null;

    if (userRole === 'distributor') {
      // Distributors can only view their own ledger
      distributorId = userId;
      if (!distributorId) {
        throw new BadRequestException(
          'Distributor account not properly configured',
        );
      }
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      // Admins/managers can view any distributor's ledger
      distributorId = queryDistributorId || 1;
    } else {
      throw new BadRequestException('Unauthorized to view ledger');
    }

    const result = await this.ledgerService.getDistributorLedger(
      distributorId,
      +limit,
      +offset,
      startDate,
      endDate,
    );

    return {
      statusCode: 200,
      data: result.data,
      totalCount: result.totalCount,
      message: 'Ledger entries retrieved successfully',
    };
  }

  @Get('distributor/:distributorId')
  @ApiOperation({
    summary: 'Get Distributor Ledger',
    description:
      'Retrieve transaction history for a distributor with pagination and date range filtering',
  })
  @ApiParam({
    name: 'distributorId',
    type: 'number',
    description: 'Distributor ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Number of entries per page (default: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: 'number',
    description: 'Number of entries to skip (default: 0)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: 'Ledger entries retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  async getDistributorLedger(
    @Param('distributorId') distributorId: string,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.ledgerService.getDistributorLedger(
      +distributorId,
      +limit,
      +offset,
      startDate,
      endDate,
    );

    return {
      statusCode: 200,
      data: result.data,
      totalCount: result.totalCount,
      message: 'Ledger entries retrieved successfully',
    };
  }

  @Get('distributor/:distributorId/summary')
  @ApiOperation({
    summary: 'Get Ledger Summary',
    description:
      'Get summary information for a distributor ledger (total purchases, payments, balance) with optional date range filtering',
  })
  @ApiParam({
    name: 'distributorId',
    type: 'number',
    description: 'Distributor ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: 'Ledger summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  async getLedgerSummary(
    @Param('distributorId') distributorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const summary = await this.ledgerService.getLedgerSummary(
      +distributorId,
      startDate,
      endDate,
    );
    return { statusCode: 200, data: summary };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Ledger Entry',
    description: 'Delete a transaction entry from the ledger',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Ledger Entry ID' })
  @ApiOkResponse({ description: 'Ledger entry deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ledger entry not found' })
  async deleteEntry(@Param('id') id: string) {
    const result = await this.ledgerService.deleteEntry(+id);
    return { statusCode: 200, data: result };
  }

  @Get('distributor/:distributorId/export-pdf')
  @ApiOperation({
    summary: 'Export Ledger as PDF',
    description: 'Download distributor ledger as a PDF file',
  })
  @ApiParam({
    name: 'distributorId',
    type: 'number',
    description: 'Distributor ID',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF downloaded successfully',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  async exportLedgerPDF(
    @Param('distributorId') distributorId: string,
    @Res() res: any,
  ) {
    try {
      const pdfBuffer =
        await this.ledgerService.generateLedgerPDF(+distributorId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ledger-${distributorId}-${new Date().getTime()}.pdf"`,
      });
      res.send(pdfBuffer);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  @Get('distributor/:distributorId/export-csv')
  @ApiOperation({
    summary: 'Export Ledger as CSV',
    description: 'Download distributor ledger as a CSV file',
  })
  @ApiParam({
    name: 'distributorId',
    type: 'number',
    description: 'Distributor ID',
  })
  @ApiResponse({ status: 200, description: 'CSV downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  async exportLedgerCSV(
    @Param('distributorId') distributorId: string,
    @Res() res: any,
  ) {
    try {
      const csv = await this.ledgerService.exportLedgerAsCSV(+distributorId);
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ledger-${distributorId}-${new Date().getTime()}.csv"`,
      });
      res.send(csv);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
