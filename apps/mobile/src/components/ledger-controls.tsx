import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LedgerButton({ label, onPress, disabled = false, primary = false, selected, expanded }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; expanded?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, ...(selected !== undefined && { selected }), ...(expanded !== undefined && { expanded }) }}
    aria-pressed={selected} aria-expanded={expanded} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, {
      borderColor: colors.border, backgroundColor: primary ? colors.accent : selected ? colors.fill : colors.backgroundElement,
      opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
    }]}>
    <ThemedText style={[Type.body, { fontFamily: Fonts.sansSemiBold, color: primary ? colors.onAccent : selected ? colors.background : colors.text }]}>{label}</ThemedText>
  </Pressable>;
}

export function MonthNavigation({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors = useTheme();
  const label = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  function move(delta: number) {
    const [year, value] = month.split('-').map(Number);
    const total = year! * 12 + value! - 1 + delta;
    onChange(`${String(Math.floor(total / 12)).padStart(4, '0')}-${String(total % 12 + 1).padStart(2, '0')}`);
  }
  return <View style={styles.monthPicker}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose month, ${label} ${month.slice(0, 4)}`} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)}
      style={[styles.button, styles.monthPill, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <ThemedText style={{ ...Type.body, fontFamily: Fonts.sansHeavy }}>{label}</ThemedText>
      <View style={{ width: 7, height: 7, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.text, transform: [{ rotate: '45deg' }] }} />
    </Pressable>
    {open ? <View style={styles.month}>
      <LedgerButton label="Previous month" disabled={month === '0001-01'} onPress={() => move(-1)} />
      <ThemedText style={[Type.amountSmall, styles.monthText]}>{month}</ThemedText>
      <LedgerButton label="Next month" disabled={month === '9999-12'} onPress={() => move(1)} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderWidth: 2, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center' },
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  monthText: { flexGrow: 1, textAlign: 'center' },
  monthPicker: { gap: 8, alignItems: 'flex-end' },
  monthPill: { flexDirection: 'row', gap: 10 },
});
