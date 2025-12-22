import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Migrate Legacy Inventory Data to Enterprise System
 *
 * This migration:
 * 1. Creates inventory_lot records from batch_details (Requirements 7.1)
 * 2. Creates inventory_serial records from serial_details (Requirements 7.2)
 * 3. Creates OPENING_STOCK transactions for initial balances (Requirements 7.3)
 *
 * Note: This migration should be run after all services have been updated
 * to use the enterprise inventory system.
 */
export class MigrateLegacyInventoryToEnterprise1734400000000
  implements MigrationInterface
{
  name = 'MigrateLegacyInventoryToEnterprise1734400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if legacy tables exist
    const legacyTablesExist = await this.checkLegacyTablesExist(queryRunner);
    if (!legacyTablesExist) {
      console.log('Legacy tables do not exist, skipping migration');
      return;
    }

    // Step 1: Create default warehouses for distributors that don't have one
    console.log('Step 1: Creating default warehouses...');
    await queryRunner.query(`
      INSERT INTO warehouse (code, name, type, distributorId, isActive, createdAt, updatedAt)
      SELECT 
        CONCAT('WH-', di.distributorId),
        CONCAT('Distributor ', di.distributorId, ' - Main Warehouse'),
        'MAIN',
        di.distributorId,
        1,
        NOW(),
        NOW()
      FROM (SELECT DISTINCT distributorId FROM distributor_inventory) di
      WHERE NOT EXISTS (
        SELECT 1 FROM warehouse w 
        WHERE w.distributorId = di.distributorId AND w.type = 'MAIN'
      )
    `);

    // Step 2: Create inventory_lot records from batch_details (Requirements 7.1)
    console.log('Step 2: Migrating batch_details to inventory_lot...');
    await queryRunner.query(`
      INSERT INTO inventory_lot (
        lotNumber, itemId, distributorId, warehouseId,
        expiryDate, manufactureDate, receivedDate,
        unitCost, status, qualityStatus,
        createdAt, updatedAt
      )
      SELECT 
        bd.batchNumber,
        di.itemId,
        di.distributorId,
        (SELECT id FROM warehouse WHERE distributorId = di.distributorId AND type = 'MAIN' LIMIT 1),
        bd.expiryDate,
        bd.manufactureDate,
        COALESCE(bd.createdAt, NOW()),
        bd.rate,
        'ACTIVE',
        'APPROVED',
        COALESCE(bd.createdAt, NOW()),
        COALESCE(bd.updatedAt, NOW())
      FROM batch_details bd
      INNER JOIN distributor_inventory di ON bd.inventoryId = di.id
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_lot il 
        WHERE il.lotNumber = bd.batchNumber 
        AND il.itemId = di.itemId 
        AND il.distributorId = di.distributorId
      )
    `);

    // Step 3: Create inventory_serial records from serial_details (Requirements 7.2)
    console.log('Step 3: Migrating serial_details to inventory_serial...');
    await queryRunner.query(`
      INSERT INTO inventory_serial (
        serialNumber, itemId, distributorId, lotId,
        currentWarehouseId, status, qualityStatus,
        currentOwnerType, currentOwnerId,
        receivedDate, unitCost,
        createdAt, updatedAt
      )
      SELECT 
        sd.serialNumber,
        di.itemId,
        di.distributorId,
        (SELECT il.id FROM inventory_lot il 
         WHERE il.lotNumber = sd.batchNumber 
         AND il.itemId = di.itemId 
         AND il.distributorId = di.distributorId 
         LIMIT 1),
        (SELECT id FROM warehouse WHERE distributorId = di.distributorId AND type = 'MAIN' LIMIT 1),
        CASE 
          WHEN sd.status = 'AVAILABLE' THEN 'AVAILABLE'
          WHEN sd.status = 'SOLD' THEN 'SOLD'
          WHEN sd.status = 'RETURNED' THEN 'RETURNED'
          ELSE 'AVAILABLE'
        END,
        'APPROVED',
        'DISTRIBUTOR',
        di.distributorId,
        COALESCE(sd.createdAt, NOW()),
        sd.rate,
        COALESCE(sd.createdAt, NOW()),
        COALESCE(sd.updatedAt, NOW())
      FROM serial_details sd
      INNER JOIN distributor_inventory di ON sd.inventoryId = di.id
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_serial iser 
        WHERE iser.serialNumber = sd.serialNumber 
        AND iser.itemId = di.itemId
      )
    `);

    // Step 4: Create OPENING_STOCK transactions for initial balances (Requirements 7.3)
    console.log('Step 4: Creating OPENING_STOCK transactions...');
    await queryRunner.query(`
      INSERT INTO inventory_transaction (
        transactionNo, transactionDate, transactionType, movementType,
        itemId, quantity, warehouseId, distributorId,
        referenceType, referenceNo, unitCost, totalCost,
        status, remarks, createdBy, createdAt, updatedAt
      )
      SELECT 
        CONCAT('OPEN-', di.id, '-', UNIX_TIMESTAMP()),
        COALESCE(di.createdAt, NOW()),
        'OPENING_STOCK',
        'IN',
        di.itemId,
        di.quantity,
        (SELECT id FROM warehouse WHERE distributorId = di.distributorId AND type = 'MAIN' LIMIT 1),
        di.distributorId,
        'OPENING',
        CONCAT('Opening stock migration from distributor_inventory #', di.id),
        COALESCE(di.rate, 0),
        COALESCE(di.rate, 0) * di.quantity,
        'COMPLETED',
        'Migrated from legacy distributor_inventory table',
        di.distributorId,
        NOW(),
        NOW()
      FROM distributor_inventory di
      WHERE di.quantity > 0
      AND NOT EXISTS (
        SELECT 1 FROM inventory_transaction it 
        WHERE it.transactionType = 'OPENING_STOCK'
        AND it.itemId = di.itemId 
        AND it.distributorId = di.distributorId
        AND it.referenceNo LIKE CONCAT('%distributor_inventory #', di.id, '%')
      )
    `);

    console.log('Migration completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove migrated data (be careful - this will delete enterprise data!)
    console.log('Rolling back migration...');

    // Remove OPENING_STOCK transactions created by this migration
    await queryRunner.query(`
      DELETE FROM inventory_transaction 
      WHERE transactionType = 'OPENING_STOCK' 
      AND remarks = 'Migrated from legacy distributor_inventory table'
    `);

    // Note: We don't delete inventory_lot and inventory_serial records
    // as they may have been used by new transactions
    console.log(
      'Rollback completed. Note: inventory_lot and inventory_serial records were preserved.',
    );
  }

  private async checkLegacyTablesExist(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    try {
      const tables = await queryRunner.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('distributor_inventory', 'batch_details', 'serial_details')
      `);
      return tables.length === 3;
    } catch {
      return false;
    }
  }
}
