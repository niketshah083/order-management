export class RazorpayWebhookDto {
  event: string;
  created_at: number;
  payload: {
    payment: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        description?: string;
        order_id?: string;
        customer_id?: string;
        invoice_id?: string;
        international?: boolean;
        amount_refunded?: number;
        refund_status?: string;
        captured?: boolean;
        card_id?: string;
        bank?: string;
        wallet?: string;
        vpa?: string;
        email?: string;
        contact?: string;
        notes?: any;
        fee?: number;
        tax?: number;
        error_code?: string;
        error_description?: string;
        error_source?: string;
        error_reason?: string;
        error_step?: string;
        error_field?: string;
        acquirer_data?: {
          auth_code?: string;
          rrn?: string;
        };
        created_at?: number;
      };
    };
    order?: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        currency: string;
        receipt: string;
        offer_id?: string;
        status: string;
        attempts: number;
        notes?: any;
        created_at?: number;
      };
    };
  };
}

export class RazorpayPaymentSuccessEvent {
  event: 'payment.authorized' | 'payment.failed' | 'payment.captured';
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}
