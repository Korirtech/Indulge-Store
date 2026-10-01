CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actor_user_id` int NOT NULL,
  `action` varchar(80) NOT NULL,
  `target_type` varchar(40) NOT NULL,
  `target_id` varchar(255) NOT NULL,
  `status` enum('started','succeeded','failed') NOT NULL DEFAULT 'started',
  `metadata_json` text,
  `before_json` text,
  `after_json` text,
  `error_code` varchar(40),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `completed_at` timestamp,
  CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`),
  INDEX `admin_audit_logs_created_idx` (`created_at`,`id`),
  INDEX `admin_audit_logs_actor_idx` (`actor_user_id`,`created_at`),
  INDEX `admin_audit_logs_target_idx` (`target_type`,`target_id`)
);
