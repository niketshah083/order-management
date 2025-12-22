# Legacy Inventory Cleanup Guide

## Overview

This guide documents the steps to remove legacy inventory entities after the enterprise inventory system migration is complete and verified.

## Prerequisites

Before removing legacy code:

1. ✅ Run migration `1734400000000-MigrateLegacyInventoryToEnterprise`
2. ✅ Run verification `1734400001000-VerifyMigrationBalances`
3. ✅ Verify no discrepancies in `migration_discrepancy_report` table
4. ✅ Test all inventory operations in production for at least 2 weeks
5. ✅ Backup the database

## Phase 9: Cleanup Legacy Code

### Task 26.1: Remove DistributorInventoryEntity from InventoryService

**Files to modify:**

- `src/inventory/inventory.service.ts`

**Changes:**

1. Remove import: `import { DistributorInventoryEntity } from './entities/distributor-inventory.entity';`
2. Remove repository injection: `@InjectRepository(DistributorInventoryEntity) private inventoryRepository`
3. Remove all direct queries using `this.inventoryRepository`
4. Update methods to use `InventoryCoreService` exclusively

### Task 26.2: Remove BatchDetailEntity from InventoryService

**Files to modify:**

- `src/inventory/inventory.service.ts`

**Changes:**

1. Remove import: `import { BatchDetailEntity } from './entities/batch-detail.entity';`
2. Remove repository injection: `@InjectRepository(BatchDetailEntity) private batchDetailRepository`
3. Remove all direct queries using `this.batchDetailRepository`
4. Update methods to use `InventoryCoreService.getLotByNumber()` and related methods

### Task 26.3: Remove SerialDetailEntity from InventoryService

**Files to modify:**

- `src/inventory/inventory.service.ts`

**Changes:**

1. Remove import: `import { SerialDetailEntity } from './entities/serial-detail.entity';`
2. Remove repository injection: `@InjectRepository(SerialDetailEntity) private serialDetailRepository`
3. Remove all direct queries using `this.serialDetailRepository`
4. Update methods to use `InventoryCoreService.getSerialByNumber()` and related methods

### Task 27.1: Remove legacy entities from InventoryModule TypeORM imports

**Files to modify:**

- `src/inventory/inventory.module.ts`

**Changes:**

1. Remove from TypeOrmModule.forFeature():
   - `DistributorInventoryEntity`
   - `BatchDetailEntity`
   - `SerialDetailEntity`

### Task 27.2: Remove legacy entities from other modules

**Files to check:**

- `src/billing/billing.module.ts`
- `src/orders/orders.module.ts`
- `src/returns/returns.module.ts`

## Phase 10: Database Cleanup

### Task 29.1: Drop Legacy Tables

**IMPORTANT: Only execute after full verification in production!**

```sql
-- Backup tables first
CREATE TABLE distributor_inventory_backup AS SELECT * FROM distributor_inventory;
CREATE TABLE batch_details_backup AS SELECT * FROM batch_details;
CREATE TABLE serial_details_backup AS SELECT * FROM serial_details;

-- Drop legacy tables
DROP TABLE serial_details;
DROP TABLE batch_details;
DROP TABLE distributor_inventory;

-- Drop backup tables after 30 days if no issues
-- DROP TABLE serial_details_backup;
-- DROP TABLE batch_details_backup;
-- DROP TABLE distributor_inventory_backup;
```

## Rollback Plan

If issues are found after cleanup:

1. Restore from backup tables
2. Re-add entity imports to modules
3. Re-add repository injections to services
4. Run migration down scripts

## Verification Checklist

- [ ] All inventory queries return correct data
- [ ] GRN approval creates correct transactions
- [ ] Billing deducts inventory correctly
- [ ] Sales returns add inventory correctly
- [ ] Purchase returns deduct inventory correctly
- [ ] Reports show accurate data
- [ ] Excel exports work correctly
- [ ] No errors in application logs
