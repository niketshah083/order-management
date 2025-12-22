import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingEntity } from './entities/billing.entity';
import { BillingItemEntity } from './entities/billing-item.entity';
import { BillingBatchDetailEntity } from './entities/billing-batch-detail.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PaymentRequestsModule } from 'src/payment-requests/payment-requests.module';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { CommonModule } from 'src/common/common.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      BillingEntity,
      BillingItemEntity,
      BillingBatchDetailEntity,
      DistributorEntity,
    ]),
    PaymentRequestsModule,
    InventoryModule,
  ],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
