# Simulation test results — revised model

The revised deterministic simulation was generated and validated before publication.

- Curve observations: **783**
- Transactions: **834**
- Daily accrual rows: **5,330**
- Daily rolling reset scenarios: **3,545**
- Efficient-frontier points: **24**
- Frontier descriptions populated: **24 of 24**
- Dashboard charts: **8**
- Result: **PASS**

## Ending values

| Tenor | Ending value | Total interest | Annualized return |
|---|---:|---:|---:|
| ON | $113,472,311.53 | $13,472,311.53 | 4.361% |
| 1M | $113,547,752.90 | $13,547,752.90 | 4.384% |
| 2M | $113,614,542.31 | $13,614,542.31 | 4.405% |
| 3M | $113,683,430.03 | $13,683,430.03 | 4.426% |
| 6M | $113,787,549.24 | $13,787,549.24 | 4.459% |

## Daily rolling reset volatility

| Tenor | Scenarios | Reset volatility | 5th percentile | Median | 95th percentile |
|---|---:|---:|---:|---:|---:|
| ON | 761 | 0.54 bps | -0.82 | -0.01 | 0.65 |
| 1M | 739 | 11.70 bps | -18.16 | -1.17 | 14.07 |
| 2M | 719 | 23.04 bps | -36.05 | -3.90 | 26.80 |
| 3M | 696 | 34.13 bps | -54.94 | -8.75 | 39.14 |
| 6M | 630 | 61.45 bps | -107.30 | -31.89 | 67.66 |

The reset series intentionally overlaps because every eligible business date represents a valid investment start scenario.
