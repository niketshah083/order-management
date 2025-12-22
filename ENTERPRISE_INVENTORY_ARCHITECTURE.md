# 🏢 Enterprise-Grade Inventory Management Architecture

## Executive Summary

This document outlines a **multi-billion dollar SaaS-level** inventory management architecture with complete batch and serial number traceability across all modules.

---

## 🎯 Key Principles

1. **Single Source of Truth** - One inventory transaction table for ALL movements
2. **Complete Traceability** - Track every unit from receipt to sale to return
3. **FIFO/FEFO Support** - First In First Out / First Expiry First Out
4. **Real-time Stock** - Calculated from transactions, not stored values
5. **Audit Trail** - Every change is logged with who, when, why
6. **Multi-location** - Support warehouses, bins, zones
7. **Reservation System** - Reserve stock before actual movement

---

## 📊 Current vs Proposed Architecture

### ❌ Current Issues

```
CURRENT STRUCTURE (Fragmented):
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  distributor_inventory ──► batch_details                        │
│         │                      │                                 │
│         │                      └── NOT linked to GRN/Billing    │
│         │                                                        │
│  grn_batch_details ──► Separate table, no link to inventory     │
│                                                                  │
│  billing_batch_details ──► Separate table, manual deduction     │
│                                                                  │
│  PROBLEMS:                                                       │
│  • No unified transaction history                                │
│  • Batch quantities can go out of sync                          │
│  • No reservation system                                         │
│  • No FIFO/FEFO enforcement                                     │
│  • Difficult to trace product journey                           │
│  • No multi-location support                                    │
│  • Manual stock calculations                                    │
└─────────────────────────────────────────────────────────────────┘
```

### ✅ Proposed Enterprise Architecture

```
PROPOSED STRUCTURE (Unified):
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        ┌─────────────────────┐                              │
│                        │    item_master      │                              │
│                        │  (Product Catalog)  │                              │
│                        └──────────┬──────────┘                              │
│                                   │                                          │
│              ┌────────────────────┼────────────────────┐                    │
│              │                    │                    │                    │
│              ▼                    ▼                    ▼                    │
│  ┌───────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │   inventory_lot   │  │ inventory_serial│  │  warehouse      │           │
│  │  (Batch Master)   │  │ (Serial Master) │  │  (Locations)    │           │
│  └─────────┬─────────┘  └────────┬────────┘  └────────┬────────┘           │
│            │                     │                    │                     │
│            └─────────────────────┼────────────────────┘                     │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌─────────────────────────┐                              │
│                    │  inventory_transaction  │ ◄── SINGLE SOURCE OF TRUTH  │
│                    │   (All Stock Movements) │                              │
│                    └─────────────────────────┘                              │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                 │
│         │            │           │           │            │                 │
│         ▼            ▼           ▼           ▼            ▼                 │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│    │   GRN   │ │ BILLING │ │ RETURNS │ │TRANSFER │ │ ADJUST  │             │
│    └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
│                                                                              │
│  BENEFITS:                                                                   │
│  ✅ Single transaction table for all movements                              │
│  ✅ Real-time stock from SUM of transactions                                │
│  ✅ Complete audit trail                                                    │
│  ✅ FIFO/FEFO automatic enforcement                                         │
│  ✅ Reservation system built-in                                             │
│  ✅ Multi-location support                                                  │
│  ✅ Full traceability                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Enterprise Database Schema

### 1. Location Management

```sql
-- Warehouse/Location hierarchy
CREATE TABLE warehouse (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type ENUM('MAIN', 'TRANSIT', 'RETURN', 'QUARANTINE', 'VIRTUAL') DEFAULT 'MAIN',
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    distributor_id BIGINT,  -- NULL for central warehouses
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (distributor_id) REFERENCES user_master(id)
);

