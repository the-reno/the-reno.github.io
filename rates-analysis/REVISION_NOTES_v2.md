# Rates Analysis Model v2

## Added daily rolling reinvestment analysis

Every available curve date is treated as a valid investment start date for each tenor.
For each start date, the model compares the same-tenor rate at the start with the
same-tenor rate available at the actual maturity date.

The new `Daily_Rolling_Reset` worksheet includes:

- start and maturity dates;
- rate-observation dates;
- start and maturity rates;
- reset change in basis points;
- actual elapsed days;
- next-cycle dollar impact;
- descriptive statistics by tenor.

Reset volatility is the sample standard deviation of the overlapping daily rolling
reset changes. It is not annualized or divided by tenor length.

## Added efficient-frontier descriptions

Every efficient-frontier point now includes:

- frontier rank;
- frontier segment;
- historical risk-return description;
- allocation summary;
- weighted-average maturity;
- liquidity available within 30, 60 and 90 days.

The classifications range from minimum volatility through defensive, conservative,
balanced, return oriented and maximum historical return.

## Simulation validation

The deterministic simulation produced:

- 5,330 daily accrual rows;
- 3,545 daily rolling reset scenarios;
- 834 transactions;
- 24 efficient-frontier points;
- descriptions for all 24 frontier points;
- eight dashboard charts.

All reconciliation tests in the `Test_Results` worksheet passed.
