NII ENGINE v2 — the curve is the named object
=============================================
Four worksheet functions. The curve reads the scenario and holiday RANGES
directly, records which ranges built it, and stores the daily strip.

  RatesCurve(name, start, end, sofr, scenRange, holRange)  -> RatesCurve.NAME
  GET(curveCell)        spills provenance header + daily strip
  ACCRUE(start, end, amount, type, curveCell)        interest $mm
  SWAP(start, end, notional, fixed, curveCell, leg)  FIXED | FLOAT | NET

THE CURVE STORES (inspect with GET):
  provenance : name, SOFR, which scenario range, which holiday range
  daily strip: date | rate% | dayFactor | accumFactor
               dayFactor   = 1 + rate*days/360   (one business day)
               accumFactor = running product     (SOFR in-arrears)

FILES
  build_engine_v2.py    run locally -> NII_Engine_v2.xlsx (needs openpyxl)
  NII_Engine_v2.xlsx    example workbook (formula-free; paste from column E)
  bas/                  import directly (File > Import File)
    mRegistry.bas       name -> object store
    cRatesCurve.bas     the curve (class): build, strip, factors, spill
    mEngine.bas         the four worksheet functions

INSTALL
  1. Alt+F11 > File > Import File... import all 3 .bas from bas/.
  2. Save as .xlsm, press Ctrl+Alt+F9.
  3. MODEL: build the curve cell (B6) first; the rest reference it.

RULE  Ranges/cells are passed as references, never typed text — so editing
      a holiday or a Fed move rebuilds the curve and everything downstream.

GOLDEN VALUES (verified vs Python twin)
  Period simple   0.853750     Period compound  0.857325
  Swap July 375mm: FIXED 1.017187 | FLOAT 1.142773 | NET -0.125585

----------------------------------------------------------------------
ONE-COMMAND MACRO-ENABLED BUILD (Windows + Excel)
----------------------------------------------------------------------
build_xlsm.py drives your Excel to produce NII_Engine_v2.xlsm with the
VBA already inside - no manual import.

  pip install pywin32
  python build_xlsm.py     (run in this folder; bas/ must be alongside)

One-time, if Excel blocks VBA import:
  File > Options > Trust Center > Trust Center Settings > Macro Settings
  > tick "Trust access to the VBA project object model".

Result: NII_Engine_v2.xlsm - open it, enable macros, Ctrl+Alt+F9,
the MODEL Check column reads OK.
