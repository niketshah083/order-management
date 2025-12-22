import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentLinkService } from './services/payment-link.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { PurchaseOrderEntity } from 'src/orders/entities/purchase-order.entity';

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectRepository(PaymentRequestEntity)
    private paymentRequestRepository: Repository<PaymentRequestEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
    @InjectRepository(PurchaseOrderEntity)
    private purchaseOrderRepository: Repository<PurchaseOrderEntity>,
    private paymentLinkService: PaymentLinkService,
  ) {}

  async create(createPaymentRequestDto: CreatePaymentRequestDto) {
    // Generate payment link and expiration
    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    const paymentRequest = this.paymentRequestRepository.create({
      ...createPaymentRequestDto,
      amount: typeof createPaymentRequestDto.amount === 'string' 
        ? parseFloat(createPaymentRequestDto.amount) 
        : createPaymentRequestDto.amount,
      paymentLink,
      linkExpiresAt,
      upiStatus: 'pending',
      isAutoTriggered: false,
      paymentType: createPaymentRequestDto.paymentType || 'cash',
    });
    return await this.paymentRequestRepository.save(paymentRequest);
  }

  async findAll(status?: string, authorizedDistributorIds?: number[] | null) {
    const query = this.paymentRequestRepository.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.order', 'order')
      .leftJoinAndSelect('pr.billing', 'billing')
      .leftJoinAndSelect('pr.distributor', 'distributor');
    
    // Apply distributor filter based on authorized IDs
    // If authorizedDistributorIds is null, user is super_admin (see all)
    // If authorizedDistributorIds is array, filter by those IDs
    if (authorizedDistributorIds !== null && authorizedDistributorIds !== undefined) {
      query.where('pr.distributorId IN (:...distributorIds)', { 
        distributorIds: authorizedDistributorIds 
      });
    }
    
    if (status) {
      query.andWhere('pr.status = :status', { status });
    }
    
    return await query.orderBy('pr.createdAt', 'DESC').getMany();
  }

  async findOne(id: number) {
    return await this.paymentRequestRepository.findOne({
      where: { id },
      relations: ['order', 'billing', 'distributor'],
    });
  }

  async createForCreditBilling(billingId: number, distributorId: number, amount: number) {
    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    const paymentRequest = this.paymentRequestRepository.create({
      billingId,
      distributorId,
      amount,
      paymentLink,
      linkExpiresAt,
      upiStatus: 'pending',
      isAutoTriggered: false,
    });
    return await this.paymentRequestRepository.save(paymentRequest);
  }

  async createFromPurchaseOrder(orderId: number, distributorId: number, amount: number, reason?: string) {
    // Fetch the Purchase Order to validate it exists and verify the distributor
    const po = await this.purchaseOrderRepository.findOne({ 
      where: { id: orderId } 
    });
    if (!po) {
      throw new BadRequestException(`Purchase Order with ID ${orderId} not found`);
    }

    // CRITICAL: Validate that the provided distributorId matches the PO's actual distributor
    if (po.distributorId !== distributorId) {
      throw new BadRequestException(
        `Distributor ID mismatch: Purchase Order ${orderId} belongs to distributor ${po.distributorId}, ` +
        `but you provided distributor ${distributorId}`
      );
    }

    // Validate distributor exists
    const distributor = await this.distributorRepository.findOne({ where: { id: distributorId } });
    if (!distributor) {
      throw new BadRequestException(`Distributor with ID ${distributorId} not found`);
    }

    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    const paymentRequest = this.paymentRequestRepository.create({
      orderId,
      distributorId,
      amount,
      reason: reason || `Payment request for Purchase Order #${orderId}`,
      paymentLink,
      linkExpiresAt,
      upiStatus: 'pending',
      isAutoTriggered: false,
    });
    return await this.paymentRequestRepository.save(paymentRequest);
  }

  async createFromDistributor(distributorId: number, amount: number, reason?: string) {
    // Validate distributor exists
    const distributor = await this.distributorRepository.findOne({ where: { id: distributorId } });
    if (!distributor) {
      throw new BadRequestException(`Distributor with ID ${distributorId} not found`);
    }

    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    const paymentRequest = this.paymentRequestRepository.create({
      distributorId,
      amount,
      reason: reason || `Payment request for Distributor`,
      paymentLink,
      linkExpiresAt,
      upiStatus: 'pending',
      isAutoTriggered: false,
    });
    return await this.paymentRequestRepository.save(paymentRequest);
  }

  async updateStatus(id: number, status: 'pending' | 'paid' | 'rejected', reason?: string) {
    await this.paymentRequestRepository.update(id, { status, reason });
    return await this.findOne(id);
  }

  async findByOrder(orderId: number) {
    return await this.paymentRequestRepository.find({
      where: { orderId },
      relations: ['order', 'distributor'],
    });
  }

  async findByDistributor(distributorId: number, status?: string) {
    const query = this.paymentRequestRepository
      .createQueryBuilder('pr')
      .where('pr.distributorId = :distributorId', { distributorId })
      .leftJoinAndSelect('pr.order', 'order')
      .leftJoinAndSelect('pr.billing', 'billing')
      .leftJoinAndSelect('pr.distributor', 'distributor');

    if (status) {
      query.andWhere('pr.status = :status', { status });
    }

    return await query.orderBy('pr.createdAt', 'DESC').getMany();
  }

  async findByBilling(billingId: number) {
    return await this.paymentRequestRepository.findOne({
      where: { billingId },
      relations: ['billing', 'distributor'],
    });
  }

  async findByPaymentLink(paymentLink: string) {
    return await this.paymentRequestRepository.findOne({
      where: { paymentLink },
      relations: ['order', 'billing', 'distributor'],
    });
  }

  async updateUpiStatus(id: number, upiStatus: 'pending' | 'processing' | 'success' | 'failed' | 'expired', amountPaid?: number) {
    const updateData: any = { upiStatus };
    
    if (amountPaid !== undefined) {
      updateData.amountPaid = amountPaid;
    }
    
    if (upiStatus === 'success') {
      updateData.status = 'paid';
    }

    await this.paymentRequestRepository.update(id, updateData);
    return await this.findOne(id);
  }

  async createPaymentRequestForPurchaseOrder(
    purchaseOrderId: number,
    distributorId: number,
    amount: number,
    invoiceUrl?: string,
    reason?: string,
  ) {
    const paymentLink = this.paymentLinkService.generatePaymentLink();
    const linkExpiresAt = this.paymentLinkService.generateExpirationTime(7);

    const paymentRequest = this.paymentRequestRepository.create({
      purchaseOrderId,
      distributorId,
      amount,
      invoiceUrl,
      reason: reason || `Payment request for Purchase Order #${purchaseOrderId}`,
      paymentLink,
      linkExpiresAt,
      upiStatus: 'pending',
      isAutoTriggered: false,
    });
    return await this.paymentRequestRepository.save(paymentRequest);
  }

  async recordManualPayment(
    id: number,
    amountPaid: number,
    referenceNo: string,
    paymentDate?: Date,
    isOfflinePayment: boolean = true,
  ) {
    const paymentRequest = await this.findOne(id);
    if (!paymentRequest) {
      throw new BadRequestException(`Payment request with ID ${id} not found`);
    }

    const updateData: any = {
      amountPaid,
      manualPaymentReferenceNo: referenceNo,
      manualPaymentDate: paymentDate || new Date(),
      status: amountPaid >= paymentRequest.amount ? ('paid' as const) : ('pending' as const),
      upiStatus: 'success' as const,
      isOfflinePayment,
    };

    await this.paymentRequestRepository.update(id, updateData);
    return await this.findOne(id);
  }

  async getPendingAutoTriggeredRequests(distributorId?: number) {
    const query = this.paymentRequestRepository
      .createQueryBuilder('pr')
      .where('pr.isAutoTriggered = :isAutoTriggered', { isAutoTriggered: true })
      .andWhere('pr.status = :status', { status: 'pending' })
      .leftJoinAndSelect('pr.order', 'order')
      .leftJoinAndSelect('pr.distributor', 'distributor')
      .orderBy('pr.createdAt', 'DESC');

    if (distributorId) {
      query.andWhere('pr.distributorId = :distributorId', { distributorId });
    }

    return await query.getMany();
  }

  async getPastDueAmount(distributorId: number): Promise<number> {
    const pastDueRequests = await this.paymentRequestRepository
      .createQueryBuilder('pr')
      .where('pr.distributorId = :distributorId', { distributorId })
      .andWhere('pr.status = :status', { status: 'pending' })
      .andWhere('pr.linkExpiresAt < NOW()', {})
      .getMany();

    return pastDueRequests.reduce((sum, pr) => sum + parseFloat(pr.amount.toString()), 0);
  }

  async getPastDueDetails(distributorId: number): Promise<{ totalPastDue: number; count: number; details: any[] }> {
    const pastDueRequests = await this.paymentRequestRepository
      .createQueryBuilder('pr')
      .where('pr.distributorId = :distributorId', { distributorId })
      .andWhere('pr.status = :status', { status: 'pending' })
      .andWhere('pr.linkExpiresAt < NOW()', {})
      .leftJoinAndSelect('pr.order', 'order')
      .leftJoinAndSelect('pr.billing', 'billing')
      .orderBy('pr.linkExpiresAt', 'ASC')
      .getMany();

    const totalPastDue = pastDueRequests.reduce((sum, pr) => sum + parseFloat(pr.amount.toString()), 0);

    return {
      totalPastDue,
      count: pastDueRequests.length,
      details: pastDueRequests.map(pr => ({
        id: pr.id,
        amount: pr.amount,
        reason: pr.reason,
        expiredAt: pr.linkExpiresAt,
        orderId: pr.orderId,
        billingId: pr.billingId,
      })),
    };
  }
}
