import { Injectable } from '@nestjs/common';
import { WhatsappUtils } from 'src/common/utilities/whatsapp.utils';
import { OrdersService } from 'src/orders/orders.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class WhatsappWebhookService {
  constructor(
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
  ) {}

  async onReceivedMessage(changes: any) {
    switch (changes.field) {
      case 'messages':
        const message = changes.value.messages?.[0];
        if (message) {
          const fromMobileNo: string = message.from;
          switch (message.type) {
            case 'text':
              {
                const userInfo = await this.usersService.findByMobile(
                  fromMobileNo.slice(-10),
                );
                await WhatsappUtils.setTypingIndicator(message.id);
                if (userInfo) {
                  if (userInfo.role === 'super_admin') {
                    const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
                    await WhatsappUtils.sendDefaultSelectionListForAdmin(
                      message.from,
                      fullName,
                    );
                  }
                  this.onOrderMessageReceived(+fromMobileNo);
                } else {
                  await WhatsappUtils.sendTextMessage(
                    message.from,
                    `Sorry, you are not registered with us!`,
                  );
                }
              }
              break;
            case 'interactive':
              {
                await this.onInteractiveMessageReceived(message);
              }
              break;
            default:
              break;
          }
        }
        break;
      default:
        break;
    }
  }

  async onOrderMessageReceived(fromMobileNo: number) {
    await WhatsappUtils.sendOrderFlow(fromMobileNo);
  }

  async onInteractiveMessageReceived(message: any) {
    if (message.interactive) {
      switch (message.interactive.type) {
        case 'list_reply':
          {
            const userInfo = await this.usersService.findByMobile(
              message.from.slice(-10),
            );
            if (!userInfo) {
              await WhatsappUtils.sendTextMessage(
                message.from,
                `Sorry, you are not registered with us!`,
              );
            }
            const replyId = message.interactive.list_reply.id;
            console.log('ReplyId: ', replyId);
            switch (replyId) {
              case 'recent_orders':
                await WhatsappUtils.setTypingIndicator(message.id);
                const lastFivePendingOrders =
                  await this.ordersService.fetchLastFivePendingOrders();
                if (lastFivePendingOrders?.length) {
                  await WhatsappUtils.sendLastFivePendingOrderList(
                    message.from,
                    lastFivePendingOrders,
                  );
                } else {
                  await WhatsappUtils.sendTextMessage(
                    message.from,
                    'No orders found!',
                  );
                }
                break;
              default:
                if (replyId.includes('ORD-')) {
                  await WhatsappUtils.setTypingIndicator(message.id);
                  const orderInfo =
                    await this.ordersService.fetchOrderInfoByOrderNo(replyId);
                  if (orderInfo) {
                    await WhatsappUtils.sendOrderDetails(
                      message.from,
                      orderInfo,
                    );
                  } else {
                    await WhatsappUtils.sendTextMessage(
                      message.from,
                      `No order found by order no ${replyId}!`,
                    );
                  }
                }
                break;
            }
          }
          break;
        case 'nfm_reply':
          const resData = JSON.parse(
            message.interactive.nfm_reply.response_json,
          );
          await WhatsappUtils.setTypingIndicator(message.id);
          const orderInfo = await this.ordersService.fetchOrderInfoByOrderNo(
            resData.order_number,
          );
          if (orderInfo) {
            await WhatsappUtils.sendOrderDetails(message.from, orderInfo);
          } else {
            await WhatsappUtils.sendTextMessage(
              message.from,
              `No order found by order no ${resData.order_number}!`,
            );
          }
          break;
        default:
          break;
      }
    }
  }
}
