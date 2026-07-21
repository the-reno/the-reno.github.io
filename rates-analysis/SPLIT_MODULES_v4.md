# Rates Analysis VBA — Split Modules Version 4

Import both files into the same desktop Excel workbook.

## 1. `Rates_Analysis_Structure.bas`

Creates and formats the workbook structure.

Public macros:

- `CreateRatesAnalysisStructure` — resets and creates all model worksheets.
- `CreateBlankRatesModel` — backward-compatible alias.
- `EnsureRatesAnalysisStructure` — creates missing sheets without clearing user data.

The structure contains:

- `Inputs`
- `Curve`
- `Data_Quality`
- `Transactions`
- `Daily_Accrual`
- `Premium_Analysis`
- `Rolling_Results`
- `Monthly_Returns`
- `Portfolio_Analysis`
- `Swap_Data`
- `Swap_Analysis`
- `Chart_Data`
- `Dashboard`
- `Methodology`
- `Test_Results`
- `Daily_Rolling_Reset`

## 2. `Rates_Analysis_Model.bas`

Reads the user inputs and curve, then calculates and writes the complete model.

Public macros:

- `BuildRatesAnalysisModel`
- `LoadSimulationData`
- `RunRatesModelSelfTest`

## Required inputs

In `Inputs`:

| Cell | Value |
|---|---|
| B5 | Analysis start date |
| B6 | Analysis end date |
| B7 | Initial notional |
| B8 | Efficient-frontier weight step, such as 10% |

In `Curve`:

```text
Date | ON | 1M | 2M | 3M | 6M
```

Rates are percentage points: `4.31` means `4.31%`.

## Calculation conventions

- ACT/360.
- Interest reinvested at every completed maturity.
- Monthly rolls remain anchored to the analysis start date.
- Missing target dates use the latest curve observation on or before the target.
- ON matures on the next available curve date.
- Daily rolling reset risk uses every eligible curve date as a valid investment start.
- Reset volatility uses same-tenor full-horizon rate changes in basis points.
- Earnings volatility uses aligned month-end economic returns.
- The efficient frontier uses earnings covariance, not reset volatility.
- Every frontier point includes a role, description, allocation, WAM, and liquidity buckets.

## Installation

1. Open a blank macro-enabled workbook.
2. Press `Alt + F11`.
3. Import `Rates_Analysis_Structure.bas`.
4. Import `Rates_Analysis_Model.bas`.
5. Run `CreateRatesAnalysisStructure`.
6. Enter inputs and paste the curve.
7. Run `BuildRatesAnalysisModel`.

## Validation

Both modules were statically checked for balanced procedures, duplicate procedure names and unsafe one-dimensional range writes. Desktop Excel VBA compilation is still required before production use.
