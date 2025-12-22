import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  ForbiddenException,
  Res,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { responseMessage } from 'src/common/utilities/responseMessages.utils';
import { Request, Response } from 'express';
import { SkipTransform } from 'src/common/decorators/skip-interceptor.decorator';
import { CompleteOrdersDto } from './dto/complete-orders.dto';

@ApiBearerAuth('authorization')
@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get All Orders',
    description: 'Retrieve list of orders with optional search filtering'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by order number, customer name, or reference' })
  @ApiOkResponse({ description: 'Orders retrieved successfully' })
  async list(@Req() req: ExtendedRequest) {
    const search = req.query?.search as string;
    const data = await this.svc.findAll(req, search);
    return data;
  }

  @Post('whatsapp')
  @SkipTransform()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Process WhatsApp Order Data',
    description: 'Internal webhook endpoint to process orders from WhatsApp Business API'
  })
  @ApiOkResponse({ description: 'WhatsApp data processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid WhatsApp data' })
  async processWhatsappData(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.svc.processWhatsappData(req.body, req, res);
      res.send(data);
    } catch (error) {
      throw error;
    }
  }

  @Post('getCurrentWindow')
  @ApiOperation({ 
    summary: 'Get Current Time Window',
    description: 'Get the current time window for order processing'
  })
  @ApiOkResponse({ description: 'Current window retrieved successfully' })
  async getCurrentWindow() {
    try {
      const currentWindow = this.svc.getCurrentWindow();
      return {
        data: currentWindow,
        message: responseMessage.addMessage('current window'),
      };
    } catch (error) {
      throw error;
    }
  }

  @Put('completeOrders')
  @ApiOperation({ 
    summary: 'Bulk Complete Orders',
    description: 'Mark multiple orders as complete (admin only)'
  })
  @ApiBody({ type: CompleteOrdersDto, description: 'Order IDs to complete' })
  @ApiOkResponse({ description: 'Orders completed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can complete orders' })
  async completeOrders(
    @Req() req: ExtendedRequest,
    @Body() completeOrdersDto: CompleteOrdersDto,
  ) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();

    const data = await this.svc.completeOrders(
      completeOrdersDto,
      req.userDetails.userId,
    );
    return { message: responseMessage.completeMessage('Order'), data };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Order Details',
    description: 'Retrieve details of a specific order'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async get(@Req() req: ExtendedRequest, @Param('id') id: number) {
    const data = await this.svc.findOne(+id);
    return { data, message: responseMessage.fetchMessage('Order') };
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create Order',
    description: 'Create a new sales order (for customers, distributors, managers, and admins)'
  })
  @ApiBody({ type: CreateOrderDto, description: 'Order details' })
  @ApiOkResponse({ description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 403, description: 'Forbidden - user role cannot create orders' })
  async create(@Req() req: ExtendedRequest, @Body() dto: CreateOrderDto) {
    if (
      req.userDetails.role !== 'super_admin' &&
      req.userDetails.role !== 'customer' &&
      req.userDetails.role !== 'distributor' &&
      req.userDetails.role !== 'manager'
    )
      throw new ForbiddenException();
    const data = await this.svc.create(
      dto,
      dto.customerId || req.userDetails.userId,
    );
    return { data, message: responseMessage.addMessage('Order') };
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update Order',
    description: 'Update order details (admin only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Order ID' })
  @ApiBody({ type: CreateOrderDto, description: 'Updated order details' })
  @ApiOkResponse({ description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only admins can update orders' })
  async update(
    @Req() req: ExtendedRequest,
    @Param('id') id: number,
    @Body() dto: CreateOrderDto,
  ) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    const data = await this.svc.update(
      +id,
      dto,
      dto.customerId || req.userDetails.userId,
    );
    return { data, message: responseMessage.updateMessage('Order') };
  }
}
