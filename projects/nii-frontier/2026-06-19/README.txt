NII ENGINE v2 — four clean functions
=====================================
RBuildCurve(name, start, end, sofr, fedRange, holidayRange)
     Reads the scenario and holiday ranges directly. Returns "RatesCurve.name"
     when built OK, "#CURVE_ERR: reason" if something is wrong. Downstream
     RAccrue/RCurveRate/RSwapLeg show #N/A when the curve cell has an error.

RCurveRate(curveCell, date)
     SOFR rate % in force on that date. The point lookup for cashflow rows.

RAccrue(start, end, amount, type, curveCell)
     Interest in $mm. type = "SIMPLE" or "COMPOUND" (in-arrears).

RSwapLeg(start, end, notional, fixed, curveCell, leg)
     leg = "FIXED" | "FLOAT" | "NET". Coordinator: two RAccrue calls + sign.

THREE MODULES
  mRegistry.bas   StoreObject / FetchObject / CleanName
  cRatesCurve.bas staircase + daily strip (rate, dayFactor, accumFactor) + RateOn
  mEngine.bas     the four worksheet functions above

RULE  Pass ranges and curveCell as CELLS, never typed text.
INSTALL  Alt+F11 > File > Import File > import the 3 .bas.
         cRatesCurve must land under Class Modules. Save as .xlsm, Ctrl+Alt+F9.

GOLDEN VALUES
  RAccrue simple 0.853750 | compound 0.857325
  RSwapLeg FIXED 1.017187 | FLOAT 1.142773 | NET -0.125585
  RCurveRate 15-Jul=3.55 | 30-Jul=3.30
