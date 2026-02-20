USE COP4710;

CREATE TABLE `payment_info` (
  `piid` INT AUTO_INCREMENT PRIMARY KEY,
  `cc_number` VARCHAR(20) NOT NULL,
  `cc_exp_month` INT NOT NULL,
  `cc_exp_year` YEAR NOT NULL,
  `cc_cvv` VARCHAR(4) NOT NULL
);

CREATE TABLE `users` (
  `uid` INT AUTO_INCREMENT PRIMARY KEY,
  `role` ENUM('restaurant', 'customer', 'donor', 'needy', 'admin') NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30),
  `username` VARCHAR(255) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `password_salt` VARCHAR(255) NOT NULL,
  `piid` INT,
  FOREIGN KEY (`piid`) REFERENCES `payment_info`(`piid`),
  CHECK (
    role = 'needy' OR phone IS NOT NULL
  ),
  CHECK (
    (role IN ('customer', 'donor') AND piid IS NOT NULL)
    OR (role NOT IN ('customer', 'donor') AND piid IS NULL)
  )
);

CREATE TABLE `plates` (
  `pid` INT AUTO_INCREMENT PRIMARY KEY,
  `rid` INT NOT NULL,
  `price` DECIMAL(8,2) NOT NULL,
  `quantity` INT NOT NULL,
  `etime` DATETIME NOT NULL,
  `description` TEXT NOT NULL,
  FOREIGN KEY (`rid`) REFERENCES `users`(`uid`)
);

CREATE TABLE `orders` (
  `oid` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `for_needy` BOOLEAN NOT NULL DEFAULT FALSE,
  `needy_id` INT,
  `plate_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `order_type` ENUM('purchase', 'donation') NOT NULL,
  `order_status` ENUM('unclaimed', 'reserved', 'picked_up', 'cancelled', 'claimed'),
  `order_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`),
  FOREIGN KEY (`plate_id`) REFERENCES `plates`(`pid`)
);

INSERT INTO users (role, name, address, phone, username, password_hash, password_salt)
VALUES (
  'admin',
  'Admin User',
  '123 Admin St',
  '555-0000',
  'admin',
  '6f744681bdc64075c0e78812a5b1e1de7875e5109be40f1b52a9c1fb86383f55',
  'be79229c868eb61db9d1e7caa2782a12'
);

- ===========================
-- PAYMENT INFO (for customer + donor)
-- ===========================
INSERT INTO payment_info (cc_number, cc_exp_month, cc_exp_year, cc_cvv)
VALUES
('4111111111111111', 12, 2028, '123'),
('5500000000000004', 11, 2027, '456');

-- ===========================
-- USERS: RESTAURANTS
-- ===========================
INSERT INTO users (role, name, address, phone, username, password_hash, password_salt)
VALUES
('restaurant', 'Pasta Palace', '100 Noodle Rd', '555-1111', 'pasta', 'h', 's'),
('restaurant', 'Tasty Tacos', '200 Taco Ave', '555-2222', 'tacos', 'h', 's'),
('restaurant', 'Burger Barn', '300 Burger Blvd', '555-3333', 'burger', 'h', 's');

-- ===========================
-- USERS: CUSTOMER, DONOR, NEEDY
-- ===========================
INSERT INTO users (role, name, address, phone, username, password_hash, password_salt, piid)
VALUES
('customer', 'John Customer', '400 Main St', '555-4444', 'customer1', 'h', 's', 1),
('donor', 'Daisy Donor', '500 Help St', '555-5555', 'donor1', 'h', 's', 2),
('needy', 'Nancy Needy', '600 Support Ln', NULL, 'needy1', 'h', 's', NULL);

-- NOTE: users:
-- 1 admin
-- 2-4 restaurants
-- 5 customer (piid=1)
-- 6 donor (piid=2)
-- 7 needy


