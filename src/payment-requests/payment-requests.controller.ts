import { Controller, Get, Post, Body, Patch, Param, Query, Req, ForbiddenException, Headers, RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentLinkService } from './services/payment-link.service';
import { RazorpayService } from './services/razorpay.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { RazorpayWebhookDto } from './dto/razorpay-webhook.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { DataAccessControlService } from 'src/common/services/data-access-control.service';

@ApiBearerAuth('authorization')
@ApiTags('Payment Requests')
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(
    private readonly paymentRequestsService: PaymentRequestsService,
    private readonly paymentLinkService: PaymentLinkService,
    private readonly razorpayService: RazorpayService,
    private readonly dataAccessControl: DataAccessControlService,
  ) {}

  @Post()
  async create(@Body() createPaymentRequestDto: CreatePaymentRequestDto) {
    const paymentRequest = await this.paymentRequestsService.create(createPaymentRequestDto);
    return { statusCode: 201, data: paymentRequest };
  }

  @Post('purchase-order/:orderId')
  async createFromPurchaseOrder(
    @Req() req: ExtendedRequest,
    @Param('orderId') orderId: string,
    @Body() body: { distributorId: number; amount: number; reason?: string },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can create payment requests');
    }
    const paymentRequest = await this.paymentRequestsService.createFromPurchaseOrder(
      +orderId,
      body.distributorId,
      body.amount,
      body.reason,
    );
    return { statusCode: 201, data: paymentRequest };
  }

  @Post('distributor/:distributorId/request')
  async createFromDistributor(
    @Req() req: ExtendedRequest,
    @Param('distributorId') distributorId: string,
    @Body() body: { amount: number; reason?: string },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can create payment requests');
    }
    const paymentRequest = await this.paymentRequestsService.createFromDistributor(
      +distributorId,
      body.amount,
      body.reason,
    );
    return { statusCode: 201, data: paymentRequest };
  }

  @Get()
  async findAll(@Req() req: ExtendedRequest, @Query('status') status?: string) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;
    
    try {
      // Get authorized distributor IDs based on user role and permissions
      const authorizedDistributorIds = await this.dataAccessControl.getAuthorizedDistributorIds(
        userId,
        userRole,
      );
      
      const paymentRequests = await this.paymentRequestsService.findAll(status, authorizedDistributorIds);
      return { statusCode: 200, data: paymentRequests, totalCount: paymentRequests.length };
    } catch (error) {
      return {
        statusCode: 403,
        error: error.message || 'Access denied',
      };
    }
  }

  @Get('order/:orderId')
  async findByOrder(@Param('orderId') orderId: string) {
    const paymentRequests = await this.paymentRequestsService.findByOrder(+orderId);
    return { statusCode: 200, data: paymentRequests };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const paymentRequest = await this.paymentRequestsService.findOne(+id);
    return { statusCode: 200, data: paymentRequest };
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
    @Body() body: { status: 'pending' | 'paid' | 'rejected'; reason?: string },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can update payment status');
    }
    
    // Get payment request details first
    const paymentRequest = await this.paymentRequestsService.findOne(+id);
    if (!paymentRequest) {
      throw new ForbiddenException('Payment request not found');
    }

    // Get past due details for this distributor
    const pastDueDetails = await this.paymentRequestsService.getPastDueDetails(paymentRequest.distributorId);
    
    // Update status
    const updatedPaymentRequest = await this.paymentRequestsService.updateStatus(+id, body.status, body.reason);
    
    return { 
      statusCode: 200, 
      data: updatedPaymentRequest,
      pastDue: pastDueDetails
    };
  }

  @Get('distributor/:distributorId/past-due')
  async getPastDueByDistributor(
    @Param('distributorId') distributorId: string,
  ) {
    const pastDueDetails = await this.paymentRequestsService.getPastDueDetails(+distributorId);
    return { statusCode: 200, data: pastDueDetails };
  }

  @Get('distributor/:distributorId')
  async findByDistributor(
    @Param('distributorId') distributorId: string,
    @Query('status') status?: string,
  ) {
    const paymentRequests = await this.paymentRequestsService.findByDistributor(+distributorId, status);
    return { statusCode: 200, data: paymentRequests, totalCount: paymentRequests.length };
  }

  @Get('auto-triggered/pending')
  async getAutoTriggeredPending(
    @Query('distributorId') distributorId?: string,
  ) {
    const distributorIdNum = distributorId ? +distributorId : undefined;
    const paymentRequests = await this.paymentRequestsService.getPendingAutoTriggeredRequests(distributorIdNum);
    return { statusCode: 200, data: paymentRequests, totalCount: paymentRequests.length };
  }

  @Post('purchase-order/:poId/create-payment-request')
  @ApiOperation({ 
    summary: 'Create Payment Request for Purchase Order',
    description: 'Create a payment request for a specific purchase order with invoice'
  })
  @ApiParam({ name: 'poId', type: 'number', description: 'Purchase Order ID' })
  @ApiBody({ schema: { example: { distributorId: 1, amount: 5000, invoiceUrl: 'https://...', reason: 'Payment for PO' } } })
  @ApiOkResponse({ description: 'Payment request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid PO or distributor' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createPaymentRequestForPO(
    @Req() req: ExtendedRequest,
    @Param('poId') poId: string,
    @Body() body: { distributorId: number; amount: number; invoiceUrl?: string; reason?: string },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can create payment requests');
    }

    const paymentRequest = await this.paymentRequestsService.createPaymentRequestForPurchaseOrder(
      +poId,
      body.distributorId,
      body.amount,
      body.invoiceUrl,
      body.reason,
    );
    return { statusCode: 201, data: paymentRequest, message: 'Payment request created successfully' };
  }

  @Post(':id/record-manual-payment')
  @ApiOperation({ 
    summary: 'Record Manual Payment (Offline)',
    description: 'Record a manual/offline payment against a payment request with reference number and date'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Payment Request ID' })
  @ApiBody({ schema: { example: { amountPaid: 5000, referenceNo: 'TXN123456', paymentDate: '2025-11-25', isOfflinePayment: true } } })
  @ApiOkResponse({ description: 'Manual payment recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 404, description: 'Payment request not found' })
  async recordManualPayment(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
    @Body() body: { amountPaid: number; referenceNo: string; paymentDate?: string; isOfflinePayment?: boolean },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can record manual payments');
    }

    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : undefined;
    const isOfflinePayment = body.isOfflinePayment !== undefined ? body.isOfflinePayment : true;
    
    const paymentRequest = await this.paymentRequestsService.recordManualPayment(
      +id,
      body.amountPaid,
      body.referenceNo,
      paymentDate,
      isOfflinePayment,
    );
    return { 
      statusCode: 200, 
      data: paymentRequest, 
      message: 'Manual payment recorded successfully',
      paymentMarkedAs: isOfflinePayment ? 'OFFLINE' : 'ONLINE'
    };
  }

  @Post(':id/generate-link')
  async generatePaymentLink(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can generate payment links');
    }

    const paymentRequest = await this.paymentRequestsService.findOne(+id);
    if (!paymentRequest) {
      throw new ForbiddenException('Payment request not found');
    }

    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    // Get the frontend domain from environment or construct it
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const links = this.paymentLinkService.generatePaymentLinkUrls(paymentLink, frontendUrl);

    // Update the payment request with new link details
    const updated = await this.paymentRequestsService.updateUpiStatus(+id, 'pending');
    
    return {
      statusCode: 200,
      data: {
        ...updated,
        paymentLink,
        linkExpiresAt,
        customerLink: links.customerLink,
        distributorLink: links.distributorLink,
      },
    };
  }

  @Get('link/:paymentLink')
  async getByPaymentLink(@Param('paymentLink') paymentLink: string) {
    // Validate the token format
    if (!this.paymentLinkService.validateLinkToken(paymentLink)) {
      throw new ForbiddenException('Invalid payment link format');
    }

    const paymentRequest = await this.paymentRequestsService.findByPaymentLink(paymentLink);
    if (!paymentRequest) {
      throw new ForbiddenException('Payment link not found or expired');
    }

    // Check if link has expired
    if (paymentRequest.linkExpiresAt && this.paymentLinkService.isLinkExpired(paymentRequest.linkExpiresAt)) {
      throw new ForbiddenException('Payment link has expired');
    }

    return { statusCode: 200, data: paymentRequest };
  }

  @Patch(':id/upi-status')
  async updateUpiStatus(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
    @Body() body: { upiStatus: 'pending' | 'processing' | 'success' | 'failed' | 'expired'; amountPaid?: number },
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can update UPI status');
    }

    const paymentRequest = await this.paymentRequestsService.updateUpiStatus(
      +id,
      body.upiStatus,
      body.amountPaid,
    );
    return { statusCode: 200, data: paymentRequest };
  }

  @Post(':id/create-razorpay-link')
  async createRazorpayPaymentLink(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
  ) {
    if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
      throw new ForbiddenException('Only managers can create payment links');
    }

    const paymentRequest = await this.paymentRequestsService.findOne(+id);
    if (!paymentRequest) {
      throw new ForbiddenException('Payment request not found');
    }

    try {
      // Get user details for email and phone
      const userEmail = paymentRequest.distributor?.email || 'contact@omniordera.com';
      const userPhone = paymentRequest.distributor?.mobileNo || '+919999999999';

      const paymentLink = await this.razorpayService.createPaymentLink(
        Number(paymentRequest.amount),
        `Customer-${paymentRequest.order?.customerId}`,
        userEmail,
        userPhone,
        `Payment for Order #${paymentRequest.order?.orderNo || paymentRequest.orderId}`,
        `ORDER-${paymentRequest.orderId}`,
      );

      // Update payment request with Razorpay link
      await this.paymentRequestsService.updateUpiStatus(+id, 'pending');

      return {
        statusCode: 200,
        data: {
          id: paymentRequest.id,
          razorpayLinkId: paymentLink.linkId,
          shortUrl: paymentLink.shortUrl,
          upiLink: paymentLink.upiLink,
        },
      };
    } catch (error) {
      throw new ForbiddenException(`Failed to create payment link: ${error.message}`);
    }
  }

  @Post('webhooks/razorpay')
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<ExtendedRequest>,
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
  ) {
    // Verify webhook signature
    const body = req.rawBody?.toString() || JSON.stringify(payload);
    const isValid = this.razorpayService.verifyWebhookSignature(
      body,
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );

    if (!isValid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    // Handle different webhook events
    const event = payload.event;

    if (event === 'payment_link.paid' || event === 'payment.captured') {
      // Extract payment details
      const amount = payload.payload?.payment?.entity?.amount / 100 || 0; // Convert from paise
      const paymentId = payload.payload?.payment?.entity?.id;
      const reference = payload.payload?.payment?.entity?.notes?.orderId;

      // Find payment request by order ID
      if (reference) {
        const orderId = parseInt(reference.split('-')[1]);
        const paymentRequests = await this.paymentRequestsService.findByOrder(orderId);

        if (paymentRequests.length > 0) {
          const pr = paymentRequests[0];
          // Update payment request status to paid
          await this.paymentRequestsService.updateUpiStatus(pr.id, 'success', amount);
        }
      }
    } else if (event === 'payment_link.expired' || event === 'payment.failed') {
      // Mark as failed or expired
      const reference = payload.payload?.payment?.entity?.notes?.orderId;
      if (reference) {
        const orderId = parseInt(reference.split('-')[1]);
        const paymentRequests = await this.paymentRequestsService.findByOrder(orderId);

        if (paymentRequests.length > 0) {
          const pr = paymentRequests[0];
          await this.paymentRequestsService.updateUpiStatus(pr.id, 'failed');
        }
      }
    }

    return { statusCode: 200, data: { status: 'ok' } };
  }
}
