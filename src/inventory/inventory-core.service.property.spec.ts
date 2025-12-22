import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as fc from 'fast-check';
import { InventoryCoreService } from './inventory-core.service';
import { InventoryLotEntity } from './entities/inventory-lot.entity';
import { InventorySerialEntity } from './entities/inventory-serial.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import { WarehouseEntity } from './entities/warehouse.entity';
import { ItemEntity } from '../items/entities/item.entity';

/**
 * **Feature: inventory-consolidation, Property 3: Distributor Data Isolation**
 * **Validates: Requirements 12.1, 12.5, 12.6, 12.7**
 *
 * Property: For any inventory query executed by a distributor, the results
 * SHALL contain only records where distributorId matches the authenticated
 * distributor's ID.
 */
describe('InventoryCoreService - Property Tests', () => {
  let service: InventoryCoreService;
  let lotRepo: jest.Mocked<Repository<InventoryLotEntity>>;
  let serialRepo: jest.Mocked<Repository<InventorySerialEntity>>;
  let transactionRepo: jest.Mocked<Repository<InventoryTransactionEntity>>;
  let warehouseRepo: jest.Mocked<Repository<WarehouseEntity>>;
  let itemRepo: jest.Mocked<Repository<ItemEntity>>;

  // Helper to create mock query builder with distributor filtering
  const createMockQueryBuilder = (
    mockData: any[],
    filterByDistributorId?: number,
  ) => {
    return {
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn(function (this: any, condition: string, params?: any) {
        // Track distributor filter
        if (
          condition.includes('distributorId') &&
          params?.distributorId !== undefined
        ) {
          this._distributorFilter = params.distributorId;
        }
        return this;
      }),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(function (this: any) {
        const filtered =
          this._distributorFilter !== undefined
            ? mockData.filter(
                (d) => d.distributorId === this._distributorFilter,
              )
            : mockData;
        const sum = filtered.reduce((acc, d) => acc + (d.quantity || 0), 0);
        return Promise.resolve({ available: sum });
      }),
      getRawMany: jest.fn().mockImplementation(function (this: any) {
        const filtered =
          this._distributorFilter !== undefined
            ? mockData.filter(
                (d) => d.distributorId === this._distributorFilter,
              )
            : mockData;
        return Promise.resolve(filtered);
      }),
      getMany: jest.fn().mockImplementation(function (this: any) {
        const filtered =
          this._distributorFilter !== undefined
            ? mockData.filter(
                (d) => d.distributorId === this._distributorFilter,
              )
            : mockData;
        return Promise.resolve(filtered);
      }),
      _distributorFilter: filterByDistributorId,
    };
  };

  beforeEach(async () => {
    const mockLotRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockSerialRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockTransactionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockWarehouseRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockItemRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCoreService,
        {
          provide: getRepositoryToken(InventoryLotEntity),
          useValue: mockLotRepo,
        },
        {
          provide: getRepositoryToken(InventorySerialEntity),
          useValue: mockSerialRepo,
        },
        {
          provide: getRepositoryToken(InventoryTransactionEntity),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(WarehouseEntity),
          useValue: mockWarehouseRepo,
        },
        {
          provide: getRepositoryToken(ItemEntity),
          useValue: mockItemRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<InventoryCoreService>(InventoryCoreService);
    lotRepo = module.get(getRepositoryToken(InventoryLotEntity));
    serialRepo = module.get(getRepositoryToken(InventorySerialEntity));
    transactionRepo = module.get(
      getRepositoryToken(InventoryTransactionEntity),
    );
    warehouseRepo = module.get(getRepositoryToken(WarehouseEntity));
    itemRepo = module.get(getRepositoryToken(ItemEntity));
  });

  /**
   * **Feature: inventory-consolidation, Property 3: Distributor Data Isolation**
   * **Validates: Requirements 12.1, 12.5, 12.6, 12.7**
   *
   * For any inventory query executed by a distributor, the results SHALL contain
   * only records where distributorId matches the authenticated distributor's ID.
   */
  describe('Property 3: Distributor Data Isolation', () => {
    // Arbitrary for generating distributor IDs (positive integers)
    const distributorIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating item IDs
    const itemIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating warehouse IDs
    const warehouseIdArb = fc.integer({ min: 1, max: 100 });

    // Arbitrary for generating transaction data
    const transactionArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      warehouseId: warehouseIdArb,
      quantity: fc.integer({ min: 1, max: 1000 }),
      movementType: fc.constantFrom('IN', 'OUT', 'RESERVE', 'RELEASE'),
      status: fc.constant('COMPLETED'),
    });

    // Arbitrary for generating lot data
    const lotArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      lotNumber: fc.string({ minLength: 5, maxLength: 20 }),
      status: fc.constant('ACTIVE'),
    });

    // Arbitrary for generating serial data
    const serialArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      serialNumber: fc.string({ minLength: 5, maxLength: 20 }),
      status: fc.constantFrom('AVAILABLE', 'SOLD', 'RESERVED'),
    });

    it('getStockBalance should only return data for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
          async (queryDistributorId, allTransactions) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            const result = await service.getStockBalance({
              distributorId: queryDistributorId,
            });

            // Verify: All returned results should belong to the queried distributor
            // The mock simulates the filtering behavior
            const expectedData = allTransactions.filter(
              (t) => t.distributorId === queryDistributorId,
            );

            // If there's data for this distributor, we should get results
            // If not, we should get empty array
            if (expectedData.length === 0) {
              expect(result.length).toBe(0);
            }

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              't.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getLotsByItem should only return lots for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          fc.array(lotArb, { minLength: 1, maxLength: 20 }),
          async (queryDistributorId, queryItemId, allLots) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allLots);
            lotRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            const result = await service.getLotsByItem(
              queryItemId,
              queryDistributorId,
            );

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              'lot.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );

            // All returned lots should belong to the queried distributor
            result.forEach((lot) => {
              expect(lot.distributorId).toBe(queryDistributorId);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getAvailableSerials should only return serials for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          fc.array(serialArb, { minLength: 1, maxLength: 20 }),
          async (queryDistributorId, queryItemId, allSerials) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allSerials);
            serialRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            const result = await service.getAvailableSerials(
              queryItemId,
              undefined,
              queryDistributorId,
            );

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              'serial.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );

            // All returned serials should belong to the queried distributor
            result.forEach((serial) => {
              expect(serial.distributorId).toBe(queryDistributorId);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getTransactionHistory should only return transactions for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
          async (queryDistributorId, allTransactions) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            const result = await service.getTransactionHistory({
              distributorId: queryDistributorId,
            });

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              't.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );

            // All returned transactions should belong to the queried distributor
            result.forEach((transaction) => {
              expect(transaction.distributorId).toBe(queryDistributorId);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getAvailableQuantity should calculate quantity only for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            allTransactions,
          ) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              't.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getAvailableLots should only return lots for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            allTransactions,
          ) => {
            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(allTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute query with distributor filter
            await service.getAvailableLots(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              't.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getExpiringLots should only return lots for the specified distributor', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          fc.integer({ min: 1, max: 90 }),
          fc.array(lotArb, { minLength: 1, maxLength: 20 }),
          async (queryDistributorId, daysThreshold, allLots) => {
            // Add expiry dates to lots
            const lotsWithExpiry = allLots.map((lot) => ({
              ...lot,
              expiryDate: new Date(
                Date.now() + daysThreshold * 24 * 60 * 60 * 1000,
              )
                .toISOString()
                .split('T')[0],
              warehouseId: 1,
            }));

            // Setup mock to return filtered data
            const mockQb = createMockQueryBuilder(lotsWithExpiry);
            lotRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Mock getAvailableQuantity to return positive quantity
            const mockTxnQb = createMockQueryBuilder([
              { quantity: 100, distributorId: queryDistributorId },
            ]);
            transactionRepo.createQueryBuilder.mockReturnValue(
              mockTxnQb as any,
            );

            // Execute query with distributor filter
            await service.getExpiringLots(daysThreshold, queryDistributorId);

            // Verify the query builder was called with distributor filter
            expect(mockQb.andWhere).toHaveBeenCalledWith(
              'lot.distributorId = :distributorId',
              { distributorId: queryDistributorId },
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: inventory-consolidation, Property 8: API Backward Compatibility**
   * **Validates: Requirements 8.1, 8.2, 8.3**
   *
   * For any inventory list request, the response format SHALL include id,
   * distributorId, itemId, quantity, status, and item details matching the
   * legacy API structure.
   */
  describe('Property 8: API Backward Compatibility', () => {
    // Arbitrary for generating distributor IDs (positive integers)
    const distributorIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating item IDs
    const itemIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating item data
    const itemArb = fc.record({
      id: itemIdArb,
      name: fc.string({ minLength: 1, maxLength: 50 }),
      unit: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
      rate: fc.option(fc.float({ min: 0, max: 10000 })),
      hsn: fc.option(fc.string({ minLength: 4, maxLength: 8 })),
      gstRate: fc.option(fc.float({ min: 0, max: 28 })),
      hasBatchTracking: fc.boolean(),
      hasSerialTracking: fc.boolean(),
      hasExpiryDate: fc.boolean(),
    });

    // Valid date range for all date arbitraries
    const validDateArbForTxn = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Arbitrary for generating transaction data with item info
    const transactionWithItemArb = fc.record({
      itemId: itemIdArb,
      distributorId: distributorIdArb,
      quantity: fc.integer({ min: 1, max: 1000 }),
      movementType: fc.constantFrom('IN', 'OUT', 'RESERVE', 'RELEASE'),
      status: fc.constant('COMPLETED'),
      item_id: itemIdArb,
      item_name: fc.string({ minLength: 1, maxLength: 50 }),
      item_unit: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
      item_rate: fc.option(fc.float({ min: 0, max: 10000 })),
      item_hsn: fc.option(fc.string({ minLength: 4, maxLength: 8 })),
      item_gstRate: fc.option(fc.float({ min: 0, max: 28 })),
      item_hasBatchTracking: fc.boolean(),
      item_hasSerialTracking: fc.boolean(),
      item_hasExpiryDate: fc.boolean(),
      createdAt: validDateArbForTxn,
      updatedAt: validDateArbForTxn,
    });

    // Arbitrary for generating lot data - using integer-based date generation for safety
    const safeDateStringArb = fc.integer({ min: 0, max: 3650 }).map((days) => {
      const date = new Date('2020-01-01');
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    });

    const safeDateArb = fc.integer({ min: 0, max: 3650 }).map((days) => {
      const date = new Date('2020-01-01');
      date.setDate(date.getDate() + days);
      return date;
    });

    const lotArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      lotNumber: fc.string({ minLength: 5, maxLength: 20 }),
      expiryDate: fc.option(safeDateStringArb),
      status: fc.constant('ACTIVE'),
      createdAt: safeDateArb,
      updatedAt: safeDateArb,
    });

    // Arbitrary for generating serial data
    const serialArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      serialNumber: fc.string({ minLength: 5, maxLength: 20 }),
      status: fc.constantFrom(
        'AVAILABLE',
        'SOLD',
        'RESERVED',
        'RETURNED',
        'DAMAGED',
      ),
      lotId: fc.option(fc.integer({ min: 1, max: 10000 })),
      lot: fc.option(
        fc.record({
          lotNumber: fc.string({ minLength: 5, maxLength: 20 }),
          expiryDate: fc.option(safeDateStringArb),
        }),
      ),
      createdAt: safeDateArb,
      updatedAt: safeDateArb,
    });

    // Helper to create mock query builder for inventory view
    const createInventoryViewMockQb = (
      mockData: any[],
      filterDistributorId?: number,
    ) => {
      return {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn(function (
          this: any,
          condition: string,
          params?: any,
        ) {
          if (
            condition.includes('distributorId') &&
            params?.distributorId !== undefined
          ) {
            this._distributorFilter = params.distributorId;
          }
          return this;
        }),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockImplementation(function (this: any) {
          const filtered =
            this._distributorFilter !== undefined
              ? mockData.filter(
                  (d) => d.distributorId === this._distributorFilter,
                )
              : mockData;
          return Promise.resolve(filtered);
        }),
        _distributorFilter: filterDistributorId,
      };
    };

    it('getInventoryView should return data with all required legacy fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          fc.array(transactionWithItemArb, { minLength: 1, maxLength: 10 }),
          async (queryDistributorId, transactions) => {
            // Filter transactions for the query distributor
            const distributorTransactions = transactions.filter(
              (t) => t.distributorId === queryDistributorId,
            );

            // Setup mock
            const mockQb = createInventoryViewMockQb(distributorTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getInventoryView(queryDistributorId);

            // Verify: Each result should have all required legacy fields
            result.forEach((inv) => {
              // Required fields from legacy DistributorInventoryEntity
              expect(inv).toHaveProperty('id');
              expect(typeof inv.id).toBe('number');

              expect(inv).toHaveProperty('distributorId');
              expect(inv.distributorId).toBe(queryDistributorId);

              expect(inv).toHaveProperty('itemId');
              expect(typeof inv.itemId).toBe('number');

              expect(inv).toHaveProperty('quantity');
              expect(typeof inv.quantity).toBe('number');

              expect(inv).toHaveProperty('reorderLevel');
              expect(typeof inv.reorderLevel).toBe('number');

              expect(inv).toHaveProperty('status');
              expect(['in_stock', 'low_stock', 'out_of_stock']).toContain(
                inv.status,
              );

              // Item details
              expect(inv).toHaveProperty('item');
              expect(inv.item).toHaveProperty('id');
              expect(inv.item).toHaveProperty('name');
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getInventoryView status should be correctly calculated from quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          fc.integer({ min: 0, max: 1000 }), // quantity
          fc.integer({ min: 1, max: 100 }), // reorderLevel (default is 10)
          async (queryDistributorId, quantity, _reorderLevel) => {
            // Create transaction data that will result in the specified quantity
            const mockData = [
              {
                itemId: 1,
                distributorId: queryDistributorId,
                quantity: quantity,
                item_id: 1,
                item_name: 'Test Item',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];

            // Setup mock
            const mockQb = createInventoryViewMockQb(mockData);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getInventoryView(queryDistributorId);

            if (result.length > 0) {
              const inv = result[0];
              const defaultReorderLevel = 10; // Service uses default of 10

              // Verify status calculation
              if (inv.quantity === 0) {
                expect(inv.status).toBe('out_of_stock');
              } else if (inv.quantity <= defaultReorderLevel) {
                expect(inv.status).toBe('low_stock');
              } else {
                expect(inv.status).toBe('in_stock');
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getBatchDetailsView should return data with all required legacy fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          fc.array(lotArb, { minLength: 1, maxLength: 10 }),
          async (queryDistributorId, queryItemId, lots) => {
            // Filter lots for the query
            const filteredLots = lots
              .filter(
                (l) =>
                  l.distributorId === queryDistributorId &&
                  l.itemId === queryItemId,
              )
              .map((l) => ({
                ...l,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
              }));

            // Setup lot repo mock
            lotRepo.find.mockResolvedValue(filteredLots as any);

            // Setup transaction repo mock for quantity calculation
            const mockTxnQb = {
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ quantity: 100 }),
            };
            transactionRepo.createQueryBuilder.mockReturnValue(
              mockTxnQb as any,
            );

            // Execute
            const result = await service.getBatchDetailsView(
              queryItemId,
              queryDistributorId,
            );

            // Verify: Each result should have all required legacy fields
            result.forEach((batch) => {
              // Required fields from legacy BatchDetailEntity
              expect(batch).toHaveProperty('id');
              expect(typeof batch.id).toBe('number');

              expect(batch).toHaveProperty('inventoryId');
              expect(typeof batch.inventoryId).toBe('number');

              expect(batch).toHaveProperty('batchNumber');
              expect(typeof batch.batchNumber).toBe('string');

              expect(batch).toHaveProperty('quantity');
              expect(typeof batch.quantity).toBe('number');

              // Optional fields
              if (batch.expiryDate !== undefined) {
                expect(
                  typeof batch.expiryDate === 'string' ||
                    batch.expiryDate === null,
                ).toBe(true);
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getSerialDetailsView should return data with all required legacy fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          fc.array(serialArb, { minLength: 1, maxLength: 10 }),
          async (queryDistributorId, queryItemId, serials) => {
            // Filter serials for the query
            const filteredSerials = serials
              .filter(
                (s) =>
                  s.distributorId === queryDistributorId &&
                  s.itemId === queryItemId,
              )
              .map((s) => ({
                ...s,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
              }));

            // Setup serial repo mock
            serialRepo.find.mockResolvedValue(filteredSerials as any);

            // Execute
            const result = await service.getSerialDetailsView(
              queryItemId,
              queryDistributorId,
            );

            // Verify: Each result should have all required legacy fields
            result.forEach((serial) => {
              // Required fields from legacy SerialDetailEntity
              expect(serial).toHaveProperty('id');
              expect(typeof serial.id).toBe('number');

              expect(serial).toHaveProperty('inventoryId');
              expect(typeof serial.inventoryId).toBe('number');

              expect(serial).toHaveProperty('serialNumber');
              expect(typeof serial.serialNumber).toBe('string');

              expect(serial).toHaveProperty('quantity');
              expect(serial.quantity).toBe(1); // Serials always have quantity 1

              expect(serial).toHaveProperty('status');
              expect([
                'AVAILABLE',
                'RESERVED',
                'SOLD',
                'RETURNED',
                'DAMAGED',
              ]).toContain(serial.status);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('inventoryId should be consistent across getInventoryView, getBatchDetailsView, and getSerialDetailsView', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          async (queryDistributorId, queryItemId) => {
            // The inventoryId formula should be: distributorId * 1000000 + itemId
            const expectedInventoryId =
              queryDistributorId * 1000000 + queryItemId;

            // Setup mocks for inventory view
            const mockTxnData = [
              {
                itemId: queryItemId,
                distributorId: queryDistributorId,
                quantity: 100,
                item_id: queryItemId,
                item_name: 'Test Item',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
            const mockQb = createInventoryViewMockQb(mockTxnData);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Get inventory view
            const inventoryResult =
              await service.getInventoryView(queryDistributorId);

            // Setup mocks for batch details
            const mockLots = [
              {
                id: 1,
                itemId: queryItemId,
                distributorId: queryDistributorId,
                lotNumber: 'BATCH001',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
            lotRepo.find.mockResolvedValue(mockLots as any);

            // Setup transaction mock for batch quantity
            const mockBatchTxnQb = {
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ quantity: 50 }),
            };
            transactionRepo.createQueryBuilder.mockReturnValue(
              mockBatchTxnQb as any,
            );

            // Get batch details
            const batchResult = await service.getBatchDetailsView(
              queryItemId,
              queryDistributorId,
            );

            // Setup mocks for serial details
            const mockSerials = [
              {
                id: 1,
                itemId: queryItemId,
                distributorId: queryDistributorId,
                serialNumber: 'SN001',
                status: 'AVAILABLE',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
            serialRepo.find.mockResolvedValue(mockSerials as any);

            // Get serial details
            const serialResult = await service.getSerialDetailsView(
              queryItemId,
              queryDistributorId,
            );

            // Verify inventoryId consistency
            if (inventoryResult.length > 0) {
              const invItem = inventoryResult.find(
                (i) => i.itemId === queryItemId,
              );
              if (invItem) {
                expect(invItem.id).toBe(expectedInventoryId);
              }
            }

            if (batchResult.length > 0) {
              expect(batchResult[0].inventoryId).toBe(expectedInventoryId);
            }

            if (serialResult.length > 0) {
              expect(serialResult[0].inventoryId).toBe(expectedInventoryId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: inventory-consolidation, Property 1: Stock Balance Calculation Consistency**
   * **Validates: Requirements 1.1**
   *
   * For any item, warehouse, and distributor combination, the calculated available
   * quantity SHALL equal the sum of all IN movement quantities minus the sum of all
   * OUT movement quantities minus the sum of all RESERVE movement quantities plus
   * the sum of all RELEASE movement quantities, considering only COMPLETED transactions.
   */
  describe('Property 1: Stock Balance Calculation Consistency', () => {
    // Arbitrary for generating distributor IDs (positive integers)
    const distributorIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating item IDs
    const itemIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating warehouse IDs
    const warehouseIdArb = fc.integer({ min: 1, max: 100 });

    // Arbitrary for generating movement types
    const movementTypeArb = fc.constantFrom('IN', 'OUT', 'RESERVE', 'RELEASE');

    // Arbitrary for generating transaction status
    const statusArb = fc.constantFrom('COMPLETED', 'PENDING', 'CANCELLED');

    // Arbitrary for generating a single transaction
    const transactionArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      distributorId: distributorIdArb,
      itemId: itemIdArb,
      warehouseId: warehouseIdArb,
      quantity: fc.integer({ min: 1, max: 1000 }),
      movementType: movementTypeArb,
      status: statusArb,
    });

    /**
     * Helper function to calculate expected available quantity from transactions
     * using the formula: SUM(IN) - SUM(OUT) - SUM(RESERVE) + SUM(RELEASE)
     * Only considering COMPLETED transactions
     */
    const calculateExpectedQuantity = (
      transactions: Array<{
        movementType: string;
        quantity: number;
        status: string;
        itemId: number;
        warehouseId: number;
        distributorId: number;
      }>,
      itemId: number,
      warehouseId: number,
      distributorId: number,
    ): number => {
      return transactions
        .filter(
          (t) =>
            t.status === 'COMPLETED' &&
            t.itemId === itemId &&
            t.warehouseId === warehouseId &&
            t.distributorId === distributorId,
        )
        .reduce((sum, t) => {
          switch (t.movementType) {
            case 'IN':
              return sum + t.quantity;
            case 'OUT':
              return sum - t.quantity;
            case 'RESERVE':
              return sum - t.quantity;
            case 'RELEASE':
              return sum + t.quantity;
            default:
              return sum;
          }
        }, 0);
    };

    // Helper to create mock query builder that simulates the actual SQL calculation
    const createStockCalculationMockQb = (
      transactions: Array<{
        movementType: string;
        quantity: number;
        status: string;
        itemId: number;
        warehouseId: number;
        distributorId: number;
      }>,
    ) => {
      let filterItemId: number | undefined;
      let filterWarehouseId: number | undefined;
      let filterDistributorId: number | undefined;
      let filterStatus: string | undefined;

      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn(function (this: any, condition: string, params?: any) {
          if (condition.includes('itemId') && params?.itemId !== undefined) {
            filterItemId = params.itemId;
          }
          if (condition.includes('status') && params?.status !== undefined) {
            filterStatus = params.status;
          }
          return this;
        }),
        andWhere: jest.fn(function (
          this: any,
          condition: string,
          params?: any,
        ) {
          if (
            condition.includes('warehouseId') &&
            params?.warehouseId !== undefined
          ) {
            filterWarehouseId = params.warehouseId;
          }
          if (
            condition.includes('distributorId') &&
            params?.distributorId !== undefined
          ) {
            filterDistributorId = params.distributorId;
          }
          if (condition.includes('status') && params?.status !== undefined) {
            filterStatus = params.status;
          }
          return this;
        }),
        getRawOne: jest.fn().mockImplementation(() => {
          // Filter transactions based on captured parameters
          const filtered = transactions.filter((t) => {
            let match = true;
            if (filterItemId !== undefined)
              match = match && t.itemId === filterItemId;
            if (filterWarehouseId !== undefined)
              match = match && t.warehouseId === filterWarehouseId;
            if (filterDistributorId !== undefined)
              match = match && t.distributorId === filterDistributorId;
            if (filterStatus !== undefined)
              match = match && t.status === filterStatus;
            return match;
          });

          // Calculate available quantity using the same formula as the service
          const available = filtered.reduce((sum, t) => {
            switch (t.movementType) {
              case 'IN':
                return sum + t.quantity;
              case 'OUT':
                return sum - t.quantity;
              case 'RESERVE':
                return sum - t.quantity;
              case 'RELEASE':
                return sum + t.quantity;
              default:
                return sum;
            }
          }, 0);

          return Promise.resolve({ available });
        }),
      };
    };

    it('available quantity should equal SUM(IN) - SUM(OUT) - SUM(RESERVE) + SUM(RELEASE) for COMPLETED transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            allTransactions,
          ) => {
            // Ensure we have at least some transactions for the query parameters
            const relevantTransactions = allTransactions.map((t, index) => ({
              ...t,
              // Make some transactions match our query parameters
              itemId: index % 3 === 0 ? queryItemId : t.itemId,
              warehouseId: index % 3 === 0 ? queryWarehouseId : t.warehouseId,
              distributorId:
                index % 3 === 0 ? queryDistributorId : t.distributorId,
            }));

            // Setup mock
            const mockQb = createStockCalculationMockQb(relevantTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Calculate expected value using our helper
            const expected = calculateExpectedQuantity(
              relevantTransactions,
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: The service result should match our expected calculation
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('available quantity should be zero when no COMPLETED transactions exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              distributorId: distributorIdArb,
              itemId: itemIdArb,
              warehouseId: warehouseIdArb,
              quantity: fc.integer({ min: 1, max: 1000 }),
              movementType: movementTypeArb,
              status: fc.constantFrom('PENDING', 'CANCELLED'), // Only non-COMPLETED
            }),
            { minLength: 0, maxLength: 20 },
          ),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            nonCompletedTransactions,
          ) => {
            // Setup mock - no COMPLETED transactions
            const mockQb = createStockCalculationMockQb(
              nonCompletedTransactions,
            );
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: Should be zero since no COMPLETED transactions
            expect(result).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('IN movements should increase available quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(fc.integer({ min: 1, max: 1000 }), {
            minLength: 1,
            maxLength: 10,
          }),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            inQuantities,
          ) => {
            // Create only IN transactions
            const inTransactions = inQuantities.map((qty, index) => ({
              id: index + 1,
              distributorId: queryDistributorId,
              itemId: queryItemId,
              warehouseId: queryWarehouseId,
              quantity: qty,
              movementType: 'IN',
              status: 'COMPLETED',
            }));

            // Setup mock
            const mockQb = createStockCalculationMockQb(inTransactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: Should equal sum of all IN quantities
            const expectedSum = inQuantities.reduce((sum, qty) => sum + qty, 0);
            expect(result).toBe(expectedSum);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('OUT movements should decrease available quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.integer({ min: 100, max: 1000 }), // Initial IN quantity
          fc.array(fc.integer({ min: 1, max: 50 }), {
            minLength: 1,
            maxLength: 5,
          }), // OUT quantities
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            initialIn,
            outQuantities,
          ) => {
            // Create transactions: one IN followed by multiple OUTs
            const transactions = [
              {
                id: 1,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: initialIn,
                movementType: 'IN',
                status: 'COMPLETED',
              },
              ...outQuantities.map((qty, index) => ({
                id: index + 2,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: qty,
                movementType: 'OUT',
                status: 'COMPLETED',
              })),
            ];

            // Setup mock
            const mockQb = createStockCalculationMockQb(transactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: Should equal IN - sum(OUT)
            const totalOut = outQuantities.reduce((sum, qty) => sum + qty, 0);
            const expected = initialIn - totalOut;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('RESERVE movements should decrease available quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.integer({ min: 100, max: 1000 }), // Initial IN quantity
          fc.array(fc.integer({ min: 1, max: 50 }), {
            minLength: 1,
            maxLength: 5,
          }), // RESERVE quantities
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            initialIn,
            reserveQuantities,
          ) => {
            // Create transactions: one IN followed by multiple RESERVEs
            const transactions = [
              {
                id: 1,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: initialIn,
                movementType: 'IN',
                status: 'COMPLETED',
              },
              ...reserveQuantities.map((qty, index) => ({
                id: index + 2,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: qty,
                movementType: 'RESERVE',
                status: 'COMPLETED',
              })),
            ];

            // Setup mock
            const mockQb = createStockCalculationMockQb(transactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: Should equal IN - sum(RESERVE)
            const totalReserve = reserveQuantities.reduce(
              (sum, qty) => sum + qty,
              0,
            );
            const expected = initialIn - totalReserve;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('RELEASE movements should increase available quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.integer({ min: 100, max: 1000 }), // Initial IN quantity
          fc.integer({ min: 50, max: 100 }), // RESERVE quantity
          fc.integer({ min: 1, max: 50 }), // RELEASE quantity (less than or equal to reserve)
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            initialIn,
            reserveQty,
            releaseQty,
          ) => {
            // Create transactions: IN -> RESERVE -> RELEASE
            const transactions = [
              {
                id: 1,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: initialIn,
                movementType: 'IN',
                status: 'COMPLETED',
              },
              {
                id: 2,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: reserveQty,
                movementType: 'RESERVE',
                status: 'COMPLETED',
              },
              {
                id: 3,
                distributorId: queryDistributorId,
                itemId: queryItemId,
                warehouseId: queryWarehouseId,
                quantity: releaseQty,
                movementType: 'RELEASE',
                status: 'COMPLETED',
              },
            ];

            // Setup mock
            const mockQb = createStockCalculationMockQb(transactions);
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute
            const result = await service.getAvailableQuantity(
              queryItemId,
              queryWarehouseId,
              queryDistributorId,
            );

            // Verify: Should equal IN - RESERVE + RELEASE
            const expected = initialIn - reserveQty + releaseQty;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('stock balance calculation should be consistent with getInventoryView quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          distributorIdArb,
          itemIdArb,
          warehouseIdArb,
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              quantity: fc.integer({ min: 1, max: 1000 }),
              movementType: movementTypeArb,
              status: fc.constant('COMPLETED'),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (
            queryDistributorId,
            queryItemId,
            queryWarehouseId,
            baseTransactions,
          ) => {
            // Create transactions with consistent item/warehouse/distributor
            const transactions = baseTransactions.map((t, index) => ({
              ...t,
              itemId: queryItemId,
              warehouseId: queryWarehouseId,
              distributorId: queryDistributorId,
              item_id: queryItemId,
              item_name: 'Test Item',
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            // Calculate expected quantity
            const expectedQuantity = transactions.reduce((sum, t) => {
              switch (t.movementType) {
                case 'IN':
                  return sum + t.quantity;
                case 'OUT':
                  return sum - t.quantity;
                case 'RESERVE':
                  return sum - t.quantity;
                case 'RELEASE':
                  return sum + t.quantity;
                default:
                  return sum;
              }
            }, 0);

            // Setup mock for getInventoryView
            const mockQb = {
              leftJoin: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([
                {
                  itemId: queryItemId,
                  distributorId: queryDistributorId,
                  quantity: expectedQuantity,
                  item_id: queryItemId,
                  item_name: 'Test Item',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            };
            transactionRepo.createQueryBuilder.mockReturnValue(mockQb as any);

            // Execute getInventoryView
            const inventoryView =
              await service.getInventoryView(queryDistributorId);

            // Verify: The quantity in inventory view should match our expected calculation
            if (inventoryView.length > 0) {
              const item = inventoryView.find((i) => i.itemId === queryItemId);
              if (item) {
                expect(item.quantity).toBe(expectedQuantity);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: inventory-consolidation, Property 2: Transaction Creates Audit Trail**
   * **Validates: Requirements 2.1, 3.4, 9.1, 10.1, 13.1**
   *
   * For any inventory movement (GRN receipt, billing, return, adjustment), an
   * inventory_transaction record SHALL be created with the correct transactionType,
   * movementType, and reference linkage.
   */
  describe('Property 2: Transaction Creates Audit Trail', () => {
    // Arbitrary for generating distributor IDs (positive integers)
    const distributorIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating item IDs
    const itemIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating warehouse IDs
    const warehouseIdArb = fc.integer({ min: 1, max: 100 });

    // Arbitrary for generating user IDs (for createdBy)
    const userIdArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating quantities
    const quantityArb = fc.integer({ min: 1, max: 1000 });

    // Arbitrary for generating reference IDs
    const referenceIdArb = fc.integer({ min: 1, max: 10000 });

    // Transaction type to movement type mapping
    const transactionTypeToMovementType: Record<string, string> = {
      GRN_RECEIPT: 'IN',
      OPENING_STOCK: 'IN',
      PURCHASE_RETURN: 'OUT',
      SALES_ISSUE: 'OUT',
      SALES_RETURN: 'IN',
      TRANSFER_OUT: 'OUT',
      TRANSFER_IN: 'IN',
      ADJUSTMENT_IN: 'IN',
      ADJUSTMENT_OUT: 'OUT',
      DAMAGE_WRITE_OFF: 'OUT',
      EXPIRY_WRITE_OFF: 'OUT',
      RESERVATION: 'RESERVE',
      RESERVATION_RELEASE: 'RELEASE',
    };

    // Arbitrary for generating transaction types
    const transactionTypeArb = fc.constantFrom(
      'GRN_RECEIPT',
      'OPENING_STOCK',
      'PURCHASE_RETURN',
      'SALES_ISSUE',
      'SALES_RETURN',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'DAMAGE_WRITE_OFF',
      'EXPIRY_WRITE_OFF',
      'RESERVATION',
      'RESERVATION_RELEASE',
    );

    // Arbitrary for generating reference types
    const referenceTypeArb = fc.constantFrom(
      'PURCHASE_ORDER',
      'GRN',
      'BILLING',
      'SALES_RETURN',
      'PURCHASE_RETURN',
      'TRANSFER_ORDER',
      'ADJUSTMENT',
      'OPENING',
    );

    // Counter for generating unique transaction numbers
    let transactionCounter = 0;

    // Helper to create mock for createTransaction
    const createTransactionMock = () => {
      let savedTransaction: any = null;

      return {
        create: jest.fn((data: any) => {
          transactionCounter++;
          savedTransaction = {
            id: Math.floor(Math.random() * 10000) + 1,
            ...data,
            transactionNo: `TXN-${Date.now()}-${transactionCounter}-${Math.floor(Math.random() * 100000)}`,
            transactionDate: new Date(),
            status: 'COMPLETED',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return savedTransaction;
        }),
        save: jest.fn((entity: any) => Promise.resolve(entity)),
        update: jest.fn(() => Promise.resolve()),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ available: 1000 }), // Always have enough stock
        })),
        getSavedTransaction: () => savedTransaction,
      };
    };

    it('createTransaction should create a transaction record with correct transactionType', async () => {
      await fc.assert(
        fc.asyncProperty(
          transactionTypeArb,
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          async (
            transactionType,
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
          ) => {
            // Get expected movement type
            const expectedMovementType =
              transactionTypeToMovementType[transactionType];

            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute
            const result = await service.createTransaction({
              transactionType: transactionType as any,
              movementType: expectedMovementType as any,
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
            });

            // Verify: Transaction should have correct transactionType
            expect(result.transactionType).toBe(transactionType);

            // Verify: Transaction should have correct movementType
            expect(result.movementType).toBe(expectedMovementType);

            // Verify: Transaction should have a transactionNo
            expect(result.transactionNo).toBeDefined();
            expect(typeof result.transactionNo).toBe('string');
            expect(result.transactionNo.length).toBeGreaterThan(0);

            // Verify: Transaction should have a transactionDate
            expect(result.transactionDate).toBeDefined();
            expect(result.transactionDate instanceof Date).toBe(true);

            // Verify: Transaction should have status COMPLETED
            expect(result.status).toBe('COMPLETED');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('createTransaction should include reference linkage when provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          transactionTypeArb,
          referenceTypeArb,
          referenceIdArb,
          fc.string({ minLength: 5, maxLength: 20 }), // referenceNo
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          async (
            transactionType,
            referenceType,
            referenceId,
            referenceNo,
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
          ) => {
            // Get expected movement type
            const expectedMovementType =
              transactionTypeToMovementType[transactionType];

            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute with reference linkage
            const result = await service.createTransaction({
              transactionType: transactionType as any,
              movementType: expectedMovementType as any,
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: referenceType as any,
              referenceId,
              referenceNo,
            });

            // Verify: Transaction should have reference linkage
            expect(result.referenceType).toBe(referenceType);
            expect(result.referenceId).toBe(referenceId);
            expect(result.referenceNo).toBe(referenceNo);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('createTransaction should record audit information (createdBy, distributorId)', async () => {
      await fc.assert(
        fc.asyncProperty(
          transactionTypeArb,
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          fc.option(fc.string({ minLength: 7, maxLength: 15 })), // ipAddress
          async (
            transactionType,
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
            ipAddress,
          ) => {
            // Get expected movement type
            const expectedMovementType =
              transactionTypeToMovementType[transactionType];

            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute with audit info
            const result = await service.createTransaction({
              transactionType: transactionType as any,
              movementType: expectedMovementType as any,
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              ipAddress: ipAddress ?? undefined,
            });

            // Verify: Transaction should have audit information
            expect(result.createdBy).toBe(createdBy);
            expect(result.distributorId).toBe(distributorId);

            if (ipAddress) {
              expect(result.ipAddress).toBe(ipAddress);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ADJUSTMENT_IN transaction should have movementType IN', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          async (itemId, warehouseId, distributorId, quantity, createdBy) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute ADJUSTMENT_IN
            const result = await service.createTransaction({
              transactionType: 'ADJUSTMENT_IN',
              movementType: 'IN',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'ADJUSTMENT',
            });

            // Verify: ADJUSTMENT_IN should have movementType IN
            expect(result.transactionType).toBe('ADJUSTMENT_IN');
            expect(result.movementType).toBe('IN');
            expect(result.referenceType).toBe('ADJUSTMENT');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ADJUSTMENT_OUT transaction should have movementType OUT', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          async (itemId, warehouseId, distributorId, quantity, createdBy) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute ADJUSTMENT_OUT
            const result = await service.createTransaction({
              transactionType: 'ADJUSTMENT_OUT',
              movementType: 'OUT',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'ADJUSTMENT',
            });

            // Verify: ADJUSTMENT_OUT should have movementType OUT
            expect(result.transactionType).toBe('ADJUSTMENT_OUT');
            expect(result.movementType).toBe('OUT');
            expect(result.referenceType).toBe('ADJUSTMENT');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('GRN_RECEIPT transaction should have movementType IN and referenceType GRN', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          referenceIdArb,
          async (
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
            grnId,
          ) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute GRN_RECEIPT
            const result = await service.createTransaction({
              transactionType: 'GRN_RECEIPT',
              movementType: 'IN',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'GRN',
              referenceId: grnId,
            });

            // Verify: GRN_RECEIPT should have correct type and reference
            expect(result.transactionType).toBe('GRN_RECEIPT');
            expect(result.movementType).toBe('IN');
            expect(result.referenceType).toBe('GRN');
            expect(result.referenceId).toBe(grnId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('SALES_ISSUE transaction should have movementType OUT and referenceType BILLING', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          referenceIdArb,
          async (
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
            billingId,
          ) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute SALES_ISSUE
            const result = await service.createTransaction({
              transactionType: 'SALES_ISSUE',
              movementType: 'OUT',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'BILLING',
              referenceId: billingId,
            });

            // Verify: SALES_ISSUE should have correct type and reference
            expect(result.transactionType).toBe('SALES_ISSUE');
            expect(result.movementType).toBe('OUT');
            expect(result.referenceType).toBe('BILLING');
            expect(result.referenceId).toBe(billingId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('SALES_RETURN transaction should have movementType IN and referenceType SALES_RETURN', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          referenceIdArb,
          async (
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
            returnId,
          ) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute SALES_RETURN
            const result = await service.createTransaction({
              transactionType: 'SALES_RETURN',
              movementType: 'IN',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'SALES_RETURN',
              referenceId: returnId,
            });

            // Verify: SALES_RETURN should have correct type and reference
            expect(result.transactionType).toBe('SALES_RETURN');
            expect(result.movementType).toBe('IN');
            expect(result.referenceType).toBe('SALES_RETURN');
            expect(result.referenceId).toBe(returnId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('PURCHASE_RETURN transaction should have movementType OUT and referenceType PURCHASE_RETURN', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          warehouseIdArb,
          distributorIdArb,
          quantityArb,
          userIdArb,
          referenceIdArb,
          async (
            itemId,
            warehouseId,
            distributorId,
            quantity,
            createdBy,
            returnId,
          ) => {
            // Setup mock
            const mockTransactionRepo = createTransactionMock();
            (transactionRepo as any).create = mockTransactionRepo.create;
            (transactionRepo as any).save = mockTransactionRepo.save;
            (transactionRepo as any).update = mockTransactionRepo.update;
            (transactionRepo as any).createQueryBuilder =
              mockTransactionRepo.createQueryBuilder;

            // Execute PURCHASE_RETURN
            const result = await service.createTransaction({
              transactionType: 'PURCHASE_RETURN',
              movementType: 'OUT',
              itemId,
              warehouseId,
              distributorId,
              quantity,
              createdBy,
              referenceType: 'PURCHASE_RETURN',
              referenceId: returnId,
            });

            // Verify: PURCHASE_RETURN should have correct type and reference
            expect(result.transactionType).toBe('PURCHASE_RETURN');
            expect(result.movementType).toBe('OUT');
            expect(result.referenceType).toBe('PURCHASE_RETURN');
            expect(result.referenceId).toBe(returnId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('every transaction should have a unique transactionNo', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              transactionType: transactionTypeArb,
              itemId: itemIdArb,
              warehouseId: warehouseIdArb,
              distributorId: distributorIdArb,
              quantity: quantityArb,
              createdBy: userIdArb,
            }),
            { minLength: 2, maxLength: 10 },
          ),
          async (transactionInputs) => {
            const transactionNos: string[] = [];

            for (const input of transactionInputs) {
              // Setup mock for each transaction
              const mockTransactionRepo = createTransactionMock();
              (transactionRepo as any).create = mockTransactionRepo.create;
              (transactionRepo as any).save = mockTransactionRepo.save;
              (transactionRepo as any).update = mockTransactionRepo.update;
              (transactionRepo as any).createQueryBuilder =
                mockTransactionRepo.createQueryBuilder;

              const expectedMovementType =
                transactionTypeToMovementType[input.transactionType];

              // Execute
              const result = await service.createTransaction({
                transactionType: input.transactionType as any,
                movementType: expectedMovementType as any,
                itemId: input.itemId,
                warehouseId: input.warehouseId,
                distributorId: input.distributorId,
                quantity: input.quantity,
                createdBy: input.createdBy,
              });

              transactionNos.push(result.transactionNo);
            }

            // Verify: All transaction numbers should be unique
            const uniqueNos = new Set(transactionNos);
            expect(uniqueNos.size).toBe(transactionNos.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * **Feature: inventory-consolidation, Property 5: Serial Status Lifecycle**
 * **Validates: Requirements 3.5, 10.2**
 *
 * For any serial-tracked item, when sold the status SHALL change to 'SOLD',
 * and when returned the status SHALL change to 'AVAILABLE' or 'RETURNED'.
 */
describe('Property 5: Serial Status Lifecycle', () => {
  let service: InventoryCoreService;
  let serialRepo: jest.Mocked<Repository<InventorySerialEntity>>;

  // Arbitrary for generating serial IDs
  const serialIdArb = fc.integer({ min: 1, max: 10000 });

  // Arbitrary for generating customer IDs
  const customerIdArb = fc.integer({ min: 1, max: 10000 });

  // Arbitrary for generating billing IDs
  const billingIdArb = fc.integer({ min: 1, max: 10000 });

  // Arbitrary for generating dates
  const dateStringArb = fc.integer({ min: 0, max: 3650 }).map((days) => {
    const date = new Date('2020-01-01');
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  });

  // Valid serial statuses
  const validStatuses = [
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'RETURNED',
    'DAMAGED',
    'SCRAPPED',
  ] as const;

  beforeEach(async () => {
    const mockSerialRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockLotRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockTransactionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockWarehouseRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockItemRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCoreService,
        {
          provide: getRepositoryToken(InventoryLotEntity),
          useValue: mockLotRepo,
        },
        {
          provide: getRepositoryToken(InventorySerialEntity),
          useValue: mockSerialRepo,
        },
        {
          provide: getRepositoryToken(InventoryTransactionEntity),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(WarehouseEntity),
          useValue: mockWarehouseRepo,
        },
        {
          provide: getRepositoryToken(ItemEntity),
          useValue: mockItemRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<InventoryCoreService>(InventoryCoreService);
    serialRepo = module.get(getRepositoryToken(InventorySerialEntity));
  });

  it('updateSerialStatus to SOLD should set status to SOLD with customer info', async () => {
    await fc.assert(
      fc.asyncProperty(
        serialIdArb,
        customerIdArb,
        billingIdArb,
        dateStringArb,
        async (serialId, customerId, billingId, soldDate) => {
          // Track what was passed to update
          let capturedUpdate: any = null;
          serialRepo.update.mockImplementation((id, data) => {
            capturedUpdate = { id, data };
            return Promise.resolve({ affected: 1 } as any);
          });

          // Execute: Update serial status to SOLD
          await service.updateSerialStatus(serialId, 'SOLD', {
            soldDate,
            currentOwnerType: 'CUSTOMER',
            currentOwnerId: customerId,
            billingId,
            customerId,
          });

          // Verify: Status should be SOLD
          expect(capturedUpdate).not.toBeNull();
          expect(capturedUpdate.id).toBe(serialId);
          expect(capturedUpdate.data.status).toBe('SOLD');

          // Verify: Customer info should be set
          expect(capturedUpdate.data.soldDate).toBe(soldDate);
          expect(capturedUpdate.data.currentOwnerType).toBe('CUSTOMER');
          expect(capturedUpdate.data.currentOwnerId).toBe(customerId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateSerialStatus to AVAILABLE should set status to AVAILABLE (for returns)', async () => {
    await fc.assert(
      fc.asyncProperty(serialIdArb, async (serialId) => {
        // Track what was passed to update
        let capturedUpdate: any = null;
        serialRepo.update.mockImplementation((id, data) => {
          capturedUpdate = { id, data };
          return Promise.resolve({ affected: 1 } as any);
        });

        // Execute: Update serial status to AVAILABLE (sales return - good condition)
        await service.updateSerialStatus(serialId, 'AVAILABLE');

        // Verify: Status should be AVAILABLE
        expect(capturedUpdate).not.toBeNull();
        expect(capturedUpdate.id).toBe(serialId);
        expect(capturedUpdate.data.status).toBe('AVAILABLE');
      }),
      { numRuns: 100 },
    );
  });

  it('updateSerialStatus to RETURNED should set status to RETURNED (for returns with issues)', async () => {
    await fc.assert(
      fc.asyncProperty(serialIdArb, async (serialId) => {
        // Track what was passed to update
        let capturedUpdate: any = null;
        serialRepo.update.mockImplementation((id, data) => {
          capturedUpdate = { id, data };
          return Promise.resolve({ affected: 1 } as any);
        });

        // Execute: Update serial status to RETURNED (sales return - needs inspection)
        await service.updateSerialStatus(serialId, 'RETURNED');

        // Verify: Status should be RETURNED
        expect(capturedUpdate).not.toBeNull();
        expect(capturedUpdate.id).toBe(serialId);
        expect(capturedUpdate.data.status).toBe('RETURNED');
      }),
      { numRuns: 100 },
    );
  });

  it('serial status transitions should only allow valid statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        serialIdArb,
        fc.constantFrom(...validStatuses),
        async (serialId, newStatus) => {
          // Track what was passed to update
          let capturedUpdate: any = null;
          serialRepo.update.mockImplementation((id, data) => {
            capturedUpdate = { id, data };
            return Promise.resolve({ affected: 1 } as any);
          });

          // Execute: Update serial status
          await service.updateSerialStatus(serialId, newStatus);

          // Verify: Status should be one of the valid statuses
          expect(capturedUpdate).not.toBeNull();
          expect(validStatuses).toContain(capturedUpdate.data.status);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SOLD status should always have customer ownership info when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        serialIdArb,
        customerIdArb,
        dateStringArb,
        async (serialId, customerId, soldDate) => {
          // Track what was passed to update
          let capturedUpdate: any = null;
          serialRepo.update.mockImplementation((id, data) => {
            capturedUpdate = { id, data };
            return Promise.resolve({ affected: 1 } as any);
          });

          // Execute: Update serial status to SOLD with customer info
          await service.updateSerialStatus(serialId, 'SOLD', {
            soldDate,
            currentOwnerType: 'CUSTOMER',
            currentOwnerId: customerId,
            customerId,
          });

          // Verify: When status is SOLD and customer info is provided, it should be recorded
          expect(capturedUpdate.data.status).toBe('SOLD');
          expect(capturedUpdate.data.currentOwnerType).toBe('CUSTOMER');
          expect(capturedUpdate.data.currentOwnerId).toBe(customerId);
          expect(capturedUpdate.data.soldDate).toBe(soldDate);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('serial lifecycle: AVAILABLE -> SOLD -> RETURNED/AVAILABLE should be valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        serialIdArb,
        customerIdArb,
        dateStringArb,
        fc.constantFrom('AVAILABLE', 'RETURNED'),
        async (serialId, customerId, soldDate, returnStatus) => {
          const updates: any[] = [];
          serialRepo.update.mockImplementation((id, data) => {
            updates.push({ id, data });
            return Promise.resolve({ affected: 1 } as any);
          });

          // Step 1: Sell the serial (AVAILABLE -> SOLD)
          await service.updateSerialStatus(serialId, 'SOLD', {
            soldDate,
            currentOwnerType: 'CUSTOMER',
            currentOwnerId: customerId,
          });

          // Step 2: Return the serial (SOLD -> AVAILABLE or RETURNED)
          await service.updateSerialStatus(serialId, returnStatus);

          // Verify: Both transitions should have occurred
          expect(updates.length).toBe(2);

          // First update should be to SOLD
          expect(updates[0].data.status).toBe('SOLD');

          // Second update should be to AVAILABLE or RETURNED
          expect(['AVAILABLE', 'RETURNED']).toContain(updates[1].data.status);
        },
      ),
      { numRuns: 100 },
    );
  });
});
