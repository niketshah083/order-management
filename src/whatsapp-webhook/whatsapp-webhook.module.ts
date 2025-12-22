import { Module } from '@nestjs/common';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { UsersModule } from 'src/users/users.module';
import { OrdersModule } from 'src/orders/orders.module';

@Module({
  imports: [UsersModule, OrdersModule],
  providers: [WhatsappWebhookService],
  controllers: [WhatsappWebhookController],
})
export class WhatsappWebhookModule {}
