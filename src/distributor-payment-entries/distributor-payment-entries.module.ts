import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorPaymentEntryEntity } from './entities/distributor-payment-entry.entity';
import { DistributorPaymentEntriesService } from './distributor-payment-entries.service';
import { DistributorPaymentEntriesController } from './distributor-payment-entries.controller';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DistributorPaymentEntryEntity]),
    LedgerModule,
  ],
  providers: [DistributorPaymentEntriesService],
  controllers: [DistributorPaymentEntriesController],
  exports: [DistributorPaymentEntriesService],
})
export class DistributorPaymentEntriesModule {}
