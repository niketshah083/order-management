import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDuplicateInventoryFields1733068800000
  implements MigrationInterface
{
  name = 'RemoveDuplicateInventoryFields1733068800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove duplicate fields from distributor_inventory table
    // These fields are now tracked exclusively in batch_details and serial_details tables

    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      DROP COLUMN \`batchNumber\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      DROP COLUMN \`serialNumber\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      DROP COLUMN \`expiryDate\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore columns if rollback is needed
    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      ADD COLUMN \`batchNumber\` varchar(255) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      ADD COLUMN \`serialNumber\` varchar(255) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`distributor_inventory\` 
      ADD COLUMN \`expiryDate\` date NULL
    `);
  }
}
