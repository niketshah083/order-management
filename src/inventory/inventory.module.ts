import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseEntity } from './entities/warehouse.entity';
import { InventoryLotEntity } from './entities/inventory-lot.entity';
import { InventorySerialEntity } from './entities/inventory-serial.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import { InventoryService } from './inventory.service';
import { InventoryCoreService } from './inventory-core.service';
import { InventoryController } from './inventory.controller';
import { InventoryEnterpriseController } from './inventory-enterprise.controller';
import { ProductTraceController } from './product-trace.controller';
import { CommonModule } from 'src/common/common.module';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { ItemEntity } from 'src/items/entities/item.entity';
import { BillingEntity } from 'src/billing/entities/billing.entity';
import { GrnEntity } from 'src/orders/entities/grn.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    TypeOrmModule.forFeature([
      // Enterprise inventory entities
      WarehouseEntity,
      InventoryLotEntity,
      InventorySerialEntity,
      InventoryTransactionEntity,
      // Related entities
      DistributorEntity,
      UserEntity,
      ItemEntity,
      BillingEntity,
      GrnEntity,
    ]),
  ],
  providers: [InventoryService, InventoryCoreService],
  controllers: [
    InventoryController,
    InventoryEnterpriseController,
    ProductTraceController,
  ],
  exports: [InventoryService, InventoryCoreService, TypeOrmModule],
})
export class InventoryModule {}