-- Storage locations within warehouse (zones, racks, bins)
CREATE TABLE storage_location (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    warehouse_id BIGINT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200),
    type ENUM('ZONE', 'RACK', 'SHELF', 'BIN') DEFAULT 'BIN',
    parent_location_id BIGINT,  -- For hierarchy
    capacity DECIMAL(16,4),
    capacity_unit VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    FOREIGN KEY (parent_location_id) REFERENCES storage_location(id),
    UNIQUE KEY (warehouse_id, code)
);
```

### 2. Inventory Lot (Batch) Master

```sql
-- Master table for all batches/lots
CREATE TABLE inventory_lot (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- Identification
    lot_number VARCHAR(100) NOT NULL,
    item_id BIGINT NOT NULL,

    -- Dates
    manufacture_date DATE,
    expiry_date DATE,
    received_date DATE,

    -- Source tracking
    supplier_id BIGINT,
    supplier_batch_no VARCHAR(100),  -- Vendor's batch number
    purchase_order_id BIGINT,
    grn_id BIGINT,

    -- Quality
    quality_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'QUARANTINE') DEFAULT 'APPROVED',
    quality_checked_by BIGINT,
    quality_checked_at TIMESTAMP,
    quality_notes TEXT,

    -- Cost tracking (for FIFO costing)
    unit_cost DECIMAL(16,4),
    landed_cost DECIMAL(16,4),  -- Including freight, duties

    -- Status
    status ENUM('ACTIVE', 'EXPIRED', 'BLOCKED', 'CONSUMED') DEFAULT 'ACTIVE',
    blocked_reason VARCHAR(255),
    blocked_by BIGINT,
    blocked_at TIMESTAMP,

    -- Metadata
    attributes JSON,  -- Custom attributes (color, size, etc.)

    -- Audit
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_order_master(id),
    FOREIGN KEY (grn_id) REFERENCES grn_master(id),

    UNIQUE KEY uk_lot_item (lot_number, item_id),
    INDEX idx_item (item_id),
    INDEX idx_expiry (expiry_date),
    INDEX idx_status (status)
);
```

### 3. Inventory Serial Master

```sql
-- Master table for all serial numbers
CREATE TABLE inventory_serial (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- Identification
    serial_number VARCHAR(200) NOT NULL,
    item_id BIGINT NOT NULL,
    lot_id BIGINT,  -- Optional link to batch

    -- Current state
    status ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'SCRAPPED') DEFAULT 'AVAILABLE',
    current_warehouse_id BIGINT,
    current_location_id BIGINT,
    current_owner_type ENUM('COMPANY', 'DISTRIBUTOR', 'CUSTOMER'),
    current_owner_id BIGINT,

    -- Source tracking
    purchase_order_id BIGINT,
    grn_id BIGINT,
    received_date DATE,

    -- Sale tracking
    billing_id BIGINT,
    sold_date DATE,
    customer_id BIGINT,

    -- Warranty
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_terms TEXT,

    -- Cost
    unit_cost DECIMAL(16,4),
    selling_price DECIMAL(16,4),

    -- Quality
    quality_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'APPROVED',

    -- Metadata
    attributes JSON,  -- IMEI, MAC address, etc.

    -- Audit
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (lot_id) REFERENCES inventory_lot(id),
    FOREIGN KEY (current_warehouse_id) REFERENCES warehouse(id),
    FOREIGN KEY (billing_id) REFERENCES billings(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),

    UNIQUE KEY uk_serial_item (serial_number, item_id),
    INDEX idx_item (item_id),
    INDEX idx_status (status),
    INDEX idx_lot (lot_id)
);
```

### 4. 🔥 Inventory Transaction (CORE TABLE)

```sql
-- THE SINGLE SOURCE OF TRUTH FOR ALL STOCK MOVEMENTS
CREATE TABLE inventory_transaction (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- Transaction identification
    transaction_no VARCHAR(50) UNIQUE NOT NULL,
    transaction_date TIMESTAMP NOT NULL,

    -- Transaction type
    transaction_type ENUM(
        'GRN_RECEIPT',           -- Goods received from PO
        'OPENING_STOCK',         -- Initial stock entry
        'PURCHASE_RETURN',       -- Return to supplier
        'SALES_ISSUE',           -- Sold to customer
        'SALES_RETURN',          -- Return from customer
        'TRANSFER_OUT',          -- Transfer to another location
        'TRANSFER_IN',           -- Transfer from another location
        'ADJUSTMENT_IN',         -- Stock adjustment (increase)
        'ADJUSTMENT_OUT',        -- Stock adjustment (decrease)
        'DAMAGE_WRITE_OFF',      -- Damaged goods
        'EXPIRY_WRITE_OFF',      -- Expired goods
        'PRODUCTION_ISSUE',      -- Issued for production
        'PRODUCTION_RECEIPT',    -- Received from production
        'RESERVATION',           -- Reserved for order
        'RESERVATION_RELEASE'    -- Released reservation
    ) NOT NULL,

    -- Movement direction
    movement_type ENUM('IN', 'OUT', 'RESERVE', 'RELEASE') NOT NULL,

    -- Item details
    item_id BIGINT NOT NULL,
    lot_id BIGINT,              -- Batch reference
    serial_id BIGINT,           -- Serial reference

    -- Quantity
    quantity DECIMAL(16,4) NOT NULL,
    unit VARCHAR(20),

    -- Location
    warehouse_id BIGINT NOT NULL,
    location_id BIGINT,

    -- For transfers
    from_warehouse_id BIGINT,
    from_location_id BIGINT,
    to_warehouse_id BIGINT,
    to_location_id BIGINT,

    -- Reference document
    reference_type ENUM(
        'PURCHASE_ORDER',
        'GRN',
        'BILLING',
        'SALES_RETURN',
        'PURCHASE_RETURN',
        'TRANSFER_ORDER',
        'ADJUSTMENT',
        'PRODUCTION_ORDER'
    ),
    reference_id BIGINT,
    reference_no VARCHAR(100),
    reference_line_id BIGINT,   -- Line item reference

    -- Cost tracking
    unit_cost DECIMAL(16,4),
    total_cost DECIMAL(16,4),

    -- Running balance (for quick queries)
    running_balance DECIMAL(16,4),

    -- Status
    status ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REVERSED') DEFAULT 'COMPLETED',

    -- Reversal tracking
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_by_transaction_id BIGINT,
    reversal_reason VARCHAR(255),

    -- Owner
    distributor_id BIGINT,

    -- Notes
    remarks TEXT,

    -- Audit
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),

    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (lot_id) REFERENCES inventory_lot(id),
    FOREIGN KEY (serial_id) REFERENCES inventory_serial(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    FOREIGN KEY (distributor_id) REFERENCES user_master(id),

    INDEX idx_item_warehouse (item_id, warehouse_id),
    INDEX idx_lot (lot_id),
    INDEX idx_serial (serial_id),
    INDEX idx_reference (reference_type, reference_id),
    INDEX idx_date (transaction_date),
    INDEX idx_type (transaction_type),
    INDEX idx_distributor (distributor_id)
);
```

### 5. Stock Balance View (Calculated from Transactions)

```sql
-- Real-time stock balance calculated from transactions
CREATE VIEW v_stock_balance AS
SELECT
    it.item_id,
    it.warehouse_id,
    it.distributor_id,
    it.lot_id,
    im.name AS item_name,
    im.unit,
    il.lot_number,
    il.expiry_date,
    w.name AS warehouse_name,

    -- Calculate quantities from transactions
    SUM(CASE WHEN it.movement_type = 'IN' THEN it.quantity ELSE 0 END) AS total_in,
    SUM(CASE WHEN it.movement_type = 'OUT' THEN it.quantity ELSE 0 END) AS total_out,
    SUM(CASE WHEN it.movement_type = 'RESERVE' THEN it.quantity ELSE 0 END) AS total_reserved,
    SUM(CASE WHEN it.movement_type = 'RELEASE' THEN it.quantity ELSE 0 END) AS total_released,

    -- Available = IN - OUT - (RESERVED - RELEASED)
    SUM(CASE
        WHEN it.movement_type = 'IN' THEN it.quantity
        WHEN it.movement_type = 'OUT' THEN -it.quantity
        WHEN it.movement_type = 'RESERVE' THEN -it.quantity
        WHEN it.movement_type = 'RELEASE' THEN it.quantity
        ELSE 0
    END) AS available_quantity,

    -- On hand = IN - OUT (ignoring reservations)
    SUM(CASE
        WHEN it.movement_type = 'IN' THEN it.quantity
        WHEN it.movement_type = 'OUT' THEN -it.quantity
        ELSE 0
    END) AS on_hand_quantity,

    -- Reserved quantity
    SUM(CASE
        WHEN it.movement_type = 'RESERVE' THEN it.quantity
        WHEN it.movement_type = 'RELEASE' THEN -it.quantity
        ELSE 0
    END) AS reserved_quantity,

    -- Average cost
    AVG(CASE WHEN it.movement_type = 'IN' THEN it.unit_cost END) AS avg_cost,

    -- Last transaction date
    MAX(it.transaction_date) AS last_movement_date

