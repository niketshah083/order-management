import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PaymentLinkService {
  /**
   * Generate a unique payment link token
   */
  generatePaymentLink(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate expiration time (default: 7 days from now)
   */
  generateExpirationTime(daysFromNow: number = 7): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysFromNow);
    return expiresAt;
  }

  /**
   * Check if payment link has expired
   */
  isLinkExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Generate payment link URLs
   */
  generatePaymentLinkUrls(paymentLink: string, baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:5000') {
    return {
      customerLink: `${baseUrl}/payment/${paymentLink}?type=customer`,
      distributorLink: `${baseUrl}/payment/${paymentLink}?type=distributor`,
    };
  }

  /**
   * Validate payment link token format
   */
  validateLinkToken(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }
}
