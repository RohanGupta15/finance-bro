import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LedgerButton } from '@/components/ledger-controls';
import { Colors, Fonts, Radius, Shadow, Spacing, Stroke, Type } from '@/constants/theme';
import type { DataLayer } from '@/db/service';
import { parseInrAmount } from '@/db/manual';
import { amountInput, indiaDate, parseIndiaDate } from '@/utils/display';
import { useTheme } from '@/hooks/use-theme';

type Transaction = NonNullable<Awaited<ReturnType<DataLayer['getTransaction']>>>;
type Direction = 'debit' | 'credit';
type LoadState = 'loading' | 'ready' | 'error';

const indiaOffsetMs = 330 * 60 * 1000;

function dateAtIndiaClock(input: string, source?: Date): Date {
  const midnight = parseIndiaDate(input);
  if (!source) return midnight;
  const indiaTime = new Date(source.getTime() + indiaOffsetMs);
  const timeIntoDay = (((indiaTime.getUTCHours() * 60 + indiaTime.getUTCMinutes()) * 60 + indiaTime.getUTCSeconds()) * 1000) + indiaTime.getUTCMilliseconds();
  return new Date(midnight.getTime() + timeIntoDay);
}

function categoryKindFor(kind: Transaction['kind'], direction: Direction): 'expense' | 'income' | undefined {
  if (kind === 'expense') return 'expense';
  if (kind === 'income') return 'income';
  if ((kind === 'refund' || kind === 'reversal') && direction === 'credit') return 'expense';
  return undefined;
}

function transactionLabel(kind: Transaction['kind']): string {
  switch (kind) {
    case 'cash_withdrawal': return 'Cash withdrawal';
    case 'refund': return 'Refund';
    case 'reversal': return 'Reversal';
    default: return kind[0]!.toUpperCase() + kind.slice(1);
  }
}

async function fetchOptions(ledger: DataLayer) {
  return Promise.all([ledger.listCategories(), ledger.listAccounts(true)]);
}

export type EntryFormProps = {
  ledger: DataLayer;
  onSaved: () => void;
  onCancel: () => void;
  transaction?: Transaction;
};

