CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`type` text NOT NULL,
	`last4` text,
	`is_own` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK("accounts"."type" in ('bank', 'credit_card', 'wallet', 'upi_lite', 'cash'))
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`parent_id` text,
	`kind` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "categories_kind_check" CHECK("categories"."kind" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_paise` integer NOT NULL,
	`direction` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'posted' NOT NULL,
	`account_id` text,
	`counterparty` text,
	`merchant_id` text,
	`category_id` text,
	`occurred_at` integer NOT NULL,
	`note` text,
	`source` text NOT NULL,
	`sms_ref_id` text,
	`upi_ref` text,
	`dedupe_key` text,
	`linked_txn_id` text,
	`exclude_from_stats` integer DEFAULT false NOT NULL,
	`user_edited` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_txn_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_amount_paise_check" CHECK(typeof("transactions"."amount_paise") = 'integer' and "transactions"."amount_paise" between 1 and 9007199254740991),
	CONSTRAINT "transactions_direction_check" CHECK("transactions"."direction" in ('debit', 'credit')),
	CONSTRAINT "transactions_kind_check" CHECK("transactions"."kind" in ('expense', 'income', 'transfer', 'refund', 'reversal', 'cash_withdrawal')),
	CONSTRAINT "transactions_status_check" CHECK("transactions"."status" in ('posted', 'failed', 'pending')),
	CONSTRAINT "transactions_source_check" CHECK("transactions"."source" in ('sms', 'manual', 'ios_intent', 'paste')),
	CONSTRAINT "transactions_occurred_at_check" CHECK(typeof("transactions"."occurred_at") = 'integer'),
	CONSTRAINT "transactions_created_at_check" CHECK(typeof("transactions"."created_at") = 'integer'),
	CONSTRAINT "transactions_updated_at_check" CHECK(typeof("transactions"."updated_at") = 'integer'),
	CONSTRAINT "transactions_deleted_at_check" CHECK("transactions"."deleted_at" is null or typeof("transactions"."deleted_at") = 'integer')
);