FROM inventory_transaction it
JOIN item_master im ON it.item_id = im.id
LEFT JOIN inventory_lot il ON it.lot_id = il.id
JOIN warehouse w ON it.warehouse_id = w.id
WHERE it.status = 'COMPLETED'
GROUP BY it.item_id, it.warehouse_id, it.distributor_id, it.lot_id;


-- Stock by serial number
CREATE VIEW v_serial_stock AS
SELECT
    s.id AS serial_id,
    s.serial_number,
    s.item_id,
    im.name AS item_name,
    s.lot_id,
    il.lot_number,
    s.status,
    s.current_warehouse_id,
    w.name AS warehouse_name,
    s.current_owner_type,
    s.current_owner_id,
    s.warranty_end_date,
    DATEDIFF(s.warranty_end_date, CURDATE()) AS warranty_days_remaining,
    s.billing_id,
    s.customer_id,
    c.firstname AS customer_name
FROM inventory_serial s
JOIN item_master im ON s.item_id = im.id
LEFT JOIN inventory_lot il ON s.lot_id = il.id
LEFT JOIN warehouse w ON s.current_warehouse_id = w.id
LEFT JOIN customers c ON s.customer_id = c.id;
```

### 6. Stock Reservation System

```sql
-- Reservation table for order fulfillment
CREATE TABLE stock_reservation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- Reservation identification
    reservation_no VARCHAR(50) UNIQUE NOT NULL,

    -- What is reserved
    item_id BIGINT NOT NULL,
    lot_id BIGINT,
    serial_id BIGINT,
    warehouse_id BIGINT NOT NULL,

    -- Quantity
    reserved_quantity DECIMAL(16,4) NOT NULL,
    fulfilled_quantity DECIMAL(16,4) DEFAULT 0,

    -- For what
    reference_type ENUM('SALES_ORDER', 'BILLING', 'TRANSFER_ORDER', 'PRODUCTION_ORDER'),
    reference_id BIGINT NOT NULL,
    reference_line_id BIGINT,

    -- Status
    status ENUM('ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',

    -- Validity
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,  -- Auto-release after this time

    -- Owner
    distributor_id BIGINT,
    reserved_by BIGINT,

    -- Fulfillment tracking
    fulfilled_at TIMESTAMP,
    fulfilled_by BIGINT,

    -- Linked transaction
    reserve_transaction_id BIGINT,
    release_transaction_id BIGINT,

    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (lot_id) REFERENCES inventory_lot(id),
    FOREIGN KEY (serial_id) REFERENCES inventory_serial(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),

    INDEX idx_reference (reference_type, reference_id),
    INDEX idx_item_warehouse (item_id, warehouse_id),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at)
);
```

### 7. Inventory Adjustment

```sql
-- Stock adjustment requests
CREATE TABLE inventory_adjustment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    adjustment_no VARCHAR(50) UNIQUE NOT NULL,
    adjustment_date DATE NOT NULL,

    -- Type
    adjustment_type ENUM(
        'PHYSICAL_COUNT',      -- After stock take
        'DAMAGE',              -- Damaged goods
        'EXPIRY',              -- Expired goods
        'THEFT',               -- Stolen goods
        'CORRECTION',          -- Data correction
        'OPENING_BALANCE'      -- Initial stock
    ) NOT NULL,

    -- Location
    warehouse_id BIGINT NOT NULL,
    distributor_id BIGINT,

    -- Status
    status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED') DEFAULT 'DRAFT',

    -- Approval
    approved_by BIGINT,
    approved_at TIMESTAMP,
    rejection_reason VARCHAR(255),

    -- Totals
    total_items INT DEFAULT 0,
    total_increase_value DECIMAL(16,4) DEFAULT 0,
    total_decrease_value DECIMAL(16,4) DEFAULT 0,

    -- Notes
    reason TEXT,
    remarks TEXT,

    -- Audit
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id)
);

-- Adjustment line items
CREATE TABLE inventory_adjustment_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    adjustment_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    lot_id BIGINT,
    serial_id BIGINT,

    -- Quantities
    system_quantity DECIMAL(16,4),    -- What system shows
    physical_quantity DECIMAL(16,4),  -- What was counted
    adjustment_quantity DECIMAL(16,4), -- Difference

    -- Cost
    unit_cost DECIMAL(16,4),
    adjustment_value DECIMAL(16,4),

    -- Reason for this item
    reason VARCHAR(255),

    -- Transaction reference
    transaction_id BIGINT,

    FOREIGN KEY (adjustment_id) REFERENCES inventory_adjustment(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (lot_id) REFERENCES inventory_lot(id),
    FOREIGN KEY (serial_id) REFERENCES inventory_serial(id)
);
```

### 8. Stock Transfer

```sql
-- Inter-warehouse transfers
CREATE TABLE stock_transfer (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    transfer_no VARCHAR(50) UNIQUE NOT NULL,
    transfer_date DATE NOT NULL,

    -- From/To
    from_warehouse_id BIGINT NOT NULL,
    to_warehouse_id BIGINT NOT NULL,
    from_distributor_id BIGINT,
    to_distributor_id BIGINT,

    -- Status
    status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') DEFAULT 'DRAFT',

    -- Shipping
    shipped_at TIMESTAMP,
    shipped_by BIGINT,
    received_at TIMESTAMP,
    received_by BIGINT,

    -- Tracking
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),

    -- Totals
    total_items INT DEFAULT 0,
    total_quantity DECIMAL(16,4) DEFAULT 0,
    total_value DECIMAL(16,4) DEFAULT 0,

    -- Notes
    remarks TEXT,

    -- Audit
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_warehouse_id) REFERENCES warehouse(id),
    FOREIGN KEY (to_warehouse_id) REFERENCES warehouse(id)
);

