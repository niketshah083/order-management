import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BatchTrackingService } from './batch-tracking.service';

@ApiTags('Batch Tracking')
@Controller('batch-tracking')
export class BatchTrackingController {
  constructor(private readonly batchTrackingService: BatchTrackingService) {}

  @Get('batch/:batchNumber')
  @ApiOperation({ summary: 'Get complete details for a specific batch' })
  @ApiParam({ name: 'batchNumber', description: 'Batch number to track' })
  async getBatchDetails(@Param('batchNumber') batchNumber: string) {
    return this.batchTrackingService.getBatchDetails(batchNumber);
  }

  @Get('distributor/:distributorId')
  @ApiOperation({ summary: 'Get all batches for a distributor' })
  @ApiParam({ name: 'distributorId', description: 'Distributor ID' })
  async getDistributorBatches(@Param('distributorId') distributorId: number) {
    return this.batchTrackingService.getDistributorBatches(distributorId);
  }

  @Get('all-batches')
  @ApiOperation({ summary: 'Get all batches (Admin view)' })
  async getAllBatches() {
    return this.batchTrackingService.getAllBatches();
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get expiring batches' })
  @ApiQuery({ name: 'days', required: false, description: 'Days threshold (default: 30)' })
  @ApiQuery({ name: 'distributorId', required: false, description: 'Filter by distributor' })
  async getExpiringBatches(
    @Query('days') days?: number,
    @Query('distributorId') distributorId?: number,
  ) {
    return this.batchTrackingService.getExpiringBatches(days || 30, distributorId);
  }
}
