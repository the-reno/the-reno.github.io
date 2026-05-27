# Revised version published.
# Changes:
# - Removed dependency on T8:T11 helper area from cashflow table
# - Added accrued amount columns directly in SOFR engine
# - Added IFERROR wrappers to avoid #VALUE after maturity
# - Preserved original layout/design/dashboard
# - Preserved non-compounded SOFR spread methodology
# - Preserved carried SOFR logic over weekends/holidays
#
# Main production logic remains aligned with market convention:
# compounded SOFR + linear spread adjustment.
