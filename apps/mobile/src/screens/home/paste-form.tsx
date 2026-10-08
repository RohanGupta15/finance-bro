import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { DuplicateReviewRequiredError, type DataLayer } from '@/db';
import { transactionDirections, transactionKinds, transactionStatuses } from '@/db/schema';
import type { PastePreparation, ReviewCorrections } from '@/imports/paste';
import { amountInput, indiaDate, money, parseIndiaDate } from '@/utils/display';
import { parseInrAmount } from '@/db/manual';
import { Fonts, Radius, Spacing, Stroke, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Direction = typeof transactionDirections[number];
type Kind = typeof transactionKinds[number];
type Status = typeof transactionStatuses[number];
type CategoryOption = Awaited<ReturnType<DataLayer['listCategories']>>[number];
type AccountOption = Awaited<ReturnType<DataLayer['listAccounts']>>[number];
type SaveOutcome = 'inserted' | 'duplicate';

const directions = transactionDirections;
const kinds = transactionKinds;
const statuses = transactionStatuses;

function categoryKind(kind: Kind, direction: Direction): 'expense' | 'income' | undefined {
  if (kind === 'expense') return 'expense';
  if (kind === 'income') return 'income';
  if ((kind === 'refund' || kind === 'reversal') && direction === 'credit') return 'expense';
  return undefined;
}

function safeAmountText(paise: number | undefined): string {
  if (paise === undefined || !Number.isSafeInteger(paise)) return '';
  try {
    return amountInput(paise);
  } catch {
    return '';
  }
}

function safeDateText(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return '';
  try {
    return indiaDate(new Date(timestamp));
  } catch {
    return '';
  }
}

function displayKind(kind: string): string {
  return kind.replaceAll('_', ' ');
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
      {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

function Choice({
  label,
  selected,
  disabled,
  onPress,
  accessibilityRole = 'radio',
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  accessibilityRole?: 'button' | 'radio';
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
          borderColor: colors.border,
          opacity: disabled ? 0.48 : pressed ? 0.75 : 1,
        },
      ]}>
      <Text style={[styles.choiceText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function PasteForm({
  ledger,
  onSaved,
  onCancel,
}: {
  ledger: DataLayer;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const colors = useTheme();
  const dark = useColorScheme() === 'dark';
  const [sender, setSender] = useState('');
  const [body, setBody] = useState('');
  const [prepared, setPrepared] = useState<PastePreparation | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [amountText, setAmountText] = useState('');
  const [direction, setDirection] = useState<Direction | ''>('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [status, setStatus] = useState<Status | ''>('');
  const [dateText, setDateText] = useState('');
  const [merchant, setMerchant] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [excludeFromStats, setExcludeFromStats] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [riskRequiredAfterError, setRiskRequiredAfterError] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const availableCategories = useMemo(() => {
    if (!direction || !kind) return categories;
    const requiredKind = categoryKind(kind, direction);
    return requiredKind ? categories.filter((category) => category.kind === requiredKind) : categories;
  }, [categories, direction, kind]);

  const amountValue = useMemo(() => {
    if (!amountText.trim()) return { amountPaise: null, message: 'Enter the amount in rupees.' };
    try {
      return { amountPaise: parseInrAmount(amountText), message: '' };
    } catch {
      return { amountPaise: null, message: 'Use rupees with up to two decimal places, for example 450.00.' };
    }
  }, [amountText]);

  const parsedDate = useMemo(() => {
    if (!dateText.trim()) return null;
    try {
      return parseIndiaDate(dateText);
    } catch {
      return null;
    }
  }, [dateText]);

  const duplicateReviewRequired = prepared?.kind === 'needs-review' &&
    (prepared.duplicateReviewRequired || riskRequiredAfterError);
  const consistentKind = kind !== 'expense' || direction === 'debit';
  const consistentIncome = kind !== 'income' || direction === 'credit';
  const selectedCategoryIsValid = categoryId === null || availableCategories.some((category) => category.id === categoryId);
  const canPrepare = body.trim().length > 0 && !busy;
  const canSave = prepared?.kind === 'needs-review' && amountValue.amountPaise !== null &&
    Boolean(direction && kind && status && parsedDate) && consistentKind && consistentIncome && selectedCategoryIsValid &&
    (!duplicateReviewRequired || riskAcknowledged) && !busy;

  function resetReview() {
    setPrepared(null);
    setOutcome(null);
    setError('');
    setCategories([]);
    setAccounts([]);
    setAmountText('');
    setDirection('');
    setKind('');
    setStatus('');
    setDateText('');
    setMerchant('');
    setReference('');
    setNote('');
    setCategoryId(null);
    setAccountId(null);
    setExcludeFromStats(false);
    setRiskAcknowledged(false);
    setRiskRequiredAfterError(false);
  }

  async function prepare() {
    if (busyRef.current || !body.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const receivedAt = Date.now();
      const result = await ledger.preparePaste({
        sender: sender.trim() || 'PASTE',
        body,
        receivedAt,
      });
      let nextCategories: CategoryOption[] = [];
      let nextAccounts: AccountOption[] = [];
      if (result.kind === 'needs-review') {
        [nextCategories, nextAccounts] = await Promise.all([
          ledger.listCategories(),
          ledger.listAccounts(),
        ]);
      }
      if (!mountedRef.current) return;
      setCategories(nextCategories);
      setAccounts(nextAccounts);
      setPrepared(result);
      setOutcome(null);
      setRiskAcknowledged(false);
      setRiskRequiredAfterError(false);
      if (result.kind === 'needs-review') {
        const candidate = result.candidate;
        setAmountText(safeAmountText(candidate?.amountPaise));
        setDirection(candidate?.direction ?? '');
        setKind(candidate?.kind ?? '');
        setStatus(candidate?.status ?? '');
        setDateText(safeDateText(candidate?.occurredAt));
        setMerchant(candidate?.counterparty ?? candidate?.vpa ?? '');
        setReference(candidate?.upiRef ?? '');
      }
      setSender('');
      setBody('');
      Keyboard.dismiss();
    } catch {
      if (mountedRef.current) setError('Could not prepare this paste. Your text is still here; try again.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function save() {
    if (busyRef.current || prepared?.kind !== 'needs-review' || !canSave) return;
    let amountPaise: number;
    let occurredAt: Date;
    try {
      amountPaise = parseInrAmount(amountText);
      const candidateTime = prepared.candidate ? new Date(prepared.candidate.occurredAt) : undefined;
      const preserveTimeFrom = candidateTime && Number.isFinite(candidateTime.getTime()) ? candidateTime : undefined;
      occurredAt = parseIndiaDate(dateText, preserveTimeFrom);
    } catch {
      setError('Check the amount and India calendar date before saving.');
      return;
    }
    if (!direction || !kind || !status) return;
    if (kind === 'expense' && direction !== 'debit') {
      setError('An expense must be a debit.');
      return;
    }
    if (kind === 'income' && direction !== 'credit') {
      setError('Income must be a credit.');
      return;
    }

    const corrections: ReviewCorrections = {
      amountPaise,
      direction,
      kind,
      status,
      occurredAt,
      accountId,
      categoryId,
      counterparty: merchant.trim() || null,
      note: note.trim() || null,
      upiRef: reference.trim() || null,
      excludeFromStats,
    };
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await ledger.saveReviewedPaste(prepared, corrections, {
        acknowledgeDuplicateRisk: riskAcknowledged,
      });
      if (mountedRef.current) setOutcome(result);
    } catch (cause) {
      if (!mountedRef.current) return;
      if (cause instanceof DuplicateReviewRequiredError) {
        setRiskRequiredAfterError(true);
        setRiskAcknowledged(false);
        setError('The import key changed since review. Check the duplicate warning before saving.');
      } else {
        setError('Could not save this review. Your corrections are still here; try again.');
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  function cancel() {
    if (busyRef.current) return;
    setSender('');
    setBody('');
    resetReview();
    onCancel();
  }

  function changeDirection(value: Direction) {
    setDirection(value);
    const requiredKind = kind ? categoryKind(kind, value) : undefined;
    if (categoryId && requiredKind) {
      const selected = categories.find((category) => category.id === categoryId);
      if (selected?.kind !== requiredKind) setCategoryId(null);
    }
  }

  function changeKind(value: Kind) {
    setKind(value);
    const requiredKind = direction ? categoryKind(value, direction) : undefined;
    if (categoryId && requiredKind) {
      const selected = categories.find((category) => category.id === categoryId);
      if (selected?.kind !== requiredKind) setCategoryId(null);
    }
  }

  function complete() {
    resetReview();
    if (outcome === 'inserted') onSaved();
    else onCancel();
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.backgroundElement,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Paste a bank message</Text>
          <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>Review every detail before it is saved on this device.</Text>
        </View>

        {!prepared ? (
          <View style={[styles.panel, { backgroundColor: colors.backgroundElement, borderColor: colors.border, shadowColor: dark ? 'transparent' : colors.shadow }]}>
            <Field label="Sender (optional)" hint="A bank name or message header helps identify repeat pastes.">
              <TextInput
                accessibilityLabel="Message sender, optional"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setSender}
                placeholder="For example, HDFCBK"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                style={inputStyle}
                value={sender}
              />
            </Field>
            <Field label="Message text" hint="The message is used for this review, then cleared. It is never stored as a message.">
              <TextInput
                accessibilityLabel="Paste bank message text"
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!busy}
                multiline
                onChangeText={setBody}
                placeholder="Paste the bank message here"
                placeholderTextColor={colors.textSecondary}
                scrollEnabled={false}
                style={[...inputStyle, styles.messageInput]}
                textAlignVertical="top"
                value={body}
              />
            </Field>
            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.over }]}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPrepare, busy }}
                disabled={!canPrepare}
                onPress={prepare}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent, borderColor: colors.border, opacity: !canPrepare ? 0.45 : pressed ? 0.78 : 1 }]}>
                <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>{busy ? 'Reading…' : 'Read message'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={cancel}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: busy ? 0.45 : pressed ? 0.7 : 1 }]}>
                <Text style={[styles.secondaryLabel, { color: colors.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : prepared.kind === 'ignored' ? (
          <View style={[styles.panel, { backgroundColor: colors.backgroundElement, borderColor: colors.border, shadowColor: dark ? 'transparent' : colors.shadow }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Nothing to save</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>This message was classified as {prepared.reason.replaceAll('_', ' ')}. It will not be added to your ledger.</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={resetReview} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent, borderColor: colors.border, opacity: busy ? 0.45 : pressed ? 0.78 : 1 }]}>
                <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>Paste another</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={cancel} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: busy ? 0.45 : pressed ? 0.7 : 1 }]}>
                <Text style={[styles.secondaryLabel, { color: colors.text }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        ) : outcome ? (
          <View style={[styles.panel, { backgroundColor: colors.backgroundElement, borderColor: colors.border, shadowColor: dark ? 'transparent' : colors.shadow }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {outcome === 'inserted' ? 'Saved on this device' : 'Already in your ledger'}
            </Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>
              {outcome === 'inserted'
                ? 'The reviewed transaction is now in your local ledger. The message text was cleared.'
                : 'A matching paste already exists. Your saved transaction and any corrections were left unchanged.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={complete}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
              <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.panel, { backgroundColor: colors.backgroundElement, borderColor: colors.border, shadowColor: dark ? 'transparent' : colors.shadow }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Review this message</Text>
            {prepared.candidate ? (
              <View style={[styles.summary, { borderBottomColor: colors.rule }]}>
                <Text style={[styles.summaryAmount, { color: colors.text }]}>
                  {direction === 'credit' ? '+' : '−'}{amountValue.amountPaise === null ? 'Amount needs correction' : money(amountValue.amountPaise)}
                </Text>
                <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>
                  {merchant.trim() || 'Merchant not identified'} · {kind ? displayKind(kind) : 'kind needed'} · {status || 'status needed'}
                </Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {dateText ? `India date ${dateText}` : 'Transaction date needs review'}
                  {categoryId ? ` · ${categories.find((item) => item.id === categoryId)?.name ?? 'Category selected'}` : ' · No category selected'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>The message looks financial, but no transaction details were reliable enough to fill in. Enter every required field yourself.</Text>
            )}

            <Field label="Amount (₹)" hint={amountValue.message}>
              <TextInput
                accessibilityLabel="Transaction amount in rupees"
                editable={!busy}
                keyboardType="decimal-pad"
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                selectTextOnFocus
                style={inputStyle}
                value={amountText}
              />
            </Field>
            <Field label="Direction">
              <View style={styles.choices}>
                {directions.map((value) => <Choice key={value} label={value === 'debit' ? 'Debit' : 'Credit'} selected={direction === value} disabled={busy} onPress={() => changeDirection(value)} />)}
              </View>
            </Field>
            <Field label="Transaction type">
              <View style={styles.choices}>
                {kinds.map((value) => <Choice key={value} label={displayKind(value)} selected={kind === value} disabled={busy} onPress={() => changeKind(value)} />)}
              </View>
              {!consistentKind || !consistentIncome ? <Text style={[styles.error, { color: colors.over }]}>Expenses must be debits and income must be credits.</Text> : null}
            </Field>
            <Field label="Status" hint="Only posted entries count toward monthly totals.">
              <View style={styles.choices}>
                {statuses.map((value) => <Choice key={value} label={value} selected={status === value} disabled={busy} onPress={() => setStatus(value)} />)}
              </View>
            </Field>
            <Field label="Transaction date" hint="The parser starts with the message arrival date. Correct it if the bank text says otherwise.">
              <TextInput
                accessibilityLabel="Transaction date in India calendar, year month day"
                editable={!busy}
                keyboardType="numbers-and-punctuation"
                onChangeText={setDateText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
                value={dateText}
              />
              {dateText && !parsedDate ? <Text style={[styles.error, { color: colors.over }]}>Enter a real date as YYYY-MM-DD.</Text> : null}
            </Field>
            <Field label="Merchant or person" hint="This is a short ledger label, not the original message.">
              <TextInput accessibilityLabel="Merchant or person" editable={!busy} onChangeText={setMerchant} placeholder="Optional" placeholderTextColor={colors.textSecondary} style={inputStyle} value={merchant} />
            </Field>
            <Field label="Category">
              <View style={styles.choices}>
                <Choice label="No category" selected={categoryId === null} disabled={busy} onPress={() => setCategoryId(null)} />
                {availableCategories.map((category) => (
                  <Choice key={category.id} label={category.name} selected={categoryId === category.id} disabled={busy} onPress={() => setCategoryId(category.id)} />
                ))}
              </View>
              {availableCategories.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary }]}>No matching categories are available yet.</Text> : null}
              {!selectedCategoryIsValid ? <Text style={[styles.error, { color: colors.over }]}>Choose a category that matches this transaction type.</Text> : null}
            </Field>
            <Field label="Account">
              <View style={styles.choices}>
                <Choice label="No account" selected={accountId === null} disabled={busy} onPress={() => setAccountId(null)} />
                {accounts.map((account) => {
                  const detail = [account.institution, account.last4 ? `••${account.last4}` : null].filter(Boolean).join(' · ');
                  return <Choice key={account.id} label={detail ? `${account.name} · ${detail}` : account.name} selected={accountId === account.id} disabled={busy} onPress={() => setAccountId(account.id)} />;
                })}
              </View>
              {accounts.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary }]}>No accounts set up; you can leave this blank.</Text> : null}
            </Field>
            <Field label="UPI reference (optional)">
              <TextInput accessibilityLabel="UPI reference, optional" autoCapitalize="none" autoCorrect={false} editable={!busy} onChangeText={setReference} placeholder="Reference number" placeholderTextColor={colors.textSecondary} style={inputStyle} value={reference} />
            </Field>
            <Field label="Note (optional)">
              <TextInput accessibilityLabel="Transaction note, optional" editable={!busy} multiline onChangeText={setNote} placeholder="Add context for yourself" placeholderTextColor={colors.textSecondary} style={[...inputStyle, styles.noteInput]} textAlignVertical="top" value={note} />
            </Field>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: excludeFromStats, disabled: busy }}
              disabled={busy}
              onPress={() => setExcludeFromStats((value) => !value)}
              style={styles.checkRow}>
              <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: excludeFromStats ? colors.accent : 'transparent' }]}>
                {excludeFromStats ? <View style={[styles.checkMark, { backgroundColor: colors.onAccent }]} /> : null}
              </View>
              <Text style={[styles.bodyCopy, { color: colors.text }]}>Exclude this transaction from monthly totals</Text>
            </Pressable>

            {duplicateReviewRequired ? (
              <View style={[styles.warning, { borderTopColor: colors.rule }]}>
                <Text style={[styles.warningTitle, { color: colors.text }]}>Duplicate checking needs your review</Text>
                <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>The import key changed or older pasted entries cannot be checked with this key. Saving may add a transaction already in your ledger. This warning will also apply to future pastes because those earlier fingerprints cannot be checked.</Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: riskAcknowledged, disabled: busy }}
                  disabled={busy}
                  onPress={() => setRiskAcknowledged((value) => !value)}
                  style={styles.checkRow}>
                  <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: riskAcknowledged ? colors.accent : 'transparent' }]}>
                    {riskAcknowledged ? <View style={[styles.checkMark, { backgroundColor: colors.onAccent }]} /> : null}
                  </View>
                  <Text style={[styles.bodyCopy, { color: colors.text }]}>I understand and want to save despite the duplicate risk</Text>
                </Pressable>
              </View>
            ) : null}

            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.over }]}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave, busy }}
                disabled={!canSave}
                onPress={save}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent, borderColor: colors.border, opacity: !canSave ? 0.45 : pressed ? 0.78 : 1 }]}>
                <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>
                  {busy ? 'Saving…' : duplicateReviewRequired ? 'Save with duplicate risk' : 'Save reviewed transaction'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={cancel}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: busy ? 0.45 : pressed ? 0.7 : 1 }]}>
                <Text style={[styles.secondaryLabel, { color: colors.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.four, paddingBottom: Spacing.tabBarClearance, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  title: { ...Type.screenTitle },
  sectionTitle: { ...Type.sectionTitle },
  bodyCopy: { ...Type.body, flexShrink: 1 },
  hint: { ...Type.note },
  label: { ...Type.label },
  panel: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: Stroke.ink,
    borderRadius: Radius.card,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
  },
  field: { gap: Spacing.two },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: Stroke.ink,
    borderRadius: Radius.control,
    fontFamily: Fonts.sans,
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
  },
  messageInput: { minHeight: 128, paddingTop: 12 },
  noteInput: { minHeight: 88 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 44, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: 14, borderWidth: Stroke.ink, borderRadius: Radius.pill },
  choiceText: { ...Type.label, flexShrink: 1, textTransform: 'capitalize' },
  summary: { gap: Spacing.one, paddingBottom: Spacing.three, borderBottomWidth: Stroke.hairline },
  summaryAmount: { ...Type.amount },
  error: { ...Type.note },
  warning: { paddingTop: Spacing.three, gap: Spacing.two, borderTopWidth: Stroke.hairline },
  warningTitle: { ...Type.rowTitle },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: { width: 24, height: 24, borderWidth: Stroke.ink, borderRadius: Radius.tile, alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 10, height: 10, borderRadius: 2 },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
  primaryButton: { minHeight: 52, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center', borderWidth: Stroke.ink, borderRadius: Radius.card, shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.18, shadowRadius: 0 },
  primaryLabel: { ...Type.rowTitle },
  secondaryButton: { minHeight: 48, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center', borderWidth: Stroke.ink, borderRadius: Radius.pill },
  secondaryLabel: { ...Type.body },
});
