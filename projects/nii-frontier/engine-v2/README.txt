NII ENGINE v2 — clear names
===========================
The curve is the one named object. Six worksheet functions.

BUILD
  BuildCurve(name, start, end, sofr, fedRange, holidayRange)  -> "RatesCurve.NAME | OK | ..."
        builds the curve from the input ranges; stores it by name.

READ
  CurveName(curveCell)            -> "RatesCurve.NAME"  (tidy name for re-use)
  CurveRate(curveCell, date)      -> SOFR rate % in force on that date

USE
  Accrue(start, end, amount, type, curveCell)        -> interest $mm   (type: SIMPLE / COMPOUND)
  SwapLeg(start, end, notional, fixed, curveCell, leg) -> FIXED | FLOAT | NET

THREE MODULES
  mRegistry.bas   the in-memory store: StoreObject / FetchObject / CleanName
                  (a cell holds a name; the object lives here; recalc rebuilds it)
  cRatesCurve.bas the curve class: staircase + daily strip (rate, dayFactor, accumFactor)
                  + RateOn(date), SimpleFactor, CompoundFactor
  mEngine.bas     the six worksheet functions above (the only module that reads cells)

RULE  Pass ranges and the curve handle as CELLS ($B$6), never typed text,
      so editing a holiday or Fed move cascades through the whole chain.

INSTALL (any computer with Excel)
  Alt+F11 > File > Import File... import the 3 .bas from bas/.
  cRatesCurve imports as a CLASS module (under "Class Modules"); the other
  two are normal Modules. Save as .xlsm, Ctrl+Alt+F9.

GOLDEN VALUES (verified)
  Accrue simple 0.853750   Accrue compound 0.857325
  SwapLeg July 375mm: FIXED 1.017187 | FLOAT 1.142773 | NET -0.125585
  CurveRate 15-Jul=3.55  30-Jul=3.30  (after the Jul-29 cut takes effect)
