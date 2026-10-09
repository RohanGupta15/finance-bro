# Ledger performance checkpoint — 2026-10-09

Tracked in [issue #71](https://github.com/Starforge-lab/finance-bro/issues/71).
These are API timings with fictional data. They do not measure app startup,
rendering, scrolling, background capture, energy use or release-build performance.

## Android baseline

Motorola Edge 60 Pro, Android 17, ARM64 development client, source
`007771e804a5473d649eee179fc11c81f2aeede0`. APK SHA-256:
`F44898B48338D7EB3EE86B9079BCB0BCE17E66DAE900AB4315E0E1A11BB17F9A`.
Each query had one warmup followed by three measured calls; values below are
medians in milliseconds.

| Fixture rows / distribution | Monthly summary | Month entries | Month menu | All live entries | CSV |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10,000 / 24 months | 355.36 | 357.61 | 2,862.50 | 5,916.97 | 7,140.60 |
| 10,000 / one month | 5,687.45 | 5,664.16 | 2,634.41 | 5,687.18 | 6,859.05 |
| 50,000 / 24 months | 1,238.81 | 1,233.23 | 13,195.77 | 28,765.53 | 33,694.85 |

Independent fixture totals, live-row counts, month counts, CSV row counts and
20 validated manual writes passed in each completed case. Tombstones leave
9,655 or 48,275 live rows. The benchmark only opens its named QA database and
uses no personal ledger or SecureStore key.

The first invocation was stopped during the bulk DELETE between scenarios:
the self-referencing transaction foreign key made the reset unexpectedly slow.
A separate Node SQLite reproduction took 139,939.94 ms for that reset.
The remaining 50,000-row single-month case was restarted in a fresh QA database.
Its last observed stage was the monthly summary; the phone subsequently
disconnected. Its final result and cleanup have **not** been retrieved.
The original report writer also left trailing bytes on shorter writes; retain
the raw report and parse its complete first JSON object. The second invocation
uses overwrite before writing. These are harness limitations.

## Summary projection comparison on desktop

Node 22.23.1 with the repository's Node SQLite test adapter, baseline
`e1b165dcdb8ba8bb60cc98cd448a4bf5cae44d6c`, changed source
`d1e4b915e4f19905f694b7f6a52ae493a6def7d4`.
Both queries run against the same fresh database per fixture. After warmup,
five samples alternate which implementation runs first.

| Fixture rows / distribution | Before median (ms) | After median (ms) |
| --- | ---: | ---: |
| 10,000 / 24 months | 3.8863 | 2.0368 |
| 10,000 / one month | 50.4876 | 26.0540 |
| 50,000 / 24 months | 12.1326 | 7.6706 |
| 50,000 / one month | 317.3738 | 150.0731 |

All returned fields, dates and category summaries match exactly, and expense,
income and net also pass an independent integer-paise oracle in all four cases.
This demonstrates the desktop result, **not a native speedup**. The same-phone
before/after comparison remains required before making that claim.

## Fixture and remaining gates

Fixtures use five accounts, ten expense categories and one income category.
Row `i` has `100 + i % 997` paise. Kind precedence is transfer (`i % 13 = 0`),
refund (`i % 11 = 0`), income (`i % 7 = 0`), then expense. Failed status precedes
pending at divisors 17 and 19; divisor 23 excludes statistics and divisor 29
tombstones the row. Dates span November 2024 through October 2026, or all lie
in October 2026, using days 1–27 and fictional millisecond offsets.

The production web export passes fictional Home category totals, Insights
income/expense/net, category budget spending/remaining and reload persistence.
INR 1,000 income and INR 200 expense yield INR 800 net; QA Food spends INR 74.50
against an INR 100 limit, leaving INR 25.50 for that category.

Native comparison, iOS, full UI performance, bounded entry loading, month-menu
scaling and CSV scaling remain open. No SQL money aggregation, schema migration
or speculative cache was introduced by the summary projection change.
