import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemBatchEntity } from '../inventory/entities/item-batch.entity';

@Injectable()
export class BatchTrackingService {
  constructor(
    @InjectRepository(ItemBatchEntity)
    private itemBatchRepository: Repository<ItemBatchEntity>,
  ) {}

  /**
   * Get complete traceability for a specific batch
   */
  async getBatchDetails(batchNumber: string) {
    const batch = await this.itemBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.item', 'item')
      .leftJoin('distributor', 'dist', 'dist.id = batch.distributor_id')
      .addSelect(['dist.id', 'dist.name', 'dist.city', 'dist.state'])
      .where('batch.batch_number = :batchNumber', { batchNumber })
      .getOne();

    if (!batch) {
      throw new NotFoundException(`Batch ${batchNumber} not found`);
    }

    const daysToExpiry = this.calculateDaysToExpiry(batch.expiryDate);
    const percentageUsed = batch.receivedQty > 0 
      ? (Number(batch.issuedQty) / Number(batch.receivedQty)) * 100 
      : 0;

    return {
      batchNumber: batch.batchNumber,
      item: {
        id: batch.itemId,
        name: batch.item?.name || 'Unknown',
      },
      quantities: {
        received: Number(batch.receivedQty),
        issued: Number(batch.issuedQty),
        available: Number(batch.availableQty),
        reserved: Number(batch.reservedQty),
        percentageUsed: Math.round(percentageUsed * 100) / 100,
      },
      dates: {
        manufacture: batch.manufactureDate || null,
        expiry: batch.expiryDate || null,
        daysToExpiry,
      },
      location: {
        distributorId: batch.distributorId || null,
        distributorName: (batch as any).dist?.name || 'N/A',
        city: (batch as any).dist?.city || 'N/A',
        state: (batch as any).dist?.state || 'N/A',
        warehouseId: batch.warehouseId || null,
      },
      status: {
        isBlocked: !!batch.isBlocked,
        isExpired: !!batch.isExpired,
        overall: this.getStatus(batch, daysToExpiry),
      },
    };
  }

  /**
   * Get all batches for a distributor
   */
  async getDistributorBatches(distributorId: number) {
    const batches = await this.itemBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.item', 'item')
      .where('batch.distributor_id = :distributorId', { distributorId })
      .getMany();

    if (batches.length === 0) {
      return {
        distributorId,
        batches: [],
        summary: {
          totalBatches: 0,
          totalAvailable: 0,
          expiringCount: 0,
          expiredCount: 0,
          blockedCount: 0,
        },
      };
    }

    const batchList = batches.map(batch => {
      const daysToExpiry = this.calculateDaysToExpiry(batch.expiryDate);
      return {
        batchNumber: batch.batchNumber,
        itemName: batch.item?.name || 'Unknown',
        receivedQty: Number(batch.receivedQty),
        issuedQty: Number(batch.issuedQty),
        availableQty: Number(batch.availableQty),
        expiryDate: batch.expiryDate,
        daysToExpiry,
        status: this.getStatus(batch, daysToExpiry),
      };
    });

    return {
      distributorId,
      batches: batchList,
      summary: {
        totalBatches: batches.length,
        totalAvailable: batchList.reduce((sum, b) => sum + b.availableQty, 0),
        expiringCount: batchList.filter(b => b.status === 'EXPIRING_SOON').length,
        expiredCount: batchList.filter(b => b.status === 'EXPIRED').length,
        blockedCount: batchList.filter(b => b.status === 'BLOCKED').length,
      },
    };
  }

  /**
   * Get all batches (admin view)
   */
  async getAllBatches() {
    const batches = await this.itemBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.item', 'item')
      .leftJoin('distributor', 'dist', 'dist.id = batch.distributor_id')
      .addSelect(['dist.id', 'dist.name', 'dist.city', 'dist.state'])
      .getMany();

    const batchList = batches.map(batch => {
      const daysToExpiry = this.calculateDaysToExpiry(batch.expiryDate);
      return {
        batchNumber: batch.batchNumber,
        itemName: batch.item?.name || 'Unknown',
        distributorName: (batch as any).dist?.name || 'N/A',
        location: `${(batch as any).dist?.city || ''}, ${(batch as any).dist?.state || ''}`.trim() || 'N/A',
        receivedQty: Number(batch.receivedQty),
        issuedQty: Number(batch.issuedQty),
        availableQty: Number(batch.availableQty),
        expiryDate: batch.expiryDate,
        daysToExpiry,
        status: this.getStatus(batch, daysToExpiry),
      };
    });

    return {
      totalBatches: batches.length,
      totalDistributors: new Set(batches.map(b => b.distributorId).filter(id => id)).size,
      batches: batchList,
    };
  }

  /**
   * Get expiring batches
   */
  async getExpiringBatches(daysThreshold: number = 30, distributorId?: number) {
    let query = this.itemBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.item', 'item')
      .leftJoin('distributor', 'dist', 'dist.id = batch.distributor_id')
      .addSelect(['dist.id', 'dist.name'])
      .where('batch.available_qty > 0')
      .andWhere('batch.expiry_date IS NOT NULL')
      .andWhere('batch.is_blocked = 0');

    if (distributorId) {
      query = query.andWhere('batch.distributor_id = :distributorId', { distributorId });
    }

    const batches = await query.getMany();

    return batches
      .map(batch => {
        const daysToExpiry = this.calculateDaysToExpiry(batch.expiryDate);
        return {
          batchNumber: batch.batchNumber,
          itemName: batch.item?.name || 'Unknown',
          distributorName: (batch as any).dist?.name || 'N/A',
          availableQty: Number(batch.availableQty),
          expiryDate: batch.expiryDate,
          daysToExpiry,
          urgency: daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry <= 7 ? 'CRITICAL' : daysToExpiry <= 15 ? 'HIGH' : 'MEDIUM',
        };
      })
      .filter(b => b.daysToExpiry <= daysThreshold)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }

  private calculateDaysToExpiry(expiryDate: string): number {
    if (!expiryDate) return 999;
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getStatus(batch: ItemBatchEntity, daysToExpiry: number): string {
    if (batch.isBlocked) return 'BLOCKED';
    if (Number(batch.availableQty) === 0) return 'SOLD_OUT';
    if (batch.isExpired || daysToExpiry < 0) return 'EXPIRED';
    if (daysToExpiry <= 30) return 'EXPIRING_SOON';
    return 'ACTIVE';
  }
}
