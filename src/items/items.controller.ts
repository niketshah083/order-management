import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  UploadedFiles,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { FileUtils } from 'src/common/utilities/file.utils';
import { FileConstants } from 'src/common/constants/file.constant';
import { responseMessage } from 'src/common/utilities/responseMessages.utils';
import { CommonUtils } from 'src/common/utilities/common.utils';
import { UpdateItemDto } from './dto/update-item.dto';
import { GetAllItemDto } from './dto/get-all-item.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { Request } from 'express';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { Repository } from 'typeorm';

@ApiBearerAuth('authorization')
@ApiTags('Items')
@Controller('items')
export class ItemsController {
  constructor(
    private readonly itemService: ItemsService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  @Get('with-stock-status')
  @ApiOperation({ 
    summary: 'Get All Items with Stock Status',
    description: 'Retrieve all items with distributor stock availability for billing'
  })
  @ApiOkResponse({ description: 'Items with stock status retrieved successfully' })
  async getItemsWithStockStatus(@Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;
    
    let distributorId: number | null = null;

    if (userRole === 'distributor') {
      distributorId = userId; // userId IS the distributorId
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      distributorId = 1; // Default distributor
    } else {
      throw new BadRequestException('Unauthorized to view items');
    }

    const data = await this.itemService.getItemsWithStockStatus(distributorId);
    return {
      statusCode: 200,
      message: 'Items with stock status retrieved successfully',
      data,
      totalCount: data.length,
    };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get All Items',
    description: 'Retrieve list of items with pagination and filtering'
  })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by item name or SKU' })
  @ApiOkResponse({ description: 'Items retrieved successfully' })
  async get(@Query() getAllItemDto: GetAllItemDto) {
    try {
      const { data, totalCount } = await this.itemService.findAll(getAllItemDto);
      return {
        message: responseMessage.fetchMessage('item'),
        data,
        totalCount,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Item Details',
    description: 'Retrieve details of a specific item'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Item ID' })
  @ApiOkResponse({ description: 'Item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getOne(@Param('id') id: number) {
    try {
      const data = await this.itemService.findOne(+id);
      return {
        message: responseMessage.fetchMessage('item'),
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor(
      FileUtils.multerConfig([
        FileConstants.FILE_TYPE.IMAGE,
        FileConstants.FILE_TYPE.VIDEO,
      ]),
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Create New Item',
    description: 'Create a new item with optional file uploads'
  })
  @ApiBody({ type: CreateItemDto, description: 'Item creation details' })
  @ApiOkResponse({ description: 'Item created successfully' })
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createItemDto: CreateItemDto,
    @Req() req: Request,
  ) {
    try {
      const data = await this.itemService.create(files, createItemDto, req);
      CommonUtils.removeFiles(files);
      return { message: responseMessage.addMessage('item'), data };
    } catch (error) {
      CommonUtils.removeFiles(files);
      throw error;
    }
  }

  @Put(':id')
  @UseInterceptors(
    AnyFilesInterceptor(
      FileUtils.multerConfig([
        FileConstants.FILE_TYPE.IMAGE,
        FileConstants.FILE_TYPE.VIDEO,
      ]),
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Update Item',
    description: 'Update item details'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Item ID' })
  @ApiBody({ type: UpdateItemDto, description: 'Updated item details' })
  @ApiOkResponse({ description: 'Item updated successfully' })
  async update(
    @Param('id') id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UpdateItemDto,
    @Req() req: Request,
  ) {
    try {
      await this.itemService.update(id, files, dto, req);
      CommonUtils.removeFiles(files);
      return { message: responseMessage.updateMessage('item') };
    } catch (error) {
      CommonUtils.removeFiles(files);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete Item',
    description: 'Delete an item'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Item ID' })
  @ApiOkResponse({ description: 'Item deleted successfully' })
  async delete(@Param('id') id: number) {
    try {
      await this.itemService.delete(+id);
      return { message: responseMessage.deleteMessage('item') };
    } catch (error) {
      throw error;
    }
  }

  @Put(':id/toggle-disable')
  @ApiOperation({ 
    summary: 'Toggle Item Disable Status',
    description: 'Enable or disable an item'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Item ID' })
  @ApiBody({ schema: { example: { isDisabled: true } } })
  @ApiOkResponse({ description: 'Item status toggled successfully' })
  async toggleDisable(
    @Param('id') id: number,
    @Body() body: { isDisabled: boolean },
  ) {
    try {
      await this.itemService.toggleDisable(+id, body.isDisabled);
      return { message: body.isDisabled ? 'Item disabled successfully' : 'Item enabled successfully' };
    } catch (error) {
      throw error;
    }
  }

  @Post('bulk-import')
  @ApiOperation({ 
    summary: 'Bulk Import Items',
    description: 'Import multiple items from CSV/Excel data'
  })
  @ApiBody({ schema: { example: { data: [{ name: 'Item 1', sku: 'SKU001', price: 100 }] } } })
  @ApiOkResponse({ description: 'Items imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid import data' })
  async bulkImportItems(
    @Body() payload: { data: any[] },
    @Req() req: Request,
  ) {
    try {
      const userId = (req as any).userDetails?.userId || 1;
      const result = await this.itemService.bulkImportItems(
        payload.data,
        userId,
      );
      return {
        message: 'Items imported successfully',
        data: result,
      };
    } catch (error) {
      throw error;
    }
  }
}
