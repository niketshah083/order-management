import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeSchemaAndAddAuditFields1733500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create billing_items table to normalize billing.items JSON field
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS billing_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        billingId INT NOT NULL,
        itemId INT NOT NULL,
        itemName VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        quantity DECIMAL(16,4) NOT NULL,
        rate DECIMAL(12,2) NOT NULL,
        discount DECIMAL(12,2) DEFAULT 0,
        discountType VARCHAR(20) DEFAULT 'percentage',
        taxableAmount DECIMAL(12,2) NOT NULL,
        cgst DECIMAL(12,2) NOT NULL,
        sgst DECIMAL(12,2) NOT NULL,
        igst DECIMAL(12,2) NOT NULL,
        totalAmount DECIMAL(12,2) NOT NULL,
        batchNumber VARCHAR(255) NULL,
        serialNumber VARCHAR(255) NULL,
        expiryDate DATE NULL,
        orderedByBox BOOLEAN DEFAULT FALSE,
        boxCount INT DEFAULT 0,
        boxRate DECIMAL(12,2) NULL,
        unitsPerBox INT DEFAULT 1,
        FOREIGN KEY (billingId) REFERENCES billings(id) ON DELETE CASCADE,
        FOREIGN KEY (itemId) REFERENCES item_master(id),
        INDEX idx_billing_items_billingId (billingId),
        INDEX idx_billing_items_itemId (itemId)
      );
    `);

    // Create internal_user_distributor join table to normalize internal_users.distributorIds JSON field
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS internal_user_distributor (
        internalUserId INT NOT NULL,
        distributorId INT NOT NULL,
        assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (internalUserId, distributorId),
        FOREIGN KEY (internalUserId) REFERENCES internal_users(id) ON DELETE CASCADE,
        FOREIGN KEY (distributorId) REFERENCES distributor_master(id) ON DELETE CASCADE,
        INDEX idx_internal_user_distributor_internalUserId (internalUserId),
        INDEX idx_internal_user_distributor_distributorId (distributorId)
      );
    `);

    // Add audit fields to user_master
    await queryRunner.query(`
      ALTER TABLE user_master
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP NULL;
    `);

    // Add audit fields to distributor_master
    await queryRunner.query(`
      ALTER TABLE distributor_master
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP NULL;
    `);

    // Add audit fields to customers
    await queryRunner.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP NULL;
    `);

    // Add audit fields to categories
    await queryRunner.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP NULL;
    `);

    // Add audit fields to internal_users
    await queryRunner.query(`
      ALTER TABLE internal_users
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP NULL;
    `);

    // Add audit fields to order_master
    await queryRunner.query(`
      ALTER TABLE order_master
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL;
    `);

    // Add audit fields to purchase_order_master
    await queryRunner.query(`
      ALTER TABLE purchase_order_master
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL;
    `);

    // Add audit fields to grn_master
    await queryRunner.query(`
      ALTER TABLE grn_master
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL;
    `);

    // Add audit fields to billings
    await queryRunner.query(`
      ALTER TABLE billings
      ADD COLUMN IF NOT EXISTS createdBy INT NULL,
      ADD COLUMN IF NOT EXISTS updatedBy INT NULL,
      ADD COLUMN IF NOT EXISTS createdByIp VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS updatedByIp VARCHAR(50) NULL;
    `);

    // Add indexes for frequently queried fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_master_email ON user_master(email);
      CREATE INDEX IF NOT EXISTS idx_user_master_mobileNo ON user_master(mobileNo);
      CREATE INDEX IF NOT EXISTS idx_distributor_master_userId ON distributor_master(userId);
      CREATE INDEX IF NOT EXISTS idx_distributor_master_gstin ON distributor_master(gstin);
      CREATE INDEX IF NOT EXISTS idx_customers_distributorId ON customers(distributorId);
      CREATE INDEX IF NOT EXISTS idx_customers_mobileNo ON customers(mobileNo);
      CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);
      CREATE INDEX IF NOT EXISTS idx_categories_parentCategoryId ON categories(parentCategoryId);
      CREATE INDEX IF NOT EXISTS idx_order_master_orderNo ON order_master(orderNo);
      CREATE INDEX IF NOT EXISTS idx_order_master_customerId ON order_master(customerId);
      CREATE INDEX IF NOT EXISTS idx_order_master_status ON order_master(status);
      CREATE INDEX IF NOT EXISTS idx_order_master_createdAt ON order_master(createdAt);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_master_poNo ON purchase_order_master(poNo);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_master_distributorId ON purchase_order_master(distributorId);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_master_status ON purchase_order_master(status);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_master_approvalStatus ON purchase_order_master(approvalStatus);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_master_createdAt ON purchase_order_master(createdAt);
      CREATE INDEX IF NOT EXISTS idx_grn_master_grnNo ON grn_master(grnNo);
      CREATE INDEX IF NOT EXISTS idx_grn_master_purchaseOrderId ON grn_master(purchaseOrderId);
      CREATE INDEX IF NOT EXISTS idx_grn_master_distributorId ON grn_master(distributorId);
      CREATE INDEX IF NOT EXISTS idx_grn_master_status ON grn_master(status);
      CREATE INDEX IF NOT EXISTS idx_grn_master_createdAt ON grn_master(createdAt);
      CREATE INDEX IF NOT EXISTS idx_billings_billNo ON billings(billNo);
      CREATE INDEX IF NOT EXISTS idx_billings_customerId ON billings(customerId);
      CREATE INDEX IF NOT EXISTS idx_billings_distributorId ON billings(distributorId);
      CREATE INDEX IF NOT EXISTS idx_billings_status ON billings(status);
      CREATE INDEX IF NOT EXISTS idx_billings_billDate ON billings(billDate);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new tables
    await queryRunner.query(`DROP TABLE IF EXISTS billing_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS internal_user_distributor;`);

    // Remove audit fields (reverse migration)
    await queryRunner.query(`
      ALTER TABLE user_master
      DROP COLUMN IF EXISTS createdBy,
      DROP COLUMN IF EXISTS updatedBy,
      DROP COLUMN IF EXISTS createdByIp,
      DROP COLUMN IF EXISTS updatedByIp,
      DROP COLUMN IF EXISTS deletedAt;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_master_email ON user_master;
      DROP INDEX IF EXISTS idx_user_master_mobileNo ON user_master;
      DROP INDEX IF EXISTS idx_distributor_master_userId ON distributor_master;
      DROP INDEX IF EXISTS idx_distributor_master_gstin ON distributor_master;
      DROP INDEX IF EXISTS idx_customers_distributorId ON customers;
      DROP INDEX IF EXISTS idx_customers_mobileNo ON customers;
      DROP INDEX IF EXISTS idx_customers_gstin ON customers;
      DROP INDEX IF EXISTS idx_categories_parentCategoryId ON categories;
      DROP INDEX IF EXISTS idx_order_master_orderNo ON order_master;
      DROP INDEX IF EXISTS idx_order_master_customerId ON order_master;
      DROP INDEX IF EXISTS idx_order_master_status ON order_master;
      DROP INDEX IF EXISTS idx_order_master_createdAt ON order_master;
      DROP INDEX IF EXISTS idx_purchase_order_master_poNo ON purchase_order_master;
      DROP INDEX IF EXISTS idx_purchase_order_master_distributorId ON purchase_order_master;
      DROP INDEX IF EXISTS idx_purchase_order_master_status ON purchase_order_master;
      DROP INDEX IF EXISTS idx_purchase_order_master_approvalStatus ON purchase_order_master;
      DROP INDEX IF EXISTS idx_purchase_order_master_createdAt ON purchase_order_master;
      DROP INDEX IF EXISTS idx_grn_master_grnNo ON grn_master;
      DROP INDEX IF EXISTS idx_grn_master_purchaseOrderId ON grn_master;
      DROP INDEX IF EXISTS idx_grn_master_distributorId ON grn_master;
      DROP INDEX IF EXISTS idx_grn_master_status ON grn_master;
      DROP INDEX IF EXISTS idx_grn_master_createdAt ON grn_master;
      DROP INDEX IF EXISTS idx_billings_billNo ON billings;
      DROP INDEX IF EXISTS idx_billings_customerId ON billings;
      DROP INDEX IF EXISTS idx_billings_distributorId ON billings;
      DROP INDEX IF EXISTS idx_billings_status ON billings;
      DROP INDEX IF EXISTS idx_billings_billDate ON billings;
    `);
  }
}
