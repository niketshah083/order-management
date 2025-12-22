import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributorPaymentEntryEntity } from './entities/distributor-payment-entry.entity';
import { CreateDistributorPaymentEntryDto, UpdateDistributorPaymentEntryStatusDto } from './dto/create-distributor-payment-entry.dto';
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class DistributorPaymentEntriesService {
  constructor(
    @InjectRepository(DistributorPaymentEntryEntity)
    private paymentEntryRepo: Repository<DistributorPaymentEntryEntity>,
    private ledgerService: LedgerService,
  ) {}

  async createPaymentEntry(
    distributorId: number,
    dto: CreateDistributorPaymentEntryDto,
    attachmentUrl?: string,
  ) {
    const entry = this.paymentEntryRepo.create({
      distributorId,
      paymentDate: new Date(dto.paymentDate),
      paymentMode: dto.paymentMode,
      amount: dto.amount,
      chequeNo: dto.chequeNo || null,
      description: dto.description || null,
      attachmentUrl: attachmentUrl || null,
      status: 'PENDING',
    });

    return await this.paymentEntryRepo.save(entry);
  }

  async getDistributorPaymentEntries(
    distributorId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const [data, totalCount] = await this.paymentEntryRepo.findAndCount({
      where: { distributorId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, totalCount };
  }

  async getAllPaymentEntries(page: number = 1, limit: number = 10) {
    const [data, totalCount] = await this.paymentEntryRepo.findAndCount({
      relations: ['distributor'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, totalCount };
  }

  async getPaymentEntryById(id: number) {
    const entry = await this.paymentEntryRepo.findOne({
      where: { id },
      relations: ['distributor', 'approverUser'],
    });

    if (!entry) {
      throw new NotFoundException('Payment entry not found');
    }

    return entry;
  }

  async approvePaymentEntry(
    id: number,
    approverUserId: number,
    dto: UpdateDistributorPaymentEntryStatusDto,
  ) {
    const entry = await this.getPaymentEntryById(id);

    if (entry.status !== 'PENDING') {
      throw new BadRequestException('Only pending entries can be approved/rejected');
    }

    entry.status = dto.status;
    entry.adminRemarks = dto.adminRemarks || null;
    entry.approvedBy = approverUserId;
    entry.approvedAt = new Date();

    const updated = await this.paymentEntryRepo.save(entry);

    // If approved, add ledger entry for PAYMENT
    if (dto.status === 'APPROVED') {
      await this.ledgerService.createEntry(
        entry.distributorId,
        'PAYMENT',
        entry.amount,
        `Payment received - ${entry.paymentMode}`,
        entry.id.toString(),
        'DISTRIBUTOR_PAYMENT_ENTRY',
        entry.id,
      );
    }

    return updated;
  }

  async getPendingPaymentEntries() {
    return await this.paymentEntryRepo.find({
      where: { status: 'PENDING' },
      relations: ['distributor'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPaymentEntriesByDistributorAndStatus(
    distributorId: number,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    return await this.paymentEntryRepo.find({
      where: { distributorId, status },
      order: { createdAt: 'DESC' },
    });
  }
}
