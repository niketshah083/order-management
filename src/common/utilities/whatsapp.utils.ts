import { OrderEntity } from 'src/orders/entities/order.entity';
import WhatsApp from 'whatsapp';

let wa: WhatsApp | null = null;

function getWhatsAppInstance(): WhatsApp | null {
  if (wa) return wa;
  
  try {
    wa = new WhatsApp();
    return wa;
  } catch (error) {
    console.warn('WhatsApp not configured, skipping initialization:', error.message);
    return null;
  }
}

export class WhatsappUtils {
  static async sendTextMessage(toMobileNo: number, textMsg: string) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send message');
      return;
    }
    
    try {
      await whatsapp.messages.text(
        {
          body: textMsg,
        },
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sendTextMessage:',
        error.response?.data || error.message,
      );
    }
  }

  static async setTypingIndicator(receivedMessageId: string) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot set typing indicator');
      return;
    }
    
    try {
      await whatsapp.messages.status({
        status: 'read',
        message_id: receivedMessageId,
        typing_indicator: {
          type: 'text',
        },
      } as any);
    } catch (error) {
      console.error(
        'Error sending typing indicator:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendOrderFlow(toMobileNo: number) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send order flow');
      return;
    }
    
    try {
      await whatsapp.messages.interactive(
        {
          type: 'flow',
          header: {
            type: 'text',
            text: 'Order',
          },
          body: {
            text: 'Check out exciting products and order in just 2 step!',
          },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_action: 'data_exchange',
              flow_token: `order_submitted~${String(toMobileNo).slice(-10)}`,
              flow_id: '701218376374461',
              flow_cta: 'Order Now!',
            },
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending invoice carousel:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendDefaultSelectionListForAdmin(
    toMobileNo: number,
    customerName: string,
  ) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send selection list');
      return;
    }
    
    try {
      await whatsapp.messages.interactive(
        {
          type: 'list',
          header: {
            type: 'text',
            text: `Welcome ${customerName}`,
          },
          body: {
            text: 'What do you want from us?',
          },
          footer: {
            text: 'Powered by Accomation',
          },
          action: {
            button: 'Choose Option',
            sections: [
              {
                title: 'Reports',
                rows: [
                  {
                    id: 'recent_orders',
                    title: 'Recent Pending Orders',
                    description: 'Get your recent pending orders',
                  },
                ],
              },
            ],
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending list message:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendLastFivePendingOrderList(
    toMobileNo: number,
    lastFivePendingOrders: OrderEntity[],
  ) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send order list');
      return;
    }
    
    try {
      const rows = lastFivePendingOrders.map((o) => ({
        id: `${o.orderNo}`,
        title: `${o.orderNo}`,
        description: `₹${Number(o.totalAmount).toFixed(2)} • Delivery: ${o.deliveryWindow} • Created: ${new Date(
          o.createdAt,
        ).toLocaleDateString('en-IN')}`,
      }));

      console.log('rows :: ', rows);
      console.log('toMobileNo :: ', toMobileNo);

      await whatsapp.messages.interactive(
        {
          type: 'list',
          header: {
            type: 'text',
            text: `Pending Orders (${rows.length})`,
          },
          body: {
            text: `Here are your latest pending orders. Select one to view details.`,
          },
          footer: {
            text: 'Powered by Accomation',
          },
          action: {
            button: 'View Orders',
            sections: [
              {
                title: 'Last Pending Orders',
                rows,
              },
            ],
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending pending order list:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendOrderDetails(toMobileNo: number, orderInfo: OrderEntity) {
    try {
      if (!orderInfo) {
        await this.sendTextMessage(toMobileNo, 'Order not found.');
        return;
      }

      const items = orderInfo.orderItems || [];

      if (items.length === 0) {
        await this.sendTextMessage(
          toMobileNo,
          `Order ${orderInfo.orderNo} found but no items available.`,
        );
        return;
      }

      // Format items
      const itemLines = items
        .map(
          (i) =>
            `• ${i.item?.name} • ${i.qty} × ₹${Number(i.rate).toFixed(2)} = ₹${Number(
              i.amount,
            ).toFixed(2)}`,
        )
        .join('\n');

      const customerName = orderInfo.customer 
        ? `${orderInfo.customer.firstName} ${orderInfo.customer.lastName}` 
        : 'N/A';

      const message = `
🧾 *Order Details*

*Order No:* ${orderInfo.orderNo}
*Delivery Window:* ${orderInfo.deliveryWindow}
*Total Amount:* ₹${Number(orderInfo.totalAmount).toFixed(2)}
*Created At:* ${new Date(orderInfo.createdAt).toLocaleString('en-IN')}
*Customer:* ${customerName}

📦 *Items:*
${itemLines}

Thank you for ordering with us 🙏
    `.trim();

      await this.sendTextMessage(toMobileNo, message);
    } catch (error) {
      console.error(
        'Error sending order details:',
        error.response?.data || error.message,
      );
    }
  }
}
