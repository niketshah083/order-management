import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PaymentEntity } from './entities/payment.entity';
import { BillingEntity } from '../billing/entities/billing.entity';
import {
  CreateRazorpayOrderDto,
  VerifyPaymentDto,
  RefundPaymentDto,
} from './dto/create-order.dto';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(BillingEntity)
    private billingRepository: Repository<BillingEntity>,
    private configService: ConfigService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (keyId && keySecret) {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
  }

  // Get Razorpay Key ID for frontend
  getKeyId(): string {
    return this.configService.get<string>('RAZORPAY_KEY_ID') || '';
  }

  // Create Razorpay Order
  async createOrder(dto: CreateRazorpayOrderDto, distributorId?: number) {
    if (!this.razorpay) {
      throw new BadRequestException(
        'Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables.',
      );
    }

    // Validate billing exists
    const billing = await this.billingRepository.findOne({
      where: { id: dto.billingId },
      relations: ['customer'],
    });

    if (!billing) {
      throw new NotFoundException(`Billing #${dto.billingId} not found`);
    }

    // Amount in paise (Razorpay requires smallest currency unit)
    const amountInPaise = Math.round(dto.amount * 100);

    try {
      // Create Razorpay order
      const razorpayOrder = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: dto.currency || 'INR',
        receipt: `billing_${dto.billingId}_${Date.now()}`,
        notes: {
          billingId: dto.billingId.toString(),
          billNo: billing.billNo || '',
          customerName: billing.customer
            ? `${billing.customer.firstname || ''} ${billing.customer.lastname || ''}`.trim()
            : '',
        },
      });

      // Save payment record
      const payment = this.paymentRepository.create({
        billingId: dto.billingId,
        distributorId: distributorId || billing.distributorId,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        razorpayOrderId: razorpayOrder.id,
        status: 'created',
        email: dto.email || billing.customer?.emailId,
        contact: dto.contact || billing.customer?.mobileNo,
        metadata: {
          razorpayOrderResponse: razorpayOrder,
        },
      });

      await this.paymentRepository.save(payment);

      return {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: dto.currency || 'INR',
        keyId: this.getKeyId(),
        paymentId: payment.id,
        billing: {
          id: billing.id,
          billNo: billing.billNo,
          finalAmount: billing.finalAmount,
          customerName: billing.customer
            ? `${billing.customer.firstname || ''} ${billing.customer.lastname || ''}`.trim()
            : '',
          customerEmail: billing.customer?.emailId,
          customerContact: billing.customer?.mobileNo,
        },
      };
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw new BadRequestException(
        `Failed to create payment order: ${error.message}`,
      );
    }
  }

  // Verify Payment Signature
  async verifyPayment(dto: VerifyPaymentDto) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured');
    }

    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    // Find payment record
    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId: dto.razorpayOrderId },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment with order ID ${dto.razorpayOrderId} not found`,
      );
    }

    // Verify signature
    const body = dto.razorpayOrderId + '|' + dto.razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret!)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === dto.razorpaySignature;

    if (isValid) {
      // Fetch payment details from Razorpay
      try {
        const razorpayPayment = await this.razorpay.payments.fetch(
          dto.razorpayPaymentId,
        );

        // Update payment record
        payment.razorpayPaymentId = dto.razorpayPaymentId;
        payment.razorpaySignature = dto.razorpaySignature;
        payment.status = 'captured';
        payment.paymentMethod = razorpayPayment.method;
        payment.bank = razorpayPayment.bank;
        payment.wallet = razorpayPayment.wallet;
        payment.vpa = razorpayPayment.vpa;
        payment.metadata = {
          ...payment.metadata,
          razorpayPaymentResponse: razorpayPayment,
        };

        await this.paymentRepository.save(payment);

        // Update billing payment status
        await this.updateBillingPaymentStatus(
          payment.billingId,
          payment.amount,
        );

        return {
          success: true,
          message: 'Payment verified successfully',
          payment: {
            id: payment.id,
            amount: payment.amount,
            status: payment.status,
            method: payment.paymentMethod,
            razorpayPaymentId: payment.razorpayPaymentId,
          },
        };
      } catch (error) {
        console.error('Failed to fetch Razorpay payment details:', error);
        // Still mark as captured if signature is valid
        payment.razorpayPaymentId = dto.razorpayPaymentId;
        payment.razorpaySignature = dto.razorpaySignature;
        payment.status = 'captured';
        await this.paymentRepository.save(payment);

        await this.updateBillingPaymentStatus(
          payment.billingId,
          payment.amount,
        );

        return {
          success: true,
          message: 'Payment verified successfully',
          payment: {
            id: payment.id,
            amount: payment.amount,
            status: payment.status,
          },
        };
      }
    } else {
      // Mark payment as failed
      payment.status = 'failed';
      payment.errorCode = 'SIGNATURE_MISMATCH';
      payment.errorDescription = 'Payment signature verification failed';
      await this.paymentRepository.save(payment);

      throw new BadRequestException('Payment verification failed');
    }
  }

  // Handle payment failure
  async handlePaymentFailure(
    razorpayOrderId: string,
    errorCode: string,
    errorDescription: string,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId },
    });

    if (payment) {
      payment.status = 'failed';
      payment.errorCode = errorCode;
      payment.errorDescription = errorDescription;
      await this.paymentRepository.save(payment);
    }

    return { success: true, message: 'Payment failure recorded' };
  }

  // Refund payment
  async refundPayment(dto: RefundPaymentDto) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment #${dto.paymentId} not found`);
    }

    if (payment.status !== 'captured') {
      throw new BadRequestException('Only captured payments can be refunded');
    }

    if (!payment.razorpayPaymentId) {
      throw new BadRequestException('No Razorpay payment ID found');
    }

    const refundAmount = dto.amount || payment.amount;
    const refundAmountInPaise = Math.round(refundAmount * 100);

    try {
      const refund = await this.razorpay.payments.refund(
        payment.razorpayPaymentId,
        {
          amount: refundAmountInPaise,
          notes: {
            reason: dto.reason || 'Customer requested refund',
          },
        },
      );

      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = refundAmount;
      payment.refundedAt = new Date();
      payment.metadata = {
        ...payment.metadata,
        refundResponse: refund,
      };

      await this.paymentRepository.save(payment);

      // Update billing payment status
      await this.updateBillingAfterRefund(payment.billingId, refundAmount);

      return {
        success: true,
        message: 'Refund processed successfully',
        refund: {
          id: refund.id,
          amount: refundAmount,
          status: refund.status,
        },
      };
    } catch (error) {
      console.error('Refund failed:', error);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  // Get payment by ID
  async findOne(id: number) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['billing', 'billing.customer'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment #${id} not found`);
    }

    return payment;
  }

  // Get payments for a billing
  async findByBilling(billingId: number) {
    return this.paymentRepository.find({
      where: { billingId },
      order: { createdAt: 'DESC' },
    });
  }

  // Get all payments for distributor
  async findAll(distributorId?: number, status?: string) {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.billing', 'billing')
      .leftJoinAndSelect('billing.customer', 'customer')
      .orderBy('payment.createdAt', 'DESC');

    if (distributorId) {
      query.andWhere('payment.distributorId = :distributorId', {
        distributorId,
      });
    }

    if (status) {
      query.andWhere('payment.status = :status', { status });
    }

    return query.getMany();
  }

  // Update billing payment status after successful payment
  private async updateBillingPaymentStatus(billingId: number, amount: number) {
    const billing = await this.billingRepository.findOne({
      where: { id: billingId },
    });

    if (billing) {
      const newAmountPaid =
        parseFloat(billing.amountPaid?.toString() || '0') + amount;
      const finalAmount = parseFloat(billing.finalAmount?.toString() || '0');

      billing.amountPaid = newAmountPaid;
      billing.amountDue = Math.max(0, finalAmount - newAmountPaid);

      if (newAmountPaid >= finalAmount) {
        billing.paymentStatus = 'completed';
      } else if (newAmountPaid > 0) {
        billing.paymentStatus = 'partial';
      }

      await this.billingRepository.save(billing);
    }
  }

  // Update billing after refund
  private async updateBillingAfterRefund(
    billingId: number,
    refundAmount: number,
  ) {
    const billing = await this.billingRepository.findOne({
      where: { id: billingId },
    });

    if (billing) {
      const newAmountPaid =
        parseFloat(billing.amountPaid?.toString() || '0') - refundAmount;
      const finalAmount = parseFloat(billing.finalAmount?.toString() || '0');

      billing.amountPaid = Math.max(0, newAmountPaid);
      billing.amountDue = finalAmount - billing.amountPaid;

      if (billing.amountPaid <= 0) {
        billing.paymentStatus = 'pending';
      } else if (billing.amountPaid < finalAmount) {
        billing.paymentStatus = 'partial';
      }

      await this.billingRepository.save(billing);
    }
  }
}