-- Transfer line items
CREATE TABLE stock_transfer_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    transfer_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    lot_id BIGINT,
    serial_id BIGINT,

    -- Quantities
    transfer_quantity DECIMAL(16,4) NOT NULL,
    received_quantity DECIMAL(16,4),
    damaged_quantity DECIMAL(16,4) DEFAULT 0,

    -- Cost
    unit_cost DECIMAL(16,4),

    -- Status
    status ENUM('PENDING', 'SHIPPED', 'RECEIVED', 'PARTIAL', 'DAMAGED') DEFAULT 'PENDING',

    -- Transaction references
    out_transaction_id BIGINT,
    in_transaction_id BIGINT,

    FOREIGN KEY (transfer_id) REFERENCES stock_transfer(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item_master(id),
    FOREIGN KEY (lot_id) REFERENCES inventory_lot(id),
    FOREIGN KEY (serial_id) REFERENCES inventory_serial(id)
);
```

---

## 🔄 Complete Transaction Flow Diagrams

### GRN Receipt Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GRN RECEIPT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. GRN Created                                                              │
│     │                                                                        │
│     ▼                                                                        │
│  2. For each item with batch tracking:                                       │
│     │                                                                        │
│     ├──► CREATE inventory_lot record                                         │
│     │    {                                                                   │
│     │      lot_number: "BATCH001",                                          │
│     │      item_id: 10,                                                     │
│     │      expiry_date: "2025-12-31",                                       │
│     │      grn_id: 1,                                                       │
│     │      unit_cost: 100.00                                                │
│     │    }                                                                   │
│     │                                                                        │
│     └──► CREATE inventory_transaction record                                 │
│          {                                                                   │
│            transaction_type: "GRN_RECEIPT",                                 │
│            movement_type: "IN",                                             │
│            item_id: 10,                                                     │
│            lot_id: <new_lot_id>,                                            │
│            quantity: 100,                                                   │
│            warehouse_id: 1,                                                 │
│            reference_type: "GRN",                                           │
│            reference_id: 1                                                  │
│          }                                                                   │
│                                                                              │
│  3. For each item with serial tracking:                                      │
│     │                                                                        │
│     ├──► CREATE inventory_serial record (for each serial)                    │
│     │    {                                                                   │
│     │      serial_number: "SN001",                                          │
│     │      item_id: 20,                                                     │
│     │      lot_id: <optional>,                                              │
│     │      status: "AVAILABLE",                                             │
│     │      current_warehouse_id: 1                                          │
│     │    }                                                                   │
│     │                                                                        │
│     └──► CREATE inventory_transaction record                                 │
│          {                                                                   │
│            transaction_type: "GRN_RECEIPT",                                 │
│            movement_type: "IN",                                             │
│            item_id: 20,                                                     │
│            serial_id: <new_serial_id>,                                      │
│            quantity: 1,                                                     │
│            warehouse_id: 1,                                                 │
│            reference_type: "GRN",                                           │
│            reference_id: 1                                                  │
│          }                                                                   │
│                                                                              │
│  RESULT: Stock automatically calculated from transactions                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Billing (Sales) Flow with FIFO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BILLING FLOW WITH FIFO/FEFO                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Billing Created                                                          │
│     │                                                                        │
│     ▼                                                                        │
│  2. For batch-tracked items (FEFO - First Expiry First Out):                 │
│     │                                                                        │
│     ├──► QUERY: Get available lots ordered by expiry_date ASC               │
│     │    SELECT * FROM v_stock_balance                                       │
│     │    WHERE item_id = ? AND available_quantity > 0                        │
│     │    ORDER BY expiry_date ASC                                            │
│     │                                                                        │
│     ├──► AUTO-SELECT lots to fulfill quantity                                │
│     │    Example: Need 150 units                                             │
│     │    - Lot BATCH001 (exp: 2025-06): 100 units → Use 100                  │
│     │    - Lot BATCH002 (exp: 2025-08): 200 units → Use 50                   │
│     │                                                                        │
│     └──► CREATE inventory_transaction for each lot                           │
│          {                                                                   │
│            transaction_type: "SALES_ISSUE",                                 │
│            movement_type: "OUT",                                            │
│            item_id: 10,                                                     │
│            lot_id: <lot_id>,                                                │
│            quantity: 100,                                                   │
│            reference_type: "BILLING",                                       │
│            reference_id: <billing_id>                                       │
│          }                                                                   │
│                                                                              │
│  3. For serial-tracked items:                                                │
│     │                                                                        │
│     ├──► UPDATE inventory_serial                                             │
│     │    SET status = 'SOLD',                                               │
│     │        billing_id = <billing_id>,                                     │
│     │        customer_id = <customer_id>,                                   │
│     │        sold_date = NOW()                                              │
│     │                                                                        │
│     └──► CREATE inventory_transaction                                        │
│          {                                                                   │
│            transaction_type: "SALES_ISSUE",                                 │
│            movement_type: "OUT",                                            │
│            serial_id: <serial_id>,                                          │
│            quantity: 1,                                                     │
│            reference_type: "BILLING",                                       │
│            reference_id: <billing_id>                                       │
│          }                                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sales Return Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SALES RETURN FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Return Request Created                                                   │
│     │                                                                        │
│     ▼                                                                        │
│  2. Validate original sale:                                                  │
│     │                                                                        │
│     ├──► QUERY: Find original billing_batch_details                          │
│     │    - Verify batch/serial was sold to this customer                     │
│     │    - Check return window (e.g., 30 days)                               │
│     │                                                                        │
│     ▼                                                                        │
│  3. On Return Approval:                                                      │
│     │                                                                        │
│     ├──► For batch items:                                                    │
│     │    CREATE inventory_transaction                                        │
│     │    {                                                                   │
│     │      transaction_type: "SALES_RETURN",                                │
│     │      movement_type: "IN",                                             │
│     │      lot_id: <original_lot_id>,                                       │
│     │      quantity: <return_qty>,                                          │
│     │      reference_type: "SALES_RETURN",                                  │
│     │      reference_id: <return_id>                                        │
│     │    }                                                                   │
│     │                                                                        │
│     └──► For serial items:                                                   │
│          UPDATE inventory_serial                                             │
│          SET status = 'RETURNED',                                           │
│              current_warehouse_id = <return_warehouse>                       │
│                                                                              │
│          CREATE inventory_transaction                                        │
│          {                                                                   │
│            transaction_type: "SALES_RETURN",                                │
│            movement_type: "IN",                                             │
│            serial_id: <serial_id>,                                          │
│            quantity: 1                                                      │
│          }                                                                   │
│                                                                              │
│  4. Quality Check (Optional):                                                │
│     │                                                                        │
│     ├──► If APPROVED: Update serial status to 'AVAILABLE'                    │
│     └──► If DAMAGED: Update serial status to 'DAMAGED'                       │
│          CREATE adjustment transaction for write-off                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Complete Traceability Queries

### 1. Product Journey (Forward Trace)

```sql
-- Trace a batch from receipt to all sales
SELECT
    'RECEIVED' AS stage,
    it.transaction_date,
    it.transaction_no,
    it.quantity,
    w.name AS location,
    NULL AS customer_name,
    grn.grn_no AS document_no
