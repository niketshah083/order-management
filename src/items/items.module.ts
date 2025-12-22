import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemEntity } from './entities/item.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { S3Service } from 'src/common/services/s3.service';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemEntity, DistributorEntity]),
    forwardRef(() => InventoryModule),
  ],
  providers: [ItemsService, S3Service],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
