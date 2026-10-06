import { parseSms, type ParseResult } from '@finance-bro/sms-parser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function describe(result: ParseResult): string {
  switch (result.kind) {
    case 'transaction': {
      const { txn } = result;
      const who = txn.counterparty ?? txn.vpa ?? 'unknown payee';
      return `${txn.direction === 'debit' ? '−' : '+'}${inr.format(txn.amountPaise / 100)} · ${who} · ${txn.kind}${txn.status === 'failed' ? ' (failed)' : ''}`;
    }
    case 'review':
      return 'Needs review — looks financial but not confident enough to log.';
    case 'ignored':
      return `Ignored (${result.reason}).`;
  }
}

/**
 * Temporary home: the ledger isn't built yet, so this exercises the shared parser
 * on-device. It becomes the paste fallback once the feed lands.
 */
export function Home() {
  const colors = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const isReadDisabled = !text.trim();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Your money</ThemedText>
          <ThemedText themeColor="textSecondary">
            Transactions will appear here automatically. For now, paste a bank SMS to see how it’s read.
          </ThemedText>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Paste an SMS"
            accessibilityLabel="Paste a bank SMS"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isReadDisabled }}
            disabled={isReadDisabled}
            onPress={() => setResult(parseSms({ sender: 'PASTE', body: text, receivedAt: Date.now() }))}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: isReadDisabled ? 0.4 : pressed ? 0.8 : 1 }]}>
            <ThemedText themeColor="onAccent" style={styles.buttonLabel}>Read message</ThemedText>
          </Pressable>

          {result && <ThemedText>{describe(result)}</ThemedText>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  input: { minHeight: 120, borderWidth: 1, borderRadius: Radius.card, padding: Spacing.three, textAlignVertical: 'top', fontSize: 16 },
  button: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { fontWeight: 600 },
});
