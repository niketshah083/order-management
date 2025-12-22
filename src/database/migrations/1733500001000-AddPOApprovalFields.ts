import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPOApprovalFields1733500001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if rejectedBy column exists
    const table = await queryRunner.getTable('purchase_order_master');
    const rejectedByColumn = table?.findColumnByName('rejectedBy');
    
    if (!rejectedByColumn) {
      await queryRunner.addColumn(
        'purchase_order_master',
        new TableColumn({
          name: 'rejectedBy',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    // Check if rejectedAt column exists
    const rejectedAtColumn = table?.findColumnByName('rejectedAt');
    
    if (!rejectedAtColumn) {
      await queryRunner.addColumn(
        'purchase_order_master',
        new TableColumn({
          name: 'rejectedAt',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }

    // Ensure approvalStatus has proper default
    const approvalStatusColumn = table?.findColumnByName('approvalStatus');
    if (approvalStatusColumn && approvalStatusColumn.default !== "'PENDING'") {
      await queryRunner.query(
        `ALTER TABLE purchase_order_master MODIFY COLUMN approvalStatus VARCHAR(50) DEFAULT 'PENDING'`,
      );
    }

    // Update existing records to have PENDING approval status if null
    await queryRunner.query(
      `UPDATE purchase_order_master SET approvalStatus = 'PENDING' WHERE approvalStatus IS NULL OR approvalStatus = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('purchase_order_master');
    
    if (table?.findColumnByName('rejectedBy')) {
      await queryRunner.dropColumn('purchase_order_master', 'rejectedBy');
    }
    
    if (table?.findColumnByName('rejectedAt')) {
      await queryRunner.dropColumn('purchase_order_master', 'rejectedAt');
    }
  }
}
