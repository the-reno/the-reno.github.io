# Historical Cash Investment Analysis

Public Excel/VBA model for historical corporate cash-investment analysis across ON, 1M, 2M, 3M and 6M tenors.

## Main VBA file

`Rates_Analysis_Final.bas` creates the workbook structure and calculates the model from user-supplied inputs and curve data.

Main procedures:

- `CreateBlankRatesModel` — creates the spreadsheet structure.
- `BuildRatesAnalysisModel` — validates inputs and builds all calculations, tables and charts.
- `LoadSimulationData` — loads deterministic test data.
- `RunRatesModelSelfTest` — creates the structure, runs the simulation and checks reconciliations.

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

## Model conventions

- ACT/360.
- Interest is reinvested at every completed maturity.
- Monthly rolls remain anchored to the requested start date.
- When the target date is absent, the latest curve date on or before the target is used.
- ON accrues through weekends and holidays until the next available curve date.
- The daily accrual ledger is the source for all subsequent analytics.

## Generated files

- `Rates_Analysis_Final.bas` — complete VBA source.
- `Rates_Model_Blank_Template.xlsx` — empty input structure.
- `Rates_Model_Simulation_Test.xlsx` — model populated with deterministic simulation data.
- `Rates_Model_Simulation_Dashboard.png` — dashboard preview.
- `TEST_RESULTS.md` — automated reconciliation results.
- `Rates_Analysis_Final_Package.zip` — package containing the files above.

## Excel instructions

1. Open a blank macro-enabled workbook in desktop Excel.
2. Press `Alt + F11`.
3. Select **File → Import File** and import `Rates_Analysis_Final.bas`.
4. Run `CreateBlankRatesModel`.
5. Enter the inputs and paste the curve.
6. Run `BuildRatesAnalysisModel`.

The repository workflow reconstructs the VBA source, generates the Excel files, runs deterministic tests and publishes the outputs automatically.
