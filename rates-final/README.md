# SOFR Monthly Factor Simulator — Final Version

Public final version of the monthly roll-factor model.

## Web page

Open `/rates-final/` on the published site.

## Workbook structure

- `CurveCalc`: curve data only
- `Input!B1`: final end date
- `Input!B2`: analysis period in years
- `Output`: monthly factor table

## Roll logic

- Fixed monthly roll day comes from the final end date.
- If a roll date is not in the curve, use the previous available curve date.
- ON and 1M appear every month.
- 2M appears every 2 months.
- 3M appears every 3 months.
- 6M appears every 6 months.
- Rate is taken from the investment start date.
- Factor = `1 + Rate × Days / 360`.

## VBA files

- `Setup.bas`: creates the Input and Output sheets.
- `CurveRoll.bas`: builds the monthly factors from the CurveCalc data.
