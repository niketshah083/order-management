-- ═══════════════════════════════════════════════════════════════════════════════
-- LEGACY TABLE REMOVAL SCRIPT
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- WARNING: Execute this script ONLY after:
-- 1. Migration has been verified in production for at least 2 weeks
-- 2. No discrepancies found in migration_discrepancy_report table
-- 3. All inventory operations are working correctly
-- 4. Database backup has been taken
--
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Create backup tables (keep for 30 days)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS serial_details_backup AS 
SELECT * FROM serial_details;

CREATE TABLE IF NOT EXISTS batch_details_backup AS 
SELECT * FROM batch_details;

CREATE TABLE IF NOT EXISTS distributor_inventory_backup AS 
SELECT * FROM distributor_inventory;

-- Add timestamp to track when backup was created
ALTER TABLE serial_details_backup ADD COLUMN backup_created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE batch_details_backup ADD COLUMN backup_created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE distributor_inventory_backup ADD COLUMN backup_created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Verify backup counts match original
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
  'serial_details' as table_name,
  (SELECT COUNT(*) FROM serial_details) as original_count,
  (SELECT COUNT(*) FROM serial_details_backup) as backup_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM serial_details) = (SELECT COUNT(*) FROM serial_details_backup) 
    THEN 'OK' 
    ELSE 'MISMATCH - DO NOT PROCEED' 
  END as status
UNION ALL
SELECT 
  'batch_details',
  (SELECT COUNT(*) FROM batch_details),
  (SELECT COUNT(*) FROM batch_details_backup),
  CASE 
    WHEN (SELECT COUNT(*) FROM batch_details) = (SELECT COUNT(*) FROM batch_details_backup) 
    THEN 'OK' 
    ELSE 'MISMATCH - DO NOT PROCEED' 
  END
UNION ALL
SELECT 
  'distributor_inventory',
  (SELECT COUNT(*) FROM distributor_inventory),
  (SELECT COUNT(*) FROM distributor_inventory_backup),
  CASE 
    WHEN (SELECT COUNT(*) FROM distributor_inventory) = (SELECT COUNT(*) FROM distributor_inventory_backup) 
    THEN 'OK' 
    ELSE 'MISMATCH - DO NOT PROCEED' 
  END;

-- Step 3: Drop legacy tables (ONLY if backup verification passed)
-- ═══════════════════════════════════════════════════════════════════════════════
-- UNCOMMENT THE FOLLOWING LINES ONLY AFTER VERIFYING BACKUPS

-- DROP TABLE IF EXISTS serial_details;
-- DROP TABLE IF EXISTS batch_details;
-- DROP TABLE IF EXISTS distributor_inventory;

-- Step 4: Clean up backup tables after 30 days (optional)
-- ═══════════════════════════════════════════════════════════════════════════════
-- UNCOMMENT THE FOLLOWING LINES AFTER 30 DAYS IF NO ISSUES

-- DROP TABLE IF EXISTS serial_details_backup;
-- DROP TABLE IF EXISTS batch_details_backup;
-- DROP TABLE IF EXISTS distributor_inventory_backup;

-- Step 5: Clean up migration discrepancy report table (optional)
-- ═══════════════════════════════════════════════════════════════════════════════
-- UNCOMMENT AFTER ALL DISCREPANCIES ARE RESOLVED

-- DROP TABLE IF EXISTS migration_discrepancy_report;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK SCRIPT (if needed)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- To restore legacy tables from backup:
--
-- CREATE TABLE serial_details AS SELECT * FROM serial_details_backup;
-- CREATE TABLE batch_details AS SELECT * FROM batch_details_backup;
-- CREATE TABLE distributor_inventory AS SELECT * FROM distributor_inventory_backup;
--
-- Then re-add foreign key constraints as needed.
-- ═══════════════════════════════════════════════════════════════════════════════
