import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemEntity } from './entities/item.entity';
import { S3Service } from 'src/common/services/s3.service';
import { GetAllItemDto } from './dto/get-all-item.dto';
import { responseMessage } from 'src/common/utilities/responseMessages.utils';
import { CommonUtils } from 'src/common/utilities/common.utils';
import { Request } from 'express';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { InventoryCoreService } from 'src/inventory/inventory-core.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly s3Service: S3Service,

    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,

    @Inject(forwardRef(() => InventoryCoreService))
    private readonly inventoryCoreService: InventoryCoreService,
  ) {}

  async bulkImportItems(data: any[], userId: number) {
    const results = { success: 0, failed: 0, errors: [] };

    for (const row of data) {
      try {
        const item = this.itemRepository.create({
          name: row.name || '',
          unit: row.unit || 'pcs',
          rate: row.rate || 0,
          qty: row.qty || 0,
          alterQty: 0,
          hsn: row.hsn || '',
          sac: row.sac || '',
          gstRate: row.gstRate || 18,
          sku: row.sku || '',
          description: row.description || '',
          createdByIp: '127.0.0.1',
          createdBy: userId,
        });
        await this.itemRepository.save(item);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row error: ${error.message}`);
      }
    }

    return results;
  }

  async findAll(getAllItemDto: GetAllItemDto) {
    const {
      limit,
      page,
      searchName,
      searchUnit,
      categoryId,
      sortBy,
      sortOrder,
    } = getAllItemDto;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoin('item.createdByUser', 'createdByUser')
      .leftJoin('item.updatedByUser', 'updatedByUser')
      .leftJoin('item.category', 'category')
      .select([
        'item.id',
        'item.name',
        'item.unit',
        'item.rate',
        'item.qty',
        'item.assets',
        'item.isDisabled',
        'item.categoryId',
        'category.id as categoryId',
        'category.name as categoryName',
        'item.createdAt',
        'item.updatedAt',
        'createdByUser.id as createdByUserId',
        'createdByUser.firstName as createdByUserFirstName',
        'createdByUser.lastName as createdByUserLastName',
        'updatedByUser.id as updatedByUserId',
        'updatedByUser.firstName as updatedByUserFirstName',
        'updatedByUser.lastName as updatedByUserLastName',
      ]);

    if (searchName) {
      queryBuilder.andWhere('item.name LIKE :searchName', {
        searchName: `%${searchName}%`,
      });
    }

    if (searchUnit) {
      queryBuilder.andWhere('item.unit LIKE :searchUnit', {
        searchUnit: `%${searchUnit}%`,
      });
    }

    if (categoryId) {
      queryBuilder.andWhere('item.categoryId = :categoryId', {
        categoryId: +categoryId,
      });
    }

    const sortableColumns = ['name', 'createdAt'];

    if (sortableColumns.includes(sortBy)) {
      queryBuilder.orderBy(`item.${sortBy}`, sortOrder);
    } else {
      // Default sorting if column is not recognized
      queryBuilder.orderBy('item.id', 'DESC');
    }

    // Pagination
    if (page && limit) {
      queryBuilder.skip((+page - 1) * +limit).take(+limit);
    }

    const [orderStockMasters, totalCount] =
      await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      orderStockMasters.map(async (item) => {
        const assetsUrls =
          item.assets && item.assets.length > 0
            ? await Promise.all(
                item.assets.map(async (file) => {
                  const url = await this.s3Service.getFilePathFromUrl(
                    file,
                    process.env.AWS_S3_BUCKET_NAME,
                    10000,
                  );
                  return url;
                }),
              )
            : [];
        return { ...item, assetsUrls };
      }),
    );

    return { data, totalCount };
  }

  async getItemsWithStockStatus(distributorId: number) {
    // ═══════════════════════════════════════════════════════════════
    // ENTERPRISE INVENTORY: Use transaction-based stock calculation
    // Stock is calculated from inventory_transaction (IN - OUT - RESERVE + RELEASE)
    // ═══════════════════════════════════════════════════════════════

    const items = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoin('item.category', 'category')
      .select([
        'item.id',
        'item.name',
        'item.unit',
        'item.rate',
        'item.gstRate',
        'item.assets',
        'item.hasBatchTracking',
        'item.hasSerialTracking',
        'item.hasExpiryDate',
        'item.hasBoxPackaging',
        'item.boxRate',
        'item.unitsPerBox',
        'category.id as categoryId',
        'category.name as categoryName',
      ])
      .orderBy('item.id', 'DESC')
      .getRawMany();

    // Get inventory view from enterprise system (transaction-based calculation)
    const inventoryViews =
      await this.inventoryCoreService.getInventoryView(distributorId);

    // Create a map for quick lookup
    const inventoryMap = new Map<number, number>();
    for (const inv of inventoryViews) {
      inventoryMap.set(inv.itemId, inv.quantity);
    }

    const itemsWithStock = items.map((item) => {
      const stockQuantity = inventoryMap.get(item.item_id) || 0;

      return {
        id: item.item_id,
        name: item.item_name,
        unit: item.item_unit,
        rate: item.item_rate,
        gstRate: item.item_gstRate,
        assets: item.item_assets,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        hasBatchTracking: item.item_hasBatchTracking,
        hasSerialTracking: item.item_hasSerialTracking,
        hasExpiryDate: item.item_hasExpiryDate,
        hasBoxPackaging: item.item_hasBoxPackaging,
        boxRate: item.item_boxRate,
        unitsPerBox: item.item_unitsPerBox,
        stockQuantity,
        inStock: stockQuantity > 0,
      };
    });

    return itemsWithStock;
  }

  async findOne(id: number) {
    const rec = await this.itemRepository.findOne({
      where: { id },
    });
    if (!rec)
      throw new NotFoundException(
        responseMessage.notFoundMessage('Order stock master'),
      );
    const assetsUrls =
      rec.assets && rec.assets.length > 0
        ? await Promise.all(
            rec.assets.map(async (file) => {
              const url = await this.s3Service.getFilePathFromUrl(
                file,
                process.env.AWS_S3_BUCKET_NAME,
                10000,
              );
              return url;
            }),
          )
        : [];
    return { ...rec, assetsUrls };
  }

  async create(
    files: Express.Multer.File[],
    createItemDto: CreateItemDto,
    req: ExtendedRequest,
  ) {
    const promises = [];
    const assets = [];
    if (files && files.length) {
      files.forEach((file) => {
        const fileS3Path = `items/${file.filename}`;
        assets.push(fileS3Path);
        promises.push(
          this.s3Service.uploadS3File(
            file,
            process.env.AWS_S3_BUCKET_NAME,
            fileS3Path,
          ),
        );
      });

      await Promise.all(promises);
    }

    const rec = this.itemRepository.create({
      ...createItemDto,
      assets,
      createdByIp: CommonUtils.getIpFromReq(req),
      createdBy: req.userDetails.userId,
    });
    await this.itemRepository.save(rec);
  }

  async update(
    id: number,
    files: Express.Multer.File[],
    updateItemDto: UpdateItemDto,
    req: ExtendedRequest,
  ) {
    const rec = await this.itemRepository.findOne({
      where: { id },
    });
    if (!rec)
      throw new NotFoundException(
        responseMessage.notFoundMessage('Order stock master'),
      );

    const newAssets: string[] = [];
    const uploadPromises = [];
    if (!updateItemDto.assets) updateItemDto.assets = [];

    // Upload new files (if any)
    if (files && files.length) {
      files.forEach((file) => {
        const fileS3Path = `items/${file.filename}`;
        newAssets.push(fileS3Path);
        uploadPromises.push(
          this.s3Service.uploadS3File(
            file,
            process.env.AWS_S3_BUCKET_NAME,
            fileS3Path,
          ),
        );
      });

      await Promise.all(uploadPromises);
    }

    if (rec.assets?.length) {
      const removedAssets = rec.assets.filter(
        (ee) => !updateItemDto.assets.some((ne) => ne === ee),
      );
      if (removedAssets.length) {
        const removePromises = [];
        removedAssets.forEach((r) => {
          removePromises.push(
            this.s3Service.deleteS3File(process.env.AWS_S3_BUCKET_NAME, r),
          );
        });
        await Promise.all(removePromises);
      }
    }

    Object.assign(rec, updateItemDto);
    rec.assets = [...rec.assets, ...newAssets];
    rec.updatedByIp = CommonUtils.getIpFromReq(req);
    rec.updatedBy = req.userDetails.userId;

    await this.itemRepository.update({ id }, rec);
  }

  async delete(id: number) {
    const rec = await this.findOne(id);
    await this.itemRepository.softRemove(rec);
  }

  async toggleDisable(id: number, isDisabled: boolean) {
    await this.itemRepository.update({ id }, { isDisabled });
  }
}
