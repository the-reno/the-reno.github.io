# Updated version preserving original layout/design.
# Key changes:
# - Keeps original dashboard formatting and chart placement
# - Removes holiday-name column from compounding engine
# - Simplifies Fed/SOFR logic using SUMIFS
# - Carries SOFR over weekends/holidays
# - Compounds SOFR only
# - Adds spread linearly after compounding
#
# Please use generate_excel_simple_v2.py as the active production script.
# This file now acts as the formatted/layout-preserving wrapper reference.
#
# Latest production logic:
# public-tools/deposit-sofr-swap-analyzer/generate_excel_simple_v2.py
