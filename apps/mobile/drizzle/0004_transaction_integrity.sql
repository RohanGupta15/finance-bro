CREATE TRIGGER transactions_consistency_insert
BEFORE INSERT ON transactions
WHEN (NEW.kind = 'expense' AND NEW.direction <> 'debit')
  OR (NEW.kind = 'income' AND NEW.direction <> 'credit')
  OR EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.category_id AND (
      (NEW.kind = 'income' AND kind <> 'income')
      OR ((NEW.kind = 'expense' OR (NEW.direction = 'credit' AND NEW.kind IN ('refund', 'reversal'))) AND kind <> 'expense')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'transaction direction, kind and category are incompatible');
END;
--> statement-breakpoint
CREATE TRIGGER transactions_consistency_update
BEFORE UPDATE OF direction, kind, category_id ON transactions
WHEN (NEW.kind = 'expense' AND NEW.direction <> 'debit')
  OR (NEW.kind = 'income' AND NEW.direction <> 'credit')
  OR EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.category_id AND (
      (NEW.kind = 'income' AND kind <> 'income')
      OR ((NEW.kind = 'expense' OR (NEW.direction = 'credit' AND NEW.kind IN ('refund', 'reversal'))) AND kind <> 'expense')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'transaction direction, kind and category are incompatible');
END;
--> statement-breakpoint
CREATE TRIGGER categories_transaction_kind_update
BEFORE UPDATE OF kind ON categories
WHEN NEW.kind <> OLD.kind AND EXISTS (SELECT 1 FROM transactions WHERE category_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'referenced transaction categories must retain their kind');
END;
