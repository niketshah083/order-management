import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddDistributorIdIndexes1734355200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on inventory_lot.distributorId for distributor data isolation
    const lotTable = await queryRunner.getTable('inventory_lot');
    if (lotTable) {
      const existingLotIndex = lotTable.indices.find(
        (idx) =>
          idx.columnNames.length === 1 &&
          idx.columnNames[0] === 'distributorId',
      );

      if (!existingLotIndex) {
        await queryRunner.createIndex(
          'inventory_lot',
          new TableIndex({
            name: 'IDX_inventory_lot_distributorId',
            columnNames: ['distributorId'],
          }),
        );
      }
    }

    // Add index on inventory_serial.distributorId for distributor data isolation
    const serialTable = await queryRunner.getTable('inventory_serial');
    if (serialTable) {
      const existingSerialIndex = serialTable.indices.find(
        (idx) =>
          idx.columnNames.length === 1 &&
          idx.columnNames[0] === 'distributorId',
      );

      if (!existingSerialIndex) {
        await queryRunner.createIndex(
          'inventory_serial',
          new TableIndex({
            name: 'IDX_inventory_serial_distributorId',
            columnNames: ['distributorId'],
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index from inventory_lot
    const lotTable = await queryRunner.getTable('inventory_lot');
    if (lotTable) {
      const lotIndex = lotTable.indices.find(
        (idx) => idx.name === 'IDX_inventory_lot_distributorId',
      );
      if (lotIndex) {
        await queryRunner.dropIndex('inventory_lot', lotIndex);
      }
    }

    // Remove index from inventory_serial
    const serialTable = await queryRunner.getTable('inventory_serial');
    if (serialTable) {
      const serialIndex = serialTable.indices.find(
        (idx) => idx.name === 'IDX_inventory_serial_distributorId',
      );
      if (serialIndex) {
        await queryRunner.dropIndex('inventory_serial', serialIndex);
      }
    }
  }
}
