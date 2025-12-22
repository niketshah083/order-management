import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { BillingEntity } from 'src/billing/entities/billing.entity';
import { OrderEntity } from 'src/orders/entities/order.entity';
import { OrderItemEntity } from 'src/orders/entities/order-item.entity';
import { PurchaseOrderEntity } from 'src/orders/entities/purchase-order.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { CustomerEntity } from 'src/customers/entities/customer.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingEntity,
      OrderEntity,
      OrderItemEntity,
      PurchaseOrderEntity,
      UserEntity,
      DistributorEntity,
      CustomerEntity,
    ]),
    UsersModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
