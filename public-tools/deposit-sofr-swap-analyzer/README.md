# Deposit vs SOFR Swap Analyzer

Single-tab Excel model for comparing a fixed-rate deposit against a forward-starting SOFR swap overlay.

## Purpose

This tool is designed for a simple treasury/sales discussion:

- What does the fixed deposit earn?
- What does the SOFR swap add or subtract?
- What is the total maturity cash flow?
- What is the incremental pickup or cost versus staying fixed?

## Model structure

The Excel workbook contains one consolidated worksheet with:

1. Transaction inputs
2. Market data inputs
3. Fed shock path
4. Deposit-only output
5. Deposit + swap output
6. Incremental value analysis
7. Daily accrual engine
8. Interest comparison chart

## Key assumptions

- Deposit accrues ACT/360.
- Swap fixed leg accrues ACT/360.
- Swap floating leg is daily compounded SOFR + spread.
- Fed meeting shocks are entered by the user in basis points.
- Fed shocks impact SOFR from the business day after the meeting date.
- No PV or mark-to-market is calculated.
- Swap settlement is shown at maturity.

## Default example

- Notional: USD 100,000,000
- Deposit start: 26-May-2026
- Deposit end: 20-Aug-2026
- Deposit fixed rate: 3.95%
- Swap start: 17-Jun-2026
- Swap end: 20-Aug-2026
- Floating leg: daily compounded SOFR + 26bp

## Excel file

The workbook is available from the ChatGPT-generated file link in the related workflow. GitHub connector upload for binary .xlsx files is limited here, so this public folder documents the model and assumptions.

## Note

This is a cash-flow analysis tool, not a valuation model. It is intended for quick scenario comparison and client discussion, not official accounting valuation or hedge-effectiveness testing.
