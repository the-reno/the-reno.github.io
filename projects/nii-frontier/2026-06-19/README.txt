NII ENGINE — 2026-06-19
========================
Four VBA modules. Import directly (no pasting needed).

  mRegistry.bas     Module          name -> object store
  cRatesCurve.bas   Class Module    the curve: staircase + daily strip
  mEngine.bas       Module          worksheet functions (RBuildCurve etc.)
  mDeposit.bas      Module          deposit ledger macro (BuildDepositLedger)

INSTALL
  1. Alt+F11 to open the VBA editor.
  2. File > Import File... select each .bas in this folder.
     cRatesCurve imports automatically as a Class Module; the other
     three import as standard Modules. No renaming needed - the file
     already carries the correct module name.
  3. Save the workbook as .xlsm.
  4. Debug > Compile VBAProject - must compile clean before use.

WORKSHEET FUNCTIONS
  =RBuildCurve(name, start, end, sofr, fedRange, holidayRange)
       Builds the curve from the input ranges. Returns "RatesCurve.name"
       on success, "#CURVE_ERR: reason" if something is wrong.
  =RCurveRate(curveCell, date)
       The SOFR rate in force on a date. Returns "#RATE_ERR: ..." if
       the date is outside the curve's built range.
  =RAccrue(start, end, amount, "SIMPLE"|"COMPOUND", curveCell)
       Interest in $mm over a period.
  =RSwapLeg(start, end, notional, fixed, curveCell, "FIXED"|"FLOAT"|"NET")
       One leg (or the net) of a swap period.

RULE: pass ranges and the curve handle as CELLS, never typed text -
so editing a holiday or a Fed move cascades through the whole chain.

DEPOSIT LEDGER MACRO
  Alt+F8 > BuildDepositLedger

  Reads from an INPUTS sheet:
    B4  Start date
    B5  Horizon in years (0.5 / 1 / 1.5 / 2)
    B6  ON allocation  ($mm)
    B7  1M allocation  ($mm)
    B8  2M allocation  ($mm)
    B9  3M allocation  ($mm)
    A14:A30  Holiday dates (one per row, blank row stops reading)

  Writes one self-contained row per business day per active bucket to
  a LEDGER sheet:
    StartDate | EndDate | Bucket | FwdDate | Rate% | Notional($mm) | Interest($mm)

  FwdDate is the date to look up in the curve:
    ON        -> StartDate (overnight fixes each morning)
    1M/2M/3M  -> Following(placement + n months) - the forward
                 maturity date; the rate observed there locks for
                 the whole deposit period.

  Rate% and Interest are left blank. Activate with:
    Rate%     (col E): =RCurveRate(curveCell, D2)
    Interest  (col G): =F2*(E2/100)*(B2-A2)/360

GOLDEN VALUES (verified)
  RAccrue simple    0.853750     RAccrue compound  0.857325
  RSwapLeg  FIXED 1.017187 | FLOAT 1.142773 | NET -0.125585
  RCurveRate 15-Jul = 3.55 | 30-Jul = 3.30 (after the Jul-29 cut)