export function EntryForm({ ledger, onSaved, onCancel, transaction }: EntryFormProps) {
  const colors = useTheme();
  const [amount, setAmount] = useState(() => transaction ? amountInput(transaction.amountPaise) : '');
  const [initialDate] = useState(() => transaction ? indiaDate(transaction.occurredAt) : indiaDate());
  const [date, setDate] = useState(initialDate);
  const [direction, setDirection] = useState<Direction>(transaction?.direction ?? 'debit');
  const [kind, setKind] = useState<Transaction['kind']>(transaction?.kind ?? 'expense');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(transaction?.accountId ?? null);
  const [note, setNote] = useState(transaction?.note ?? '');
  const [categories, setCategories] = useState<Awaited<ReturnType<DataLayer['listCategories']>>>([]);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<DataLayer['listAccounts']>>>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [detailsOpen, setDetailsOpen] = useState(Boolean(transaction));
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'amount' | 'date' | 'note' | null>(null);
  const saveId = useState(() => randomUUID())[0];
  const submitGuard = useRef(false);
  const optionsRequest = useRef(0);
  const mounted = useRef(false);

  const dirty = transaction
    ? amount !== amountInput(transaction.amountPaise) ||
      date !== indiaDate(transaction.occurredAt) ||
      direction !== transaction.direction ||
      kind !== transaction.kind ||
      categoryId !== transaction.categoryId ||
      accountId !== transaction.accountId ||
      note !== (transaction.note ?? '')
    : amount !== '' || date !== initialDate || direction !== 'debit' || categoryId !== null || accountId !== null || note !== '';

  const requestCancel = useCallback(() => {
    if (submitting || submitGuard.current) return;
    if (!dirty) {
      onCancel();
      return;
    }
    if (Platform.OS === 'web') {
      setDiscardPromptOpen(true);
      return;
    }
    Alert.alert('Discard changes?', 'Your unsaved entry will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }, [dirty, onCancel, submitting]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestCancel();
      return true;
    });
    return () => subscription.remove();
  }, [requestCancel]);

  async function loadOptions() {
    const request = ++optionsRequest.current;
    setLoadState('loading');
    try {
      const [nextCategories, nextAccounts] = await fetchOptions(ledger);
      if (!mounted.current || request !== optionsRequest.current) return;
      setCategories(nextCategories);
      setAccounts(nextAccounts);
      setLoadState('ready');
    } catch {
      if (mounted.current && request === optionsRequest.current) setLoadState('error');
    }
  }

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const request = ++optionsRequest.current;
    void fetchOptions(ledger).then(([nextCategories, nextAccounts]) => {
      if (!active || request !== optionsRequest.current) return;
      setCategories(nextCategories);
      setAccounts(nextAccounts);
      setLoadState('ready');
    }).catch(() => {
      if (active && request === optionsRequest.current) setLoadState('error');
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [ledger]);

  const expectedCategoryKind = categoryKindFor(kind, direction);
  const visibleCategories = expectedCategoryKind
    ? categories.filter((category) => category.kind === expectedCategoryKind)
    : categories;
  const standardKind = kind === 'expense' || kind === 'income';

  function chooseDirection(nextDirection: Direction) {
    if (nextDirection === direction) return;
    const nextKind = !transaction || standardKind
      ? nextDirection === 'debit' ? 'expense' : 'income'
      : kind;
    setDirection(nextDirection);
    setKind(nextKind);
    const requiredCategoryKind = categoryKindFor(nextKind, nextDirection);
    setCategoryId((current) => current === null || requiredCategoryKind === undefined || categories.some((category) => category.id === current && category.kind === requiredCategoryKind) ? current : null);
  }

  async function submit() {
    if (submitGuard.current || submitting || loadState !== 'ready') return;
    setSubmitError(null);

    let amountPaise: number;
    let occurredAt: Date;
    try {
      amountPaise = parseInrAmount(amount);
    } catch {
      setSubmitError('Enter a positive INR amount with up to two decimal places.');
      return;
    }
    try {
      occurredAt = dateAtIndiaClock(date, transaction?.occurredAt ?? new Date());
    } catch {
      setDetailsOpen(true);
      setSubmitError('Enter a real date in YYYY-MM-DD format.');
      return;
    }

    submitGuard.current = true;
    setSubmitting(true);
    let saved = false;
    try {
      if (transaction) {
        const updated = await ledger.editTransaction(transaction.id, {
          amountPaise,
          direction,
          kind,
          occurredAt,
          categoryId,
          accountId,
          note: note.trim() || null,
        });
        if (!updated) throw new Error('Transaction is no longer available');
      } else {
        await ledger.saveManualEntry({
          id: saveId,
          amountInr: amount,
          direction,
          occurredAt,
          categoryId,
          accountId,
          note: note.trim() || null,
        });
      }
      saved = true;
    } catch {
      setSubmitError('Your entry was not saved. Your details are still here; try again.');
      setDetailsOpen(true);
    } finally {
      submitGuard.current = false;
      setSubmitting(false);
    }
    if (saved) onSaved();
  }

  const saveDisabled = submitting || loadState !== 'ready';

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          style={styles.scroll}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <ThemedText style={[Type.screenTitle, styles.title]}>{transaction ? 'Edit entry' : `Add ${direction === 'debit' ? 'expense' : 'income'}`}</ThemedText>
          </View>

          <View style={styles.amountSection}>
            <ThemedText style={styles.label}>Amount</ThemedText>
            <View style={[styles.amountField, { borderColor: colors.border, borderWidth: focusedField === 'amount' ? Stroke.ink : Stroke.hairline }]}>
              <ThemedText style={[Type.amountHero, styles.rupee]} accessibilityElementsHidden>₹</ThemedText>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                editable={!submitting}
                autoFocus={!transaction}
                keyboardType="decimal-pad"
                returnKeyType="next"
                accessibilityLabel="Amount in Indian rupees"
                accessibilityHint="Enter rupees and up to two paise digits, without a currency symbol."
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                onFocus={() => setFocusedField('amount')}
                onBlur={() => setFocusedField(null)}
                style={[Type.amountHero, styles.amountInput, { color: colors.text }]}
                maxLength={18}
              />
            </View>
          </View>

          {transaction && !standardKind && (
            <View style={styles.section}>
              <ThemedText style={styles.label}>Type</ThemedText>
              <View style={[styles.readOnlyType, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <ThemedText style={Type.body}>{transactionLabel(kind)}</ThemedText>
                <ThemedText themeColor="textSecondary" style={Type.note}>Type stays unchanged</ThemedText>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText style={styles.label}>{transaction && !standardKind ? 'Direction' : 'Type'}</ThemedText>
            <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={transaction && !standardKind ? 'Transaction direction' : 'Transaction type'}>
              <LedgerButton
                label={transaction && !standardKind ? 'Debit' : 'Expense'}
                selected={direction === 'debit'}
                disabled={submitting || loadState !== 'ready'}
                onPress={() => chooseDirection('debit')}
              />
              <LedgerButton
                label={transaction && !standardKind ? 'Credit' : 'Income'}
                selected={direction === 'credit'}
                disabled={submitting || loadState !== 'ready'}
                onPress={() => chooseDirection('credit')}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            onPress={() => {
              if (detailsOpen) Keyboard.dismiss();
              setDetailsOpen(!detailsOpen);
            }}
            style={({ pressed }) => [styles.detailsToggle, { borderColor: colors.border, backgroundColor: colors.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText style={styles.detailsToggleText}>{detailsOpen ? 'Hide details' : 'Add details'}</ThemedText>
          </Pressable>

          {loadState === 'error' && (
            <View style={styles.feedback}>
              <ThemedText accessibilityRole="alert" themeColor="over" style={Type.note}>Choices could not be loaded.</ThemedText>
              <LedgerButton label="Retry" onPress={() => void loadOptions()} />
            </View>
          )}

          {detailsOpen && <View style={styles.details}>
          <View style={styles.section}>
            <ThemedText style={styles.label}>Date <ThemedText themeColor="textSecondary" style={styles.optional}>(optional)</ThemedText></ThemedText>
            <TextInput
              value={date}
              onChangeText={setDate}
              editable={!submitting}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              accessibilityLabel="Transaction date"
              accessibilityHint="Use year-month-day format. The date is interpreted in India time."
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              onFocus={() => setFocusedField('date')}
              onBlur={() => setFocusedField(null)}
              style={[styles.textField, Type.body, { color: colors.text, backgroundColor: colors.backgroundElement, borderColor: colors.border, borderWidth: focusedField === 'date' ? Stroke.ink : Stroke.hairline }]}
              maxLength={10}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.label}>Category <ThemedText themeColor="textSecondary" style={styles.optional}>(optional)</ThemedText></ThemedText>
            {loadState === 'ready' ? (
              visibleCategories.length > 0 ? (
                <View style={styles.choices}>
                  <LedgerButton label="No category" selected={categoryId === null} disabled={submitting} onPress={() => setCategoryId(null)} />
                  {visibleCategories.map((category) => (
                    <LedgerButton key={category.id} label={category.name} selected={categoryId === category.id} disabled={submitting} onPress={() => setCategoryId(category.id)} />
                  ))}
                </View>
              ) : <ThemedText themeColor="textSecondary" style={Type.note}>No categories yet. You can save without one.</ThemedText>
            ) : <ThemedText themeColor="textSecondary" style={Type.note}>{loadState === 'loading' ? 'Loading categories…' : 'Categories could not be loaded.'}</ThemedText>}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.label}>Account <ThemedText themeColor="textSecondary" style={styles.optional}>(optional)</ThemedText></ThemedText>
            {loadState === 'ready' ? (
              accounts.length > 0 ? (
                <View style={styles.choices}>
                  <LedgerButton label="No account" selected={accountId === null} disabled={submitting} onPress={() => setAccountId(null)} />
                  {accounts.map((account) => (
                    <LedgerButton
                      key={account.id}
                      label={`${account.name}${account.archived ? ' · archived' : ''}`}
                      selected={accountId === account.id}
                      disabled={submitting}
                      onPress={() => setAccountId(account.id)}
                    />
                  ))}
                </View>
              ) : <ThemedText themeColor="textSecondary" style={Type.note}>No accounts yet. You can save without one.</ThemedText>
            ) : <ThemedText themeColor="textSecondary" style={Type.note}>{loadState === 'loading' ? 'Loading accounts…' : 'Accounts could not be loaded.'}</ThemedText>}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.label}>Note <ThemedText themeColor="textSecondary" style={styles.optional}>(optional)</ThemedText></ThemedText>
            <TextInput
              value={note}
              onChangeText={setNote}
              editable={!submitting}
              accessibilityLabel="Transaction note"
              placeholder="Add a detail to remember"
              placeholderTextColor={colors.textSecondary}
              multiline
              onFocus={() => setFocusedField('note')}
              onBlur={() => setFocusedField(null)}
              style={[styles.textField, styles.noteField, Type.body, { color: colors.text, backgroundColor: colors.backgroundElement, borderColor: colors.border, borderWidth: focusedField === 'note' ? Stroke.ink : Stroke.hairline }]}
            />
          </View>
          </View>}

        </ScrollView>
        <View style={[styles.actions, { backgroundColor: colors.background, borderTopColor: colors.rule }]}>
          {discardPromptOpen && (
            <View style={styles.feedback}>
              <ThemedText style={Type.body}>Discard changes?</ThemedText>
              <ThemedText themeColor="textSecondary" style={Type.note}>Your unsaved entry will be lost.</ThemedText>
              <View style={styles.choices}>
                <LedgerButton label="Keep editing" onPress={() => setDiscardPromptOpen(false)} />
                <LedgerButton label="Discard" selected onPress={onCancel} />
              </View>
            </View>
          )}
          {submitError && <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite" themeColor="over" style={[Type.note, styles.error]}>{submitError}</ThemedText>}
          <View style={styles.actionButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saveDisabled }}
              disabled={saveDisabled}
              onPress={() => void submit()}
              style={({ pressed }) => [styles.saveButton, primaryButtonStyle(colors), { opacity: saveDisabled ? 0.45 : pressed ? 0.82 : 1 }]}>
              <ThemedText themeColor="onAccent" style={styles.saveLabel}>{submitting ? 'Saving…' : transaction ? 'Save changes' : `Save ${direction === 'debit' ? 'expense' : 'income'}`}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
              disabled={submitting}
              onPress={requestCancel}
              style={({ pressed }) => [styles.cancelButton, { opacity: submitting ? 0.4 : pressed ? 0.65 : 1 }]}>
              <ThemedText themeColor="textSecondary" style={styles.cancelLabel}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function primaryButtonStyle(colors: (typeof Colors)['light'] | (typeof Colors)['dark']) {
  return {
    backgroundColor: colors.accent,
    borderColor: colors.text,
    boxShadow: colors === Colors.dark ? undefined : Shadow.card,
  } as const;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingTop: 52,
    paddingBottom: Spacing.four,
    gap: Spacing.section,
  },
  header: { gap: Spacing.two },
  title: { fontFamily: Fonts.sansHeavy },
  amountSection: { gap: Spacing.two },
  amountField: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    backgroundColor: 'transparent',
  },
  rupee: { fontSize: 36, lineHeight: 44 },
  amountInput: { flex: 1, minWidth: 80, padding: 0, fontVariant: ['tabular-nums'] },
  section: { gap: Spacing.two },
  label: { ...Type.label, fontSize: 14, lineHeight: 20 },
  optional: { fontSize: 13, fontWeight: '400' },
  readOnlyType: {
    minHeight: 56,
    borderWidth: Stroke.hairline,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  details: { gap: Spacing.section },
  detailsToggle: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: Stroke.ink,
    borderRadius: Radius.pill,
  },
  detailsToggleText: { ...Type.body, fontFamily: Fonts.sansSemiBold },
  textField: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: Stroke.hairline,
    borderRadius: Radius.control,
  },
  noteField: { minHeight: 92, textAlignVertical: 'top' },
  feedback: { gap: Spacing.two },
  error: { marginTop: -Spacing.two },
  actions: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: Stroke.hairline,
    gap: Spacing.two,
  },
  actionButtons: { gap: Spacing.two, alignItems: 'stretch' },
  saveButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: Stroke.ink,
    borderRadius: Radius.pill,
  },
  saveLabel: { ...Type.body, fontFamily: Fonts.sansSemiBold },
  cancelButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cancelLabel: { ...Type.note, fontWeight: '600' },
});
