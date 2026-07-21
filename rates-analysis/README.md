# Historical Cash Investment Analysis — Actual-Curve Version 3

Public Excel/VBA model for corporate cash-investment analysis across ON, 1M, 2M, 3M and 6M tenors.

## Main VBA procedures

- `CreateBlankRatesModel` — creates the spreadsheet structure.
- `BuildRatesAnalysisModel` — validates inputs and rebuilds the calculations, tables and eight dashboard charts.
- `LoadSimulationData` — loads deterministic test data.
- `RunRatesModelSelfTest` — builds the simulation and runs reconciliation checks.

## User inputs

In the `Inputs` worksheet:

| Cell | Input |
|---|---|
| B5 | Analysis start date |
| B6 | Analysis end date |
| B7 | Initial notional |
| B8 | Efficient-frontier allocation step, such as 10% |

In the `Curve` worksheet, use these exact headers:

```text
Date | ON | 1M | 2M | 3M | 6M
```

Rates use percentage-point format: `1.54` means `1.54%`.

## Rolling-strategy engine

- ACT/360.
- Interest is reinvested at each completed maturity.
- Monthly transaction rolls remain anchored to the requested analysis start date.
- A missing maturity target uses the latest curve date on or before the target.
- ON accrues through weekends and holidays until the next available curve date.

## Daily rolling reinvestment risk

Every **calendar date** is treated as a possible cash-availability scenario:

- actual investment start: first curve date on or after the scenario date;
- target maturity: scenario date plus tenor, month-end aware;
- actual maturity: latest curve date on or before the target;
- reset: same-tenor maturity rate minus same-tenor start rate, in basis points;
- ON: actual start to the next available curve date.

The observations overlap intentionally because each calendar date represents a separate possible investment decision. Reset volatility is the sample standard deviation of these full-horizon reset changes. It is not annualized or divided by tenor length.

## Earnings volatility and efficient frontier

Aligned complete-month economic returns remain the basis for earnings volatility, covariance and the efficient frontier. Daily reset risk is not used as the covariance input because it answers a different question.

Every efficient-frontier point includes:

- frontier rank and segment;
- historical risk-return description;
- complete tenor allocation;
- weighted-average maturity;
- liquidity available within 30, 60 and 90 days.

The segments range from **Minimum Volatility** through **Defensive**, **Conservative**, **Balanced**, **Return Oriented** and **Maximum Historical Return**. These are historical descriptions, not recommendations.

## Actual-curve correction

The version 3 correction fixed two important issues:

1. the rolling-reset sheet was still displaying simulation results instead of the uploaded curve;
2. month labels such as `Jan-23` were being converted by Excel into unintended calendar dates, creating serial-number axes and an incorrect sequence.

See [`ACTUAL_CURVE_REVISION_v3.md`](ACTUAL_CURVE_REVISION_v3.md) for the recalculated results and validation details.

## Generated files

- `Rates_Analysis_Final.bas` — current VBA source reconstructed from the version 3 source parts.
- `Rates_Model_Blank_Template.xlsx` — empty input structure.
- `Rates_Model_Simulation_Test.xlsx` — deterministic simulation with calculations and tests.
- `Rates_Model_Simulation_Dashboard.png` — simulation dashboard preview.
- `TEST_RESULTS.md` — automated simulation reconciliation results.
- `ACTUAL_CURVE_REVISION_v3.md` — actual uploaded-curve findings and correction details.
- `Rates_Analysis_Final_Package.zip` — public package.

## Excel instructions

1. Open a blank macro-enabled workbook in desktop Excel.
2. Press `Alt + F11`.
3. Select **File → Import File** and import `Rates_Analysis_Final.bas`.
4. Run `CreateBlankRatesModel`.
5. Enter the inputs and paste the curve.
6. Run `BuildRatesAnalysisModel`.

The public workflow reconstructs the current VBA module after generating the simulation artifacts.
