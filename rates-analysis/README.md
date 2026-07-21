# Historical Cash Investment Analysis — Split VBA Modules Version 4

Public Excel/VBA model for corporate cash-investment analysis across ON, 1M, 2M, 3M and 6M tenors.

The recommended installation now uses two separate VBA modules:

- `Rates_Analysis_Structure.bas` — creates and formats the workbook.
- `Rates_Analysis_Model.bas` — reads the curve and calculates the complete model.

## Structure-module procedures

- `CreateRatesAnalysisStructure` — resets and creates all model worksheets.
- `CreateBlankRatesModel` — backward-compatible alias.
- `EnsureRatesAnalysisStructure` — creates missing sheets without clearing existing inputs.

## Model-module procedures

- `BuildRatesAnalysisModel` — validates inputs and rebuilds calculations, tables, frontier descriptions and eight dashboard charts.
- `LoadSimulationData` — loads deterministic test data.
- `RunRatesModelSelfTest` — builds the simulation and runs structural and reconciliation checks.

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

Rates use percentage-point format: `4.31` means `4.31%`.

## Rolling-strategy engine

- ACT/360.
- Interest is reinvested at each completed maturity.
- Monthly transaction rolls remain anchored to the requested analysis start date.
- A missing maturity target uses the latest curve date on or before the target.
- ON accrues through weekends and holidays until the next available curve date.

## Daily rolling reinvestment risk

Every eligible **curve date** is treated as a valid investment start:

- start rate: the same-tenor rate on that curve date;
- target maturity: start date plus tenor, month-end aware;
- actual maturity: latest curve date on or before the target;
- maturity rate: same-tenor rate at actual maturity;
- reset: maturity rate minus start rate, in basis points;
- ON: start date to the next available curve date.

The observations overlap intentionally because each curve date represents a separate possible investment decision. Reset volatility is the sample standard deviation of these full-horizon reset changes. It is not annualized or divided by tenor length.

## Earnings volatility and efficient frontier

Aligned month-end economic returns remain the basis for earnings volatility, covariance and the efficient frontier. Daily reset risk is not used as the covariance input because it answers a different question.

Every efficient-frontier point includes:

- frontier rank and segment;
- historical risk-return description;
- complete tenor allocation;
- weighted-average maturity;
- liquidity available within 30, 60 and 90 days.

The segments range from **Minimum Volatility** through **Defensive**, **Conservative**, **Balanced**, **Return Oriented** and **Maximum Historical Return**. These are historical descriptions, not recommendations.

## Corrected chart logic

- Historical-rate charts retain actual Excel dates and use chronological time-scale axes.
- Monthly observations use the last available curve observation in each month.
- No chart observation extends beyond the selected analysis end date.
- Reset-volatility charts compare the full maturity horizon for 1M, 2M, 3M and 6M; ON remains available as a separate reference statistic.

## Public files

- `Rates_Analysis_Structure.bas` — workbook creation and formatting.
- `Rates_Analysis_Model.bas` — calculation, reset-risk, frontier and chart engine.
- `Rates_Analysis_Split_Modules_v4.zip` — both modules and installation documentation.
- `SPLIT_MODULES_v4.md` — detailed installation and methodology.
- `ACTUAL_CURVE_REVISION_v3.md` — actual uploaded-curve findings and validation details.

The earlier combined files remain in the folder for version history.

## Excel instructions

1. Open a blank macro-enabled workbook in desktop Excel.
2. Press `Alt + F11`.
3. Select **File → Import File** and import `Rates_Analysis_Structure.bas`.
4. Import `Rates_Analysis_Model.bas`.
5. Run `CreateRatesAnalysisStructure`.
6. Enter the input values and paste the curve.
7. Run `BuildRatesAnalysisModel`.

The public workflow reconstructs both VBA modules, runs static procedure checks and publishes the downloadable files. Desktop Excel compilation is still required before production use.
