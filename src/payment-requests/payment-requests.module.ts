import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentLinkService } from './services/payment-link.service';
import { PaymentRequestSchedulerService } from './services/payment-request-scheduler.service';
import { RazorpayService } from './services/razorpay.service';
import { PurchaseOrderEntity } from '../orders/entities/purchase-order.entity';
import { DistributorEntity } from '../users/entities/distributor.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([PaymentRequestEntity, PurchaseOrderEntity, DistributorEntity, UserEntity]),
  ],
  providers: [PaymentRequestsService, PaymentLinkService, PaymentRequestSchedulerService, RazorpayService],
  controllers: [PaymentRequestsController],
  exports: [PaymentRequestsService, PaymentLinkService, RazorpayService],
})
export class PaymentRequestsModule {}
