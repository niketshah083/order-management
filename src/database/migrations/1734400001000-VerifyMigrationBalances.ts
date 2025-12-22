import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration Verification: Verify calculated balances match original quantities
 *
 * Requirements 7.4, 7.5: Verify migration and report discrepancies
 *
 * This migration verifies that:
 * 1. Calculated stock balances from transactions match original distributor_inventory quantities
 * 2. Reports any discrepancies for manual correction
 */
export class VerifyMigrationBalances1734400001000
  implements MigrationInterface
{
  name = 'VerifyMigrationBalances1734400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if legacy tables exist
    const legacyTablesExist = await this.checkLegacyTablesExist(queryRunner);
    if (!legacyTablesExist) {
      console.log('Legacy tables do not exist, skipping verification');
      return;
    }

    console.log('Verifying migration balances...');

    // Compare calculated balances with original quantities
    const discrepancies = await queryRunner.query(`
      SELECT 
        di.id as legacyId,
        di.distributorId,
        di.itemId,
        di.quantity as originalQuantity,
        COALESCE(calc.calculatedQuantity, 0) as calculatedQuantity,
        di.quantity - COALESCE(calc.calculatedQuantity, 0) as difference
      FROM distributor_inventory di
      LEFT JOIN (
        SELECT 
          itemId,
          distributorId,
          SUM(CASE 
            WHEN movementType = 'IN' THEN quantity
            WHEN movementType = 'OUT' THEN -quantity
            WHEN movementType = 'RESERVE' THEN -quantity
            WHEN movementType = 'RELEASE' THEN quantity
            ELSE 0 
          END) as calculatedQuantity
        FROM inventory_transaction
        WHERE status = 'COMPLETED'
        GROUP BY itemId, distributorId
      ) calc ON di.itemId = calc.itemId AND di.distributorId = calc.distributorId
      WHERE di.quantity != COALESCE(calc.calculatedQuantity, 0)
    `);

    if (discrepancies.length > 0) {
      console.log('='.repeat(80));
      console.log('MIGRATION VERIFICATION: DISCREPANCIES FOUND');
      console.log('='.repeat(80));
      console.log(`Found ${discrepancies.length} discrepancies:`);
      console.log('');

      for (const d of discrepancies) {
        console.log(`  Legacy ID: ${d.legacyId}`);
        console.log(`  Distributor: ${d.distributorId}, Item: ${d.itemId}`);
        console.log(`  Original Quantity: ${d.originalQuantity}`);
        console.log(`  Calculated Quantity: ${d.calculatedQuantity}`);
        console.log(`  Difference: ${d.difference}`);
        console.log('-'.repeat(40));
      }

      console.log('');
      console.log(
        'ACTION REQUIRED: Please review and correct these discrepancies manually.',
      );
      console.log(
        'You may need to create adjustment transactions to reconcile the balances.',
      );
      console.log('='.repeat(80));

      // Create a discrepancy report table for reference
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS migration_discrepancy_report (
          id INT AUTO_INCREMENT PRIMARY KEY,
          legacyId INT,
          distributorId INT,
          itemId INT,
          originalQuantity DECIMAL(16,4),
          calculatedQuantity DECIMAL(16,4),
          difference DECIMAL(16,4),
          status VARCHAR(50) DEFAULT 'PENDING',
          resolvedAt DATETIME,
          resolvedBy INT,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert discrepancies into report table
      for (const d of discrepancies) {
        await queryRunner.query(
          `
          INSERT INTO migration_discrepancy_report 
          (legacyId, distributorId, itemId, originalQuantity, calculatedQuantity, difference)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            d.legacyId,
            d.distributorId,
            d.itemId,
            d.originalQuantity,
            d.calculatedQuantity,
            d.difference,
          ],
        );
      }

      console.log(
        'Discrepancies have been logged to migration_discrepancy_report table.',
      );
    } else {
      console.log('='.repeat(80));
      console.log('MIGRATION VERIFICATION: SUCCESS');
      console.log('='.repeat(80));
      console.log('All calculated balances match original quantities.');
      console.log('Migration completed successfully with no discrepancies.');
      console.log('='.repeat(80));
    }

    // Verify lot counts
    const lotCounts = await queryRunner.query(`
      SELECT 
        (SELECT COUNT(*) FROM batch_details) as legacyBatchCount,
        (SELECT COUNT(*) FROM inventory_lot) as enterpriseLotCount
    `);

    console.log('');
    console.log('Lot Migration Summary:');
    console.log(
      `  Legacy batch_details: ${lotCounts[0]?.legacyBatchCount || 0}`,
    );
    console.log(
      `  Enterprise inventory_lot: ${lotCounts[0]?.enterpriseLotCount || 0}`,
    );

    // Verify serial counts
    const serialCounts = await queryRunner.query(`
      SELECT 
        (SELECT COUNT(*) FROM serial_details) as legacySerialCount,
        (SELECT COUNT(*) FROM inventory_serial) as enterpriseSerialCount
    `);

    console.log('');
    console.log('Serial Migration Summary:');
    console.log(
      `  Legacy serial_details: ${serialCounts[0]?.legacySerialCount || 0}`,
    );
    console.log(
      `  Enterprise inventory_serial: ${serialCounts[0]?.enterpriseSerialCount || 0}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the discrepancy report table if it exists
    await queryRunner.query(
      `DROP TABLE IF EXISTS migration_discrepancy_report`,
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
