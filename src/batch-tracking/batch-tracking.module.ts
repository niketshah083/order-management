import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemBatchEntity } from '../inventory/entities/item-batch.entity';
import { BatchTrackingService } from './batch-tracking.service';
import { BatchTrackingController } from './batch-tracking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemBatchEntity]),
  ],
  providers: [BatchTrackingService],
  controllers: [BatchTrackingController],
  exports: [BatchTrackingService],
})
export class BatchTrackingModule {}
