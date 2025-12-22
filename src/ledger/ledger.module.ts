import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorLedgerEntity } from './ledger.entity';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { GrnEntity } from 'src/orders/entities/grn.entity';
import { DistributorPaymentEntryEntity } from 'src/distributor-payment-entries/entities/distributor-payment-entry.entity';
import { PurchaseReturnEntity } from 'src/returns/entities/purchase-return.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DistributorLedgerEntity, DistributorEntity, GrnEntity, DistributorPaymentEntryEntity, PurchaseReturnEntity])],
  providers: [LedgerService],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
