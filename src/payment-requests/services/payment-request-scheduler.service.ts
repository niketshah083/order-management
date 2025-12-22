import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { PaymentRequestEntity } from '../entities/payment-request.entity';
import { PurchaseOrderEntity } from '../../orders/entities/purchase-order.entity';
import { DistributorEntity } from '../../users/entities/distributor.entity';
import { PaymentLinkService } from './payment-link.service';

/**
 * Scheduler service for auto-triggering payment requests
 * Note: Actual cron scheduling can be added via OnModuleInit or through a dedicated scheduler module
 */
@Injectable()
export class PaymentRequestSchedulerService {
  private readonly logger = new Logger(PaymentRequestSchedulerService.name);

  constructor(
    @InjectRepository(PaymentRequestEntity)
    private paymentRequestRepository: Repository<PaymentRequestEntity>,
    @InjectRepository(PurchaseOrderEntity)
    private purchaseOrderRepository: Repository<PurchaseOrderEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
    private paymentLinkService: PaymentLinkService,
  ) {}

  /**
   * Auto-trigger payment requests
   * Creates payment requests for orders that have reached (creditLimitDays - 3)
   * This method should be called periodically (e.g., daily)
   */
  async autoTriggerPaymentRequests() {
    this.logger.log('[Payment Scheduler] Starting auto-trigger payment requests...');
    
    try {
      // Get all distributors with credit limit days
      const distributors = await this.distributorRepository.find();

      for (const distributor of distributors) {
        if (!distributor.creditLimitDays) continue;

        const creditLimitDays = distributor.creditLimitDays;
        const triggerDaysThreshold = creditLimitDays - 3;

        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - triggerDaysThreshold);

        this.logger.log(
          `[Payment Scheduler] Processing distributor ${distributor.id} - Credit Limit: ${creditLimitDays} days, Trigger Threshold: ${triggerDaysThreshold} days`,
        );

        // Find all purchase orders created before the cutoff date
        const oldOrders = await this.purchaseOrderRepository.find({
          where: {
            distributorId: distributor.id,
          },
        });

        const eligibleOrders = oldOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate <= cutoffDate && order.approvalStatus === 'approved';
        });

        for (const order of eligibleOrders) {
          // Check if payment request already exists for this order
          const existingRequest = await this.paymentRequestRepository.findOne({
            where: { orderId: order.id },
          });

          if (!existingRequest) {
            // Create auto-triggered payment request
            const paymentLink = this.paymentLinkService.generatePaymentLink();
            const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

            const newPaymentRequest = this.paymentRequestRepository.create({
              orderId: order.id,
              distributorId: distributor.id,
              amount: order.totalAmount,
              status: 'pending',
              paymentLink,
              linkExpiresAt,
              upiStatus: 'pending',
              isAutoTriggered: true,
            });

            await this.paymentRequestRepository.save(newPaymentRequest);
            this.logger.log(
              `[Payment Scheduler] Auto-triggered payment request for Order ${order.id} (Distributor ${distributor.id})`,
            );
          }
        }
      }

      this.logger.log('[Payment Scheduler] Auto-trigger payment requests completed successfully');
    } catch (error) {
      this.logger.error('[Payment Scheduler] Error in auto-trigger:', error);
    }
  }

  /**
   * Clean up expired payment links
   * This method should be called periodically (e.g., daily)
   */
  async cleanupExpiredLinks() {
    this.logger.log('[Payment Scheduler] Starting cleanup of expired payment links...');
    
    try {
      const now = new Date();

      const expiredRequests = await this.paymentRequestRepository.find({
        where: {
          upiStatus: 'pending',
        },
      });

      let expiredCount = 0;

      for (const request of expiredRequests) {
        if (request.linkExpiresAt && new Date(request.linkExpiresAt) < now) {
          request.upiStatus = 'expired';
          await this.paymentRequestRepository.save(request);
          expiredCount++;
        }
      }

      this.logger.log(`[Payment Scheduler] Marked ${expiredCount} payment requests as expired`);
    } catch (error) {
      this.logger.error('[Payment Scheduler] Error in cleanup:', error);
    }
  }
}
