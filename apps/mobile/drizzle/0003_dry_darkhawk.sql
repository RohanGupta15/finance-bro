CREATE TABLE `import_key_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	CONSTRAINT "import_key_singleton" CHECK("import_key_state"."id" = 1)
);
