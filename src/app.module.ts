import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { OrdersModule } from './orders/orders.module';
import { SharedModule } from './shared/shared.module';
import { JwtMiddleware } from './common/middleware/jwt.middleware';
import { UserEntity } from './users/entities/user.entity';
import { DistributorEntity } from './users/entities/distributor.entity';
import { ItemEntity } from './items/entities/item.entity';
import { OrderEntity } from './orders/entities/order.entity';
import { OrderItemEntity } from './orders/entities/order-item.entity';
import { WhatsappWebhookModule } from './whatsapp-webhook/whatsapp-webhook.module';
import { BillingModule } from './billing/billing.module';
import { CustomersModule } from './customers/customers.module';
import { InternalUsersModule } from './internal-users/internal-users.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';
import { ReturnsModule } from './returns/returns.module';
import { ReportsModule } from './reports/reports.module';
import { BillingEntity } from './billing/entities/billing.entity';
import { CustomerEntity } from './customers/entities/customer.entity';
import { InternalUserEntity } from './internal-users/entities/internal-user.entity';
import { PaymentRequestEntity } from './payment-requests/entities/payment-request.entity';
import { PurchaseReturnEntity } from './returns/entities/purchase-return.entity';
import { SalesReturnEntity } from './returns/entities/sales-return.entity';
import { CategoryEntity } from './categories/entities/category.entity';
import { CategoriesModule } from './categories/categories.module';
import { PurchaseOrderEntity } from './orders/entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from './orders/entities/purchase-order-item.entity';
import { GrnEntity } from './orders/entities/grn.entity';
import { GrnItemEntity } from './orders/entities/grn-item.entity';
import { GrnBatchDetailEntity } from './orders/entities/grn-batch-detail.entity';
import { LedgerModule } from './ledger/ledger.module';
import { DistributorLedgerEntity } from './ledger/ledger.entity';
import { CommonModule } from './common/common.module';
import { InventoryModule } from './inventory/inventory.module';
import { DistributorPaymentEntriesModule } from './distributor-payment-entries/distributor-payment-entries.module';
import { DistributorPaymentEntryEntity } from './distributor-payment-entries/entities/distributor-payment-entry.entity';
import { PincodesModule } from './pincodes/pincodes.module';
import { BillingBatchDetailEntity } from './billing/entities/billing-batch-detail.entity';
import { BillingItemEntity } from './billing/entities/billing-item.entity';
import { InternalUserDistributorEntity } from './internal-users/entities/internal-user-distributor.entity';
import { BatchTrackingModule } from './batch-tracking/batch-tracking.module';
import { ItemBatchEntity } from './inventory/entities/item-batch.entity';
// Enterprise Inventory Entities
import { WarehouseEntity } from './inventory/entities/warehouse.entity';
import { InventoryLotEntity } from './inventory/entities/inventory-lot.entity';
import { InventorySerialEntity } from './inventory/entities/inventory-serial.entity';
import { InventoryTransactionEntity } from './inventory/entities/inventory-transaction.entity';
// Payments Module
import { PaymentsModule } from './payments/payments.module';
import { PaymentEntity } from './payments/entities/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [
          UserEntity,
          DistributorEntity,
          ItemEntity,
          OrderEntity,
          OrderItemEntity,
          PurchaseOrderEntity,
          PurchaseOrderItemEntity,
          GrnEntity,
          GrnItemEntity,
          GrnBatchDetailEntity,
          BillingEntity,
          CustomerEntity,
          InternalUserEntity,
          PaymentRequestEntity,
          PurchaseReturnEntity,
          SalesReturnEntity,
          CategoryEntity,
          DistributorLedgerEntity,
          DistributorPaymentEntryEntity,
          BillingBatchDetailEntity,
          BillingItemEntity,
          InternalUserDistributorEntity,
          ItemBatchEntity,
          // New Enterprise Inventory Entities
          WarehouseEntity,
          InventoryLotEntity,
          InventorySerialEntity,
          InventoryTransactionEntity,
          // Payments
          PaymentEntity,
        ],
        synchronize: true,
        logging: true,
      }),
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    OrdersModule,
    SharedModule,
    WhatsappWebhookModule,
    BillingModule,
    CustomersModule,
    InternalUsersModule,
    PaymentRequestsModule,
    ReturnsModule,
    CategoriesModule,
    ReportsModule,
    LedgerModule,
    InventoryModule,
    DistributorPaymentEntriesModule,
    PincodesModule,
    BatchTrackingModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware)
      .exclude({ path: 'auth/login', method: RequestMethod.POST })
      .exclude({ path: 'auth/seed-test-data', method: RequestMethod.POST })
      .exclude({ path: 'orders/whatsapp', method: RequestMethod.POST })
      .exclude({ path: 'whatsapp-webhook', method: RequestMethod.ALL })
      .exclude({ path: 'pincodes/lookup', method: RequestMethod.GET })
      .exclude({ path: 'payments/webhook', method: RequestMethod.POST })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
