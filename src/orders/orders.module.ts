import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from './entities/purchase-order-item.entity';
import { GrnEntity } from './entities/grn.entity';
import { GrnItemEntity } from './entities/grn-item.entity';
import { GrnBatchDetailEntity } from './entities/grn-batch-detail.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { GrnService } from './grn.service';
import { GrnController } from './grn.controller';
import { ItemEntity } from 'src/items/entities/item.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { CustomerEntity } from 'src/customers/entities/customer.entity';
import { SharedModule } from 'src/shared/shared.module';
import { CommonModule } from 'src/common/common.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    CommonModule,
    SharedModule,
    UsersModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      PurchaseOrderEntity,
      PurchaseOrderItemEntity,
      GrnEntity,
      GrnItemEntity,
      GrnBatchDetailEntity,
      ItemEntity,
      UserEntity,
      DistributorEntity,
      CustomerEntity,
    ]),
    InventoryModule,
    LedgerModule,
  ],
  providers: [OrdersService, PurchaseOrdersService, GrnService],
  controllers: [OrdersController, PurchaseOrdersController, GrnController],
  exports: [OrdersService, PurchaseOrdersService, GrnService],
})
export class OrdersModule {}