FROM inventory_transaction it
JOIN warehouse w ON it.warehouse_id = w.id
LEFT JOIN grn_master grn ON it.reference_type = 'GRN' AND it.reference_id = grn.id
WHERE it.lot_id = ? AND it.transaction_type = 'GRN_RECEIPT'

UNION ALL

SELECT
    'SOLD' AS stage,
    it.transaction_date,
    it.transaction_no,
    it.quantity,
    w.name AS location,
    CONCAT(c.firstname, ' ', c.lastname) AS customer_name,
    b.bill_no AS document_no
FROM inventory_transaction it
JOIN warehouse w ON it.warehouse_id = w.id
JOIN billings b ON it.reference_type = 'BILLING' AND it.reference_id = b.id
JOIN customers c ON b.customer_id = c.id
WHERE it.lot_id = ? AND it.transaction_type = 'SALES_ISSUE'

ORDER BY transaction_date;
```

### 2. Customer Trace (Reverse Trace)

```sql
-- Find all customers who received items from a specific batch
SELECT DISTINCT
    c.id AS customer_id,
    CONCAT(c.firstname, ' ', c.lastname) AS customer_name,
    c.mobileNo,
    c.emailId,
    c.city,
    b.bill_no,
    b.billDate,
    it.quantity AS quantity_sold,
    il.lot_number AS batch_number,
    il.expiry_date
FROM inventory_transaction it
JOIN billings b ON it.reference_type = 'BILLING' AND it.reference_id = b.id
JOIN customers c ON b.customer_id = c.id
JOIN inventory_lot il ON it.lot_id = il.id
WHERE il.lot_number = ?
  AND it.transaction_type = 'SALES_ISSUE'
ORDER BY b.billDate DESC;
```

### 3. Serial Number Complete History

```sql
-- Complete lifecycle of a serial number
SELECT
    it.transaction_date,
    it.transaction_type,
    it.movement_type,
    it.quantity,
    w.name AS warehouse,
    it.reference_type,
    it.reference_no,
    CASE
        WHEN it.reference_type = 'BILLING' THEN
            (SELECT CONCAT(c.firstname, ' ', c.lastname)
             FROM billings b
             JOIN customers c ON b.customer_id = c.id
             WHERE b.id = it.reference_id)
        ELSE NULL
    END AS customer_name,
    u.firstName AS performed_by
FROM inventory_transaction it
JOIN warehouse w ON it.warehouse_id = w.id
JOIN user_master u ON it.created_by = u.id
WHERE it.serial_id = (
    SELECT id FROM inventory_serial WHERE serial_number = ?
)
ORDER BY it.transaction_date;
```

---

## 🏗️ Backend Service Architecture

### Inventory Service (Core)

```typescript
// inventory-core.service.ts
@Injectable()
export class InventoryCoreService {
  // ═══════════════════════════════════════════════════════════════
  // TRANSACTION METHODS (Single Source of Truth)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create inventory transaction - ALL stock movements go through this
   */
  async createTransaction(
    dto: CreateInventoryTransactionDto,
  ): Promise<InventoryTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // 1. Validate stock availability for OUT movements
      if (dto.movementType === 'OUT') {
        await this.validateStockAvailability(dto, queryRunner);
      }

      // 2. Create transaction record
      const transaction = await this.createTransactionRecord(dto, queryRunner);

      // 3. Update lot/serial status if applicable
      if (dto.lotId) {
        await this.updateLotStatus(dto.lotId, queryRunner);
      }
      if (dto.serialId) {
        await this.updateSerialStatus(dto.serialId, dto, queryRunner);
      }

      // 4. Update running balance
      await this.updateRunningBalance(transaction, queryRunner);

      await queryRunner.commitTransaction();
      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STOCK QUERY METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get real-time stock balance (calculated from transactions)
   */
  async getStockBalance(params: StockBalanceParams): Promise<StockBalance[]> {
    return this.dataSource.query(
      `
      SELECT 
        item_id, warehouse_id, lot_id,
        SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) -
        SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) AS on_hand,
        SUM(CASE WHEN movement_type = 'RESERVE' THEN quantity ELSE 0 END) -
        SUM(CASE WHEN movement_type = 'RELEASE' THEN quantity ELSE 0 END) AS reserved,
        (on_hand - reserved) AS available
      FROM inventory_transaction
      WHERE item_id = ? AND warehouse_id = ? AND status = 'COMPLETED'
      GROUP BY item_id, warehouse_id, lot_id
    `,
      [params.itemId, params.warehouseId],
    );
  }

  /**
   * Get available lots for FIFO/FEFO picking
   */
  async getAvailableLots(
    itemId: number,
    warehouseId: number,
    strategy: 'FIFO' | 'FEFO',
  ): Promise<AvailableLot[]> {
    const orderBy =
      strategy === 'FEFO' ? 'il.expiry_date ASC' : 'il.received_date ASC';

    return this.dataSource.query(
      `
      SELECT 
        il.id AS lot_id,
        il.lot_number,
        il.expiry_date,
        il.unit_cost,
        sb.available_quantity
      FROM inventory_lot il
      JOIN v_stock_balance sb ON il.id = sb.lot_id
      WHERE il.item_id = ? 
        AND sb.warehouse_id = ?
        AND sb.available_quantity > 0
        AND il.status = 'ACTIVE'
        AND (il.expiry_date IS NULL OR il.expiry_date > CURDATE())
      ORDER BY ${orderBy}
    `,
      [itemId, warehouseId],
    );
  }

  /**
   * Auto-allocate stock using FIFO/FEFO
   */
  async allocateStock(
    itemId: number,
    warehouseId: number,
    requiredQty: number,
    strategy: 'FIFO' | 'FEFO' = 'FEFO',
  ): Promise<StockAllocation[]> {
    const availableLots = await this.getAvailableLots(
      itemId,
      warehouseId,
      strategy,
    );

    const allocations: StockAllocation[] = [];
    let remainingQty = requiredQty;

    for (const lot of availableLots) {
      if (remainingQty <= 0) break;

      const allocateQty = Math.min(remainingQty, lot.available_quantity);
      allocations.push({
        lotId: lot.lot_id,
        lotNumber: lot.lot_number,
        quantity: allocateQty,
        expiryDate: lot.expiry_date,
        unitCost: lot.unit_cost,
      });

      remainingQty -= allocateQty;
    }

    if (remainingQty > 0) {
      throw new BadRequestException(
        `Insufficient stock. Required: ${requiredQty}, Available: ${requiredQty - remainingQty}`,
      );
    }

    return allocations;
  }

