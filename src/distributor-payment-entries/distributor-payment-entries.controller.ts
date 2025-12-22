import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DistributorPaymentEntriesService } from './distributor-payment-entries.service';
import { CreateDistributorPaymentEntryDto, UpdateDistributorPaymentEntryStatusDto } from './dto/create-distributor-payment-entry.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
@ApiTags('Distributor Payment Entries')
@ApiBearerAuth('access-token')
@Controller('distributor-payment-entries')
export class DistributorPaymentEntriesController {
  constructor(private paymentEntriesService: DistributorPaymentEntriesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('attachment'))
  async createPaymentEntry(
    @Req() req: ExtendedRequest,
    @Body() dto: CreateDistributorPaymentEntryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const distributorId = req.userDetails.userId;
    const attachmentUrl = file ? file.path : undefined;

    const entry = await this.paymentEntriesService.createPaymentEntry(
      distributorId,
      dto,
      attachmentUrl,
    );

    return {
      statusCode: 201,
      message: 'Payment entry created successfully',
      data: entry,
    };
  }

  @Get('my-entries')
  async getMyPaymentEntries(
    @Req() req: ExtendedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const distributorId = req.userDetails.userId;
    const result = await this.paymentEntriesService.getDistributorPaymentEntries(
      distributorId,
      page,
      limit,
    );

    return {
      statusCode: 200,
      data: result.data,
      totalCount: result.totalCount,
    };
  }

  @Get()
  async getAllPaymentEntries(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.paymentEntriesService.getAllPaymentEntries(page, limit);

    return {
      statusCode: 200,
      data: result.data,
      totalCount: result.totalCount,
    };
  }

  @Get(':id')
  async getPaymentEntry(@Param('id') id: number) {
    const entry = await this.paymentEntriesService.getPaymentEntryById(id);

    return {
      statusCode: 200,
      data: entry,
    };
  }

  @Patch(':id/status')
  async approvePaymentEntry(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() dto: UpdateDistributorPaymentEntryStatusDto,
  ) {
    const approverUserId = req.userDetails.userId;
    const entry = await this.paymentEntriesService.approvePaymentEntry(
      id,
      approverUserId,
      dto,
    );

    return {
      statusCode: 200,
      message: 'Payment entry updated successfully',
      data: entry,
    };
  }

  @Get('pending/all')
  async getPendingPaymentEntries() {
    const entries = await this.paymentEntriesService.getPendingPaymentEntries();

    return {
      statusCode: 200,
      data: entries,
    };
  }
}
