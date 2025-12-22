import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseReturnEntity } from './entities/purchase-return.entity';
import { SalesReturnEntity } from './entities/sales-return.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { BillingEntity } from 'src/billing/entities/billing.entity';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { InventoryModule } from 'src/inventory/inventory.module';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseReturnEntity, SalesReturnEntity, DistributorEntity, BillingEntity]),
    InventoryModule,
    LedgerModule,
  ],
  providers: [ReturnsService],
  controllers: [ReturnsController],
  exports: [ReturnsService],
})
export class ReturnsModule {}
