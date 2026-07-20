# Historical Cash Investment Analysis

Public Excel/VBA model for corporate cash-investment analysis across ON, 1M, 2M, 3M and 6M tenors.

## Main VBA procedures

- `CreateBlankRatesModel` — creates the spreadsheet structure.
- `BuildRatesAnalysisModel` — validates inputs and builds the calculations, tables and charts.
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

## Analysis modules

### Daily accrual and rolling results

- ACT/360.
- Interest is reinvested at each completed maturity.
- Monthly rolls remain anchored to the requested start date.
- Missing target dates use the latest curve date on or before the target.
- ON accrues through weekends and holidays until the next available curve date.

### Daily rolling reinvestment risk

Every eligible curve date is treated as a valid deposit start date for every tenor. The model compares the same-tenor start rate with the same-tenor rate available at the actual maturity date.

The `Daily_Rolling_Reset` worksheet reports:

- start, target maturity and actual maturity dates;
- start and maturity rate-observation dates;
- reset change in basis points;
- actual elapsed days;
- next-cycle dollar impact;
- reset volatility, percentiles and stress outcomes by tenor.

Reset volatility is the sample standard deviation of all overlapping daily rolling reset changes. It is not annualized or divided by tenor length because the full maturity horizon is part of the investment decision.

### Earnings volatility and efficient frontier

Aligned month-end economic returns remain the basis for covariance, earnings volatility and the efficient frontier.

Every efficient-frontier point includes:

- frontier rank and segment;
- historical risk-return description;
- complete tenor allocation;
- weighted-average maturity;
- liquidity available within 30, 60 and 90 days.

The segments range from **Minimum Volatility** through **Defensive**, **Conservative**, **Balanced**, **Return Oriented** and **Maximum Historical Return**. These are historical descriptions, not investment recommendations.

## Generated files

- `Rates_Analysis_Final.bas` — complete VBA source.
- `Rates_Model_Blank_Template.xlsx` — empty input structure.
- `Rates_Model_Simulation_Test.xlsx` — deterministic simulation with calculations and tests.
- `Rates_Model_Simulation_Dashboard.png` — dashboard preview.
- `TEST_RESULTS.md` — automated reconciliation results.
- `REVISION_NOTES_v2.md` — explanation of the revised risk and frontier modules.
- `Rates_Analysis_Final_Package.zip` — complete package.

## Excel instructions

1. Open a blank macro-enabled workbook in desktop Excel.
2. Press `Alt + F11`.
3. Select **File → Import File** and import `Rates_Analysis_Final.bas`.
4. Run `CreateBlankRatesModel`.
5. Enter the inputs and paste the curve.
6. Run `BuildRatesAnalysisModel`.

The repository workflow reconstructs the VBA source, generates the Excel files, runs deterministic tests and publishes the outputs automatically.
