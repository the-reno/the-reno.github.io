NII ENGINE v2 — object layer
============================
Six worksheet functions, built on the registry/handle pattern.

  HolidayTable(name, range)                          -> HolidayTable.NAME
  FedScenario(name, range)                           -> FedScenario.NAME
  RatesCurve(name, start, end, sofr, scenCell, holCell) -> RatesCurve.NAME
  GET(handleCell)                                    spills the whole dataset
  ACCRUE(start, end, amount, type, curveCell)        interest $mm
  SWAP(start, end, notional, fixed, curveCell, leg)  FIXED | FLOAT | NET

FILES
  build_engine_v2.py    run locally to create NII_Engine_v2.xlsx (needs openpyxl)
  NII_Engine_v2.xlsx    the example workbook (formula-free; paste from column E)
  bas/                  the VBA modules, import directly (File > Import File)
    mRegistry.bas       name -> object store
    cHolidayTable.bas   holiday set (class)
    cFedScenario.bas    FOMC move list (class)
    cRatesCurve.bas     assembled daily-stripped curve (class)
    mEngine.bas         the six worksheet functions

INSTALL
  1. Alt+F11 > File > Import File... import all 5 .bas from bas/.
  2. Save as .xlsm, press Ctrl+Alt+F9.
  3. MODEL sheet: paste column-E formulas into the yellow cells,
     B4/B5/B6 (holidays, scenario, curve) first.

RULE  Handles flow cell-to-cell ($B$6), never typed text — so edits cascade.

GOLDEN VALUES (verified vs Python twin)
  Period simple   0.853750     Period compound  0.857325
  Swap July 375mm: FIXED 1.017187 | FLOAT 1.142773 | NET -0.125585
