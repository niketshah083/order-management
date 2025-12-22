import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreateRazorpayOrderDto,
  VerifyPaymentDto,
  RefundPaymentDto,
} from './dto/create-order.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get Razorpay configuration (key ID)' })
  @ApiResponse({
    status: 200,
    description: 'Returns Razorpay key ID for frontend',
  })
  getConfig() {
    return {
      keyId: this.paymentsService.getKeyId(),
    };
  }

  @Post('create-order')
  @ApiOperation({ summary: 'Create Razorpay order for payment' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createOrder(@Body() dto: CreateRazorpayOrderDto, @Req() req: any) {
    const distributorId =
      req?.userDetails?.distributorId || req?.userDetails?.id;
    const data = await this.paymentsService.createOrder(dto, distributorId);
    return { data };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify Razorpay payment signature' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    const data = await this.paymentsService.verifyPayment(dto);
    return { data };
  }

  @Post('failure')
  @ApiOperation({ summary: 'Handle payment failure' })
  @ApiResponse({ status: 200, description: 'Failure recorded' })
  async handleFailure(
    @Body()
    body: {
      razorpayOrderId: string;
      errorCode: string;
      errorDescription: string;
    },
  ) {
    return this.paymentsService.handlePaymentFailure(
      body.razorpayOrderId,
      body.errorCode,
      body.errorDescription,
    );
  }

  @Post('refund')
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 400, description: 'Refund failed' })
  async refundPayment(@Body() dto: RefundPaymentDto) {
    return this.paymentsService.refundPayment(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments' })
  @ApiResponse({ status: 200, description: 'Returns list of payments' })
  async findAll(
    @Query('distributorId') distributorId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;

    let distId: number | undefined;
    if (distributorId) {
      distId = parseInt(distributorId);
    } else if (userRole === 'distributor') {
      distId = userId;
    }

    return this.paymentsService.findAll(distId, status);
  }

  @Get('billing/:billingId')
  @ApiOperation({ summary: 'Get payments for a billing' })
  @ApiResponse({ status: 200, description: 'Returns payments for billing' })
  async findByBilling(@Param('billingId', ParseIntPipe) billingId: number) {
    return this.paymentsService.findByBilling(billingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Returns payment details' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }
}
