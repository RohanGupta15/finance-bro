CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	CONSTRAINT "bills_label_check" CHECK(length(trim("bills"."label")) > 0),
	CONSTRAINT "bills_amount_paise_check" CHECK(typeof("bills"."amount_paise") = 'integer' and "bills"."amount_paise" between 1 and 9007199254740991),
	CONSTRAINT "bills_due_date_check" CHECK(length("bills"."due_date") = 10 and "bills"."due_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "bills_paid_check" CHECK(typeof("bills"."paid") = 'integer' and "bills"."paid" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`month` text NOT NULL,
	`amount_paise` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_month_check" CHECK(length("budgets"."month") = 7 and "budgets"."month" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]' and cast(substr("budgets"."month", 6, 2) as integer) between 1 and 12),
	CONSTRAINT "budgets_amount_paise_check" CHECK(typeof("budgets"."amount_paise") = 'integer' and "budgets"."amount_paise" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_month_unique` ON `budgets` (`category_id`,`month`);
--> statement-breakpoint
CREATE TRIGGER `budgets_expense_category_insert`
BEFORE INSERT ON `budgets`
WHEN EXISTS (SELECT 1 FROM `categories` WHERE `id` = NEW.`category_id` AND `kind` <> 'expense')
BEGIN
	SELECT RAISE(ABORT, 'budgets require an expense category');
END;
--> statement-breakpoint
CREATE TRIGGER `budgets_expense_category_update`
BEFORE UPDATE OF `category_id` ON `budgets`
WHEN EXISTS (SELECT 1 FROM `categories` WHERE `id` = NEW.`category_id` AND `kind` <> 'expense')
BEGIN
	SELECT RAISE(ABORT, 'budgets require an expense category');
END;
--> statement-breakpoint
CREATE TRIGGER `categories_budget_kind_update`
BEFORE UPDATE OF `kind` ON `categories`
WHEN NEW.`kind` <> 'expense' AND EXISTS (SELECT 1 FROM `budgets` WHERE `category_id` = OLD.`id`)
BEGIN
	SELECT RAISE(ABORT, 'budget categories must remain expenses');
END;
