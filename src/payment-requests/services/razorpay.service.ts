import { Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: Razorpay;

  constructor() {
    // Initialize Razorpay with API keys from environment
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  /**
   * Create a Razorpay order for payment collection
   */
  async createOrder(
    amount: number,
    receipt: string,
    notes: Record<string, any> = {},
  ): Promise<{ orderId: string; amount: number }> {
    try {
      const orderData = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt,
        notes: {
          ...notes,
          createdAt: new Date().toISOString(),
        },
      };

      const order = await this.razorpay.orders.create(orderData);
      this.logger.log(`Order created: ${order.id} for amount ${amount}`);

      return {
        orderId: order.id,
        amount,
      };
    } catch (error) {
      this.logger.error('Error creating Razorpay order:', error);
      throw error;
    }
  }

  /**
   * Create a payment link for UPI/Cards/NetBanking
   */
  async createPaymentLink(
    amount: number,
    customerId: string,
    customerEmail: string,
    customerPhone: string,
    description: string,
    orderId?: string,
  ): Promise<{ linkId: string; shortUrl: string; upiLink: boolean | string }> {
    try {
      const paymentLinkData = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        accept_partial: true,
        first_min_partial_amount: Math.round(amount * 100 * 0.1), // Allow 10% partial payment
        expire_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        reference_id: orderId || `REF-${Date.now()}`,
        description,
        customer: {
          name: customerId,
          email: customerEmail,
          contact: customerPhone,
        },
        notify: {
          sms: true,
          email: true,
        },
        reminder_enable: true,
        notes: {
          orderId,
          customerId,
        },
      };

      const paymentLink = await this.razorpay.paymentLink.create(paymentLinkData);
      
      this.logger.log(`Payment link created: ${paymentLink.id}`);

      return {
        linkId: paymentLink.id,
        shortUrl: paymentLink.short_url,
        upiLink: paymentLink.upi_link,
      };
    } catch (error) {
      this.logger.error('Error creating payment link:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature from Razorpay
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string = process.env.RAZORPAY_WEBHOOK_SECRET,
  ): boolean {
    if (!secret) {
      this.logger.warn('Webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      if (!isValid) {
        this.logger.warn('Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      this.logger.error(`Error fetching payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch order details from Razorpay
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error) {
      this.logger.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch payment link details
   */
  async getPaymentLink(linkId: string): Promise<any> {
    try {
      const paymentLink = await this.razorpay.paymentLink.fetch(linkId);
      return paymentLink;
    } catch (error) {
      this.logger.error(`Error fetching payment link ${linkId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a payment link
   */
  async cancelPaymentLink(linkId: string): Promise<any> {
    try {
      // Note: Razorpay API doesn't support direct cancellation via edit
      // Payment links expire automatically or can be tracked via status
      const paymentLink = await this.razorpay.paymentLink.fetch(linkId);
      return paymentLink;
    } catch (error) {
      this.logger.error(`Error fetching payment link ${linkId}:`, error);
      throw error;
    }
  }
}
