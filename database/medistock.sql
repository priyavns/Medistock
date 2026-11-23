-- Run this script in the TiDB Cloud SQL Editor after the cluster is available.
CREATE DATABASE IF NOT EXISTS medistock;
USE medistock;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_salt VARCHAR(100) NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    medicine_code VARCHAR(50) NOT NULL UNIQUE,
    quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Demo inventory matching the three medicines shown in the original dashboard.
INSERT IGNORE INTO medicines (name, medicine_code, quantity, unit_price, expiry_date) VALUES
('Paracetamol 500mg', 'MED-1001', 120, 4.50, '2027-06-30'),
('Amoxicillin 250mg', 'MED-1002', 18, 8.25, '2026-12-15'),
('Cetirizine 10mg', 'MED-1003', 64, 6.00, '2027-03-20');
