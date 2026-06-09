-- +migrate Up

CREATE TABLE IF NOT EXISTS `clowder_skill_source` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `skill_id` varchar(128) NOT NULL,
  `name` varchar(128) NOT NULL,
  `display_name` varchar(128) NOT NULL DEFAULT '',
  `description` text,
  `category` varchar(128) NOT NULL DEFAULT '',
  `triggers_json` text,
  `requires_mcp_json` text,
  `source_type` varchar(32) NOT NULL,
  `source_owner_uid` varchar(40) NOT NULL DEFAULT '',
  `provider` varchar(32) NOT NULL DEFAULT '',
  `source_path` varchar(1024) NOT NULL DEFAULT '',
  `content_hash` varchar(128) NOT NULL DEFAULT '',
  `version` varchar(64) NOT NULL DEFAULT '',
  `mount_status_json` text,
  `conflict_status` varchar(32) NOT NULL DEFAULT 'none',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clowder_skill_source` (`skill_id`, `source_type`, `source_owner_uid`, `content_hash`),
  KEY `idx_clowder_skill_source_status` (`status`),
  KEY `idx_clowder_skill_source_owner` (`source_owner_uid`)
);

CREATE TABLE IF NOT EXISTS `clowder_user_skill` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid` varchar(40) NOT NULL,
  `skill_source_id` bigint unsigned NOT NULL,
  `alias` varchar(128) NOT NULL DEFAULT '',
  `display_name` varchar(128) NOT NULL DEFAULT '',
  `description_override` text,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `visibility` varchar(32) NOT NULL DEFAULT 'private',
  `add_source` varchar(32) NOT NULL DEFAULT 'market',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clowder_user_skill` (`uid`, `skill_source_id`),
  KEY `idx_clowder_user_skill_uid` (`uid`, `status`),
  KEY `idx_clowder_user_skill_source` (`skill_source_id`)
);

CREATE TABLE IF NOT EXISTS `clowder_user_skill_assignment` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid` varchar(40) NOT NULL,
  `user_skill_id` bigint unsigned NOT NULL,
  `agent_id` varchar(128) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clowder_skill_assignment` (`uid`, `user_skill_id`, `agent_id`),
  KEY `idx_clowder_skill_assignment_uid` (`uid`, `status`),
  KEY `idx_clowder_skill_assignment_agent` (`agent_id`)
);

CREATE TABLE IF NOT EXISTS `clowder_skill_file` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `skill_source_id` bigint unsigned NOT NULL,
  `relative_path` varchar(512) NOT NULL,
  `content_hash` varchar(128) NOT NULL DEFAULT '',
  `size_bytes` bigint NOT NULL DEFAULT 0,
  `editable` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clowder_skill_file` (`skill_source_id`, `relative_path`)
);

CREATE TABLE IF NOT EXISTS `clowder_skill_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid` varchar(40) NOT NULL,
  `action` varchar(64) NOT NULL,
  `skill_source_id` bigint unsigned NOT NULL DEFAULT 0,
  `user_skill_id` bigint unsigned NOT NULL DEFAULT 0,
  `detail_json` text,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clowder_skill_audit_uid` (`uid`, `created_at`)
);