  // ═══════════════════════════════════════════════════════════════
  // LOT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async createLot(dto: CreateLotDto): Promise<InventoryLot> {
    // Check for duplicate lot number for same item
    const existing = await this.lotRepo.findOne({
      where: { lotNumber: dto.lotNumber, itemId: dto.itemId },
    });

    if (existing) {
      throw new BadRequestException(
        `Lot ${dto.lotNumber} already exists for this item`,
      );
    }

    return this.lotRepo.save(dto);
  }

  async getLotDetails(lotId: number): Promise<LotDetails> {
    const lot = await this.lotRepo.findOne({
      where: { id: lotId },
      relations: ['item'],
    });

    const stockBalance = await this.getStockBalance({ lotId });
    const transactions = await this.getTransactionHistory({ lotId });

    return {
      ...lot,
      stockBalance,
      transactions,
      daysToExpiry: this.calculateDaysToExpiry(lot.expiryDate),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SERIAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async createSerial(dto: CreateSerialDto): Promise<InventorySerial> {
    // Check for duplicate serial number for same item
    const existing = await this.serialRepo.findOne({
      where: { serialNumber: dto.serialNumber, itemId: dto.itemId },
    });

    if (existing) {
      throw new BadRequestException(
        `Serial ${dto.serialNumber} already exists for this item`,
      );
    }

    return this.serialRepo.save({
      ...dto,
      status: 'AVAILABLE',
    });
  }

  async getSerialDetails(serialNumber: string): Promise<SerialDetails> {
    const serial = await this.serialRepo.findOne({
      where: { serialNumber },
      relations: ['item', 'lot', 'currentWarehouse', 'customer'],
    });

    const transactions = await this.getTransactionHistory({
      serialId: serial.id,
    });

    return {
      ...serial,
      transactions,
      warrantyStatus: this.getWarrantyStatus(serial),
    };
  }

  async updateSerialStatus(
    serialId: number,
    status: SerialStatus,
    additionalData?: Partial<InventorySerial>,
  ): Promise<void> {
    await this.serialRepo.update(serialId, {
      status,
      ...additionalData,
    });
  }
}
```

### GRN Service (Using Core)

```typescript
// grn.service.ts - Updated to use InventoryCoreService
@Injectable()
export class GrnService {
  constructor(
    private inventoryCore: InventoryCoreService,
    // ... other dependencies
  ) {}

  async approveGrn(grnId: number, userId: number): Promise<GrnEntity> {
    const grn = await this.getGrnWithItems(grnId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      for (const item of grn.items) {
        const itemMaster = item.item;

        // Handle batch tracking
        if (itemMaster.hasBatchTracking && item.batchDetails?.length > 0) {
          for (const batch of item.batchDetails) {
            // 1. Create lot record
            const lot = await this.inventoryCore.createLot({
              lotNumber: batch.batchNumber,
              itemId: item.itemId,
              expiryDate: batch.expiryDate,
              grnId: grn.id,
              purchaseOrderId: grn.purchaseOrderId,
              unitCost: item.unitPrice,
              receivedDate: new Date(),
            });

            // 2. Create inventory transaction
            await this.inventoryCore.createTransaction({
              transactionType: 'GRN_RECEIPT',
              movementType: 'IN',
              itemId: item.itemId,
              lotId: lot.id,
              quantity: batch.quantity,
              warehouseId: grn.warehouseId,
              referenceType: 'GRN',
              referenceId: grn.id,
              referenceLineId: item.id,
              unitCost: item.unitPrice,
              distributorId: grn.distributorId,
              createdBy: userId,
            });
          }
        }

        // Handle serial tracking
        if (itemMaster.hasSerialTracking && item.serialDetails?.length > 0) {
          for (const serial of item.serialDetails) {
            // 1. Create serial record
            const serialRecord = await this.inventoryCore.createSerial({
              serialNumber: serial.serialNumber,
              itemId: item.itemId,
              lotId: serial.lotId, // Optional link to batch
              grnId: grn.id,
              purchaseOrderId: grn.purchaseOrderId,
              currentWarehouseId: grn.warehouseId,
              currentOwnerType: 'DISTRIBUTOR',
              currentOwnerId: grn.distributorId,
              unitCost: item.unitPrice,
              receivedDate: new Date(),
            });

            // 2. Create inventory transaction
            await this.inventoryCore.createTransaction({
              transactionType: 'GRN_RECEIPT',
              movementType: 'IN',
              itemId: item.itemId,
              serialId: serialRecord.id,
              quantity: 1,
              warehouseId: grn.warehouseId,
              referenceType: 'GRN',
              referenceId: grn.id,
              referenceLineId: item.id,
              unitCost: item.unitPrice,
              distributorId: grn.distributorId,
              createdBy: userId,
            });
          }
        }

        // Handle non-tracked items
        if (!itemMaster.hasBatchTracking && !itemMaster.hasSerialTracking) {
          await this.inventoryCore.createTransaction({
            transactionType: 'GRN_RECEIPT',
            movementType: 'IN',
            itemId: item.itemId,
            quantity: item.receivedQuantity,
            warehouseId: grn.warehouseId,
            referenceType: 'GRN',
            referenceId: grn.id,
            referenceLineId: item.id,
            unitCost: item.unitPrice,
            distributorId: grn.distributorId,
            createdBy: userId,
          });
        }
      }

      // Update GRN status
      grn.status = 'APPROVED';
      grn.approvedBy = userId;
      grn.approvedAt = new Date();
      await queryRunner.manager.save(grn);

      await queryRunner.commitTransaction();
      return grn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
```

### Billing Service (Using Core with FIFO/FEFO)

```typescript
// billing.service.ts - Updated to use InventoryCoreService
@Injectable()
export class BillingService {
  constructor(
    private inventoryCore: InventoryCoreService,
    // ... other dependencies
  ) {}

  async createBilling(
    dto: CreateBillingDto,
    userId: number,
  ): Promise<BillingEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // Create billing header
      const billing = await this.createBillingHeader(dto, userId, queryRunner);

      for (const item of dto.items) {
        const itemMaster = await this.getItemMaster(item.itemId);

        // ═══════════════════════════════════════════════════════════
        // BATCH TRACKED ITEMS - Auto FIFO/FEFO allocation
        // ═══════════════════════════════════════════════════════════
        if (itemMaster.hasBatchTracking) {
          let allocations: StockAllocation[];

          if (item.lotId) {
            // User specified a lot - use it
            allocations = [
              {
                lotId: item.lotId,
                lotNumber: item.batchNumber,
                quantity: item.quantity,
              },
            ];
          } else {
            // Auto-allocate using FEFO (First Expiry First Out)
            allocations = await this.inventoryCore.allocateStock(
              item.itemId,
              dto.warehouseId,
              item.quantity,
              'FEFO', // Use FEFO for expiry-sensitive items
            );
          }

          // Create transactions for each allocated lot
          for (const allocation of allocations) {
            await this.inventoryCore.createTransaction({
              transactionType: 'SALES_ISSUE',
              movementType: 'OUT',
              itemId: item.itemId,
              lotId: allocation.lotId,
              quantity: allocation.quantity,
              warehouseId: dto.warehouseId,
              referenceType: 'BILLING',
              referenceId: billing.id,
              referenceLineId: item.id,
              unitCost: allocation.unitCost,
              distributorId: dto.distributorId,
              createdBy: userId,
            });

            // Create billing batch detail for traceability
            await this.createBillingBatchDetail(
              {
                billingId: billing.id,
                itemId: item.itemId,
                lotId: allocation.lotId,
                batchNumber: allocation.lotNumber,
                quantity: allocation.quantity,
                expiryDate: allocation.expiryDate,
                rate: item.rate,
              },
              queryRunner,
            );
          }
        }

        // ═══════════════════════════════════════════════════════════
        // SERIAL TRACKED ITEMS
        // ═══════════════════════════════════════════════════════════
        else if (itemMaster.hasSerialTracking) {
          // Validate serial exists and is available
          const serial = await this.inventoryCore.getSerialByNumber(
            item.serialNumber,
          );

          if (!serial || serial.status !== 'AVAILABLE') {
            throw new BadRequestException(
              `Serial ${item.serialNumber} is not available`,
            );
          }

          // Update serial status
          await this.inventoryCore.updateSerialStatus(serial.id, 'SOLD', {
            billingId: billing.id,
            customerId: dto.customerId,
            soldDate: new Date(),
            sellingPrice: item.rate,
          });

          // Create transaction
          await this.inventoryCore.createTransaction({
            transactionType: 'SALES_ISSUE',
            movementType: 'OUT',
            itemId: item.itemId,
            serialId: serial.id,
            lotId: serial.lotId,
            quantity: 1,
            warehouseId: dto.warehouseId,
            referenceType: 'BILLING',
            referenceId: billing.id,
            referenceLineId: item.id,
            unitCost: serial.unitCost,
            distributorId: dto.distributorId,
            createdBy: userId,
          });
        }

        // ═══════════════════════════════════════════════════════════
        // NON-TRACKED ITEMS
        // ═══════════════════════════════════════════════════════════
        else {
          // Validate stock availability
          const stock = await this.inventoryCore.getStockBalance({
            itemId: item.itemId,
            warehouseId: dto.warehouseId,
            distributorId: dto.distributorId,
          });

          if (stock.available < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${itemMaster.name}. Available: ${stock.available}`,
            );
          }

          await this.inventoryCore.createTransaction({
            transactionType: 'SALES_ISSUE',
            movementType: 'OUT',
            itemId: item.itemId,
            quantity: item.quantity,
            warehouseId: dto.warehouseId,
            referenceType: 'BILLING',
            referenceId: billing.id,
            referenceLineId: item.id,
            distributorId: dto.distributorId,
            createdBy: userId,
          });
        }
      }

      await queryRunner.commitTransaction();
      return billing;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
```

---

## 📊 Complete Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENTERPRISE INVENTORY MANAGEMENT ERD                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  ┌─────────────────┐                                                                                │
│  │   item_master   │                                                                                │
│  ├─────────────────┤                                                                                │
│  │ id              │◄─────────────────────────────────────────────────────────────────┐             │
│  │ name            │                                                                   │             │
│  │ hasBatchTracking│                                                                   │             │
│  │ hasSerialTracking                                                                   │             │
│  │ hasExpiryDate   │                                                                   │             │
│  └────────┬────────┘                                                                   │             │
│           │                                                                            │             │
│           │ 1:N                                                                        │             │
│           ▼                                                                            │             │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐          │             │
│  │  inventory_lot  │         │inventory_serial │         │    warehouse    │          │             │
│  ├─────────────────┤         ├─────────────────┤         ├─────────────────┤          │             │
│  │ id              │◄────────│ lot_id (FK)     │         │ id              │◄─────────┤             │
│  │ lot_number      │         │ id              │         │ code            │          │             │
│  │ item_id (FK)    │         │ serial_number   │         │ name            │          │             │
│  │ expiry_date     │         │ item_id (FK)    │         │ type            │          │             │
│  │ manufacture_date│         │ status          │         │ distributor_id  │          │             │
│  │ grn_id (FK)     │         │ warehouse_id(FK)│─────────│                 │          │             │
│  │ unit_cost       │         │ billing_id (FK) │         └─────────────────┘          │             │
│  │ quality_status  │         │ customer_id(FK) │                                      │             │
│  │ status          │         │ warranty_end    │                                      │             │
│  └────────┬────────┘         └────────┬────────┘                                      │             │
│           │                           │                                               │             │
│           │                           │                                               │             │
│           └───────────────┬───────────┘                                               │             │
│                           │                                                           │             │
│                           ▼                                                           │             │
│           ┌───────────────────────────────────────┐                                   │             │
│           │      inventory_transaction            │ ◄── SINGLE SOURCE OF TRUTH        │             │
│           │      (ALL STOCK MOVEMENTS)            │                                   │             │
│           ├───────────────────────────────────────┤                                   │             │
│           │ id                                    │                                   │             │
│           │ transaction_no                        │                                   │             │
│           │ transaction_type                      │                                   │             │
│           │   - GRN_RECEIPT                       │                                   │             │
│           │   - SALES_ISSUE                       │                                   │             │
│           │   - SALES_RETURN                      │                                   │             │
│           │   - PURCHASE_RETURN                   │                                   │             │
│           │   - TRANSFER_IN/OUT                   │                                   │             │
│           │   - ADJUSTMENT_IN/OUT                 │                                   │             │
│           │   - RESERVATION/RELEASE               │                                   │             │
│           │ movement_type (IN/OUT/RESERVE/RELEASE)│                                   │             │
│           │ item_id (FK) ─────────────────────────┼───────────────────────────────────┘             │
│           │ lot_id (FK)                           │                                                 │
│           │ serial_id (FK)                        │                                                 │
│           │ quantity                              │                                                 │
│           │ warehouse_id (FK)                     │                                                 │
│           │ reference_type                        │                                                 │
│           │ reference_id                          │                                                 │
│           │ unit_cost                             │                                                 │
│           │ distributor_id (FK)                   │                                                 │
│           │ created_by, created_at                │                                                 │
│           └───────────────────────────────────────┘                                                 │
│                           │                                                                         │
│           ┌───────────────┼───────────────┬───────────────┬───────────────┐                        │
│           │               │               │               │               │                        │
│           ▼               ▼               ▼               ▼               ▼                        │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                      │
│     │   GRN    │   │ BILLING  │   │ RETURNS  │   │ TRANSFER │   │ ADJUST   │                      │
│     └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘                      │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)

```
□ Create new database tables:
  ├── warehouse
  ├── storage_location
  ├── inventory_lot (replaces batch_details)
  ├── inventory_serial (replaces serial_details)
  └── inventory_transaction (NEW - core table)

□ Create InventoryCoreService with:
  ├── createTransaction()
  ├── getStockBalance()
  ├── getAvailableLots()
  ├── allocateStock()
  ├── createLot()
  └── createSerial()

□ Create database views:
  ├── v_stock_balance
  └── v_serial_stock
```

### Phase 2: Module Integration (Week 3-4)

```
□ Update GRN Service:
  ├── Use InventoryCoreService for stock receipt
  ├── Create lot records on GRN approval
  ├── Create serial records on GRN approval
  └── Create inventory_transaction records

□ Update Billing Service:
  ├── Use InventoryCoreService for stock issue
  ├── Implement FIFO/FEFO auto-allocation
  ├── Update serial status on sale
  └── Create inventory_transaction records

□ Update Returns Service:
  ├── Use InventoryCoreService for return receipt
  ├── Update lot/serial status on return
  └── Create inventory_transaction records
```

### Phase 3: Advanced Features (Week 5-6)

```
□ Stock Reservation System:
  ├── Create stock_reservation table
  ├── Reserve stock on order creation
  ├── Release reservation on cancellation
  └── Auto-expire old reservations

□ Stock Transfer:
  ├── Create stock_transfer tables
  ├── Transfer between warehouses
  ├── Track in-transit inventory
  └── Receive with variance handling

□ Stock Adjustment:
  ├── Create inventory_adjustment tables
  ├── Physical count reconciliation
  ├── Damage/expiry write-off
  └── Approval workflow
```

### Phase 4: Reporting & Analytics (Week 7-8)

```
□ Traceability Reports:
  ├── Forward trace (batch → customers)
  ├── Reverse trace (customer → batch)
  ├── Serial number lifecycle
  └── Expiry tracking

□ Stock Reports:
  ├── Stock valuation (FIFO cost)
  ├── Stock aging analysis
  ├── Movement history
  └── Low stock alerts

□ Audit Reports:
  ├── Transaction audit trail
  ├── User activity log
  └── Variance reports
```

---

## 📋 Migration Strategy

### Step 1: Create New Tables (Non-Breaking)

```sql
-- Run these migrations without affecting existing functionality
CREATE TABLE warehouse (...);
CREATE TABLE storage_location (...);
CREATE TABLE inventory_lot (...);
CREATE TABLE inventory_serial (...);
CREATE TABLE inventory_transaction (...);
```

### Step 2: Migrate Existing Data

```sql
-- Migrate batch_details to inventory_lot
INSERT INTO inventory_lot (lot_number, item_id, expiry_date, ...)
SELECT DISTINCT
    bd.batchNumber,
    di.itemId,
    bd.expiryDate,
    ...
FROM batch_details bd
JOIN distributor_inventory di ON bd.inventoryId = di.id;

-- Create opening balance transactions
INSERT INTO inventory_transaction (
    transaction_type, movement_type, item_id, lot_id, quantity, ...
)
SELECT
    'OPENING_STOCK',
    'IN',
    il.item_id,
    il.id,
    bd.quantity,
    ...
FROM inventory_lot il
JOIN batch_details bd ON bd.batchNumber = il.lot_number;
```

### Step 3: Update Services (Gradual)

```typescript
// Use feature flag to gradually switch to new system
if (this.configService.get('USE_NEW_INVENTORY_SYSTEM')) {
  await this.inventoryCore.createTransaction(...);
} else {
  // Old logic
  await this.oldInventoryService.updateStock(...);
}
```

### Step 4: Deprecate Old Tables

```sql
-- After full migration and testing
-- Keep old tables for reference, mark as deprecated
RENAME TABLE batch_details TO _deprecated_batch_details;
RENAME TABLE serial_details TO _deprecated_serial_details;
```

---

## ✅ Benefits of New Architecture

| Feature               | Current                           | Proposed                                       |
| --------------------- | --------------------------------- | ---------------------------------------------- |
| **Stock Calculation** | Stored value (can go out of sync) | Calculated from transactions (always accurate) |
| **Audit Trail**       | Partial                           | Complete - every movement logged               |
| **FIFO/FEFO**         | Manual                            | Automatic                                      |
| **Traceability**      | Limited                           | Full forward & reverse trace                   |
| **Multi-location**    | Single warehouse                  | Multiple warehouses + bins                     |
| **Reservations**      | None                              | Built-in reservation system                    |
| **Cost Tracking**     | Basic                             | FIFO costing with landed cost                  |
| **Returns**           | Manual adjustment                 | Automatic stock restoration                    |
| **Expiry Management** | Basic alerts                      | Automatic blocking + FEFO                      |
| **Scalability**       | Limited                           | Enterprise-grade                               |

---

## 🎯 Summary

This enterprise architecture provides:

1. **Single Source of Truth** - All stock movements in one transaction table
2. **Complete Traceability** - Track every unit from receipt to sale
3. **Automatic FIFO/FEFO** - Intelligent stock allocation
4. **Real-time Accuracy** - Stock calculated from transactions
5. **Full Audit Trail** - Who did what, when, and why
6. **Multi-location Support** - Warehouses, zones, bins
7. **Reservation System** - Reserve stock for orders
8. **Cost Tracking** - FIFO costing with landed costs
9. **Scalability** - Handles millions of transactions

This is the same architecture used by:

- SAP Business One
- Oracle NetSuite
- Zoho Inventory
- QuickBooks Enterprise
- Odoo ERP

**Ready to implement? Start with Phase 1!**
