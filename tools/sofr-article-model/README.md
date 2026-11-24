# USD Cash Allocation Model

Open the article’s original rate history and follow the calculations through to the allocation decision. This folder stores the model code and both dated datasets.

## Open the model

Save [Open_SOFR.py](https://raw.githubusercontent.com/the-reno/the-reno.github.io/main/tools/sofr-article-model/Open_SOFR.py) once. From that folder on Windows, run this command with Python 3.10 or later.

    py -3 .\Open_SOFR.py

On macOS or Linux, run **python3 Open_SOFR.py**. If you already have the project folder on Windows, double-click **Run_SOFR_Model.cmd** to use the same launcher.

The launcher checks GitHub for the current project, downloads its code and data from one commit, and opens the model in your browser at localhost. Keep the command window open while you work. It reuses the last downloaded version when GitHub is unavailable.

### Data from GitHub

**Rates** links to the exact CSV revision used in the open model. Cash amounts, allocations, imported CSVs and notes are processed and stored on this computer.

If you are working on a local checkout of the code, run **py -3 app.py --source local --port 0** to open its included files. Run **py -3 Open_SOFR.py --check** to verify both baselines in the current GitHub version.

## Follow the article

| Screen | What to do |
| --- | --- |
| **1. Rate dataset** | Pick the article dataset, import a CSV or start a new sheet. Edit cells directly and save the dataset with a name and observations. |
| **2. Rates** | Read the rate history beside the latest quotes and full-sample analysis. |
| **3. Historical test** | Recalculate the 1,003 complete six-month decisions. Switch between the history and the scatter plot. Select an entry date to see Modified Following maturity, ACT/360 day count, the compounded ON return and the simple locked return. |
| **4. Cycle replay** | Compare rates-up and rates-down paths from a common 5.50% start. The table shows the article values and two reproducible calculations with their observation counts. |
| **5. Scenarios** | Compare the five original 36-month paths and annualized regret across pure ON, pure 6M and the ladder. Compare the archived chart values with the calculated table. |
| **6. Allocation** | Choose a rate path, enter a USD balance and change the mix. Compare interest with rolling ON and check annualized regret across the paths. Download the detailed scenario results. |

### Use a different curve

Open **Rate dataset** to switch between the July article, the September rerun, and saved datasets. Select a cell to type or clear a value. Select a row number or column heading to delete that row or column. The spreadsheet keeps the headers visible while you scroll and displays annual rate quotes to four decimal places.

Use **Import CSV** to load a file or **New dataset** to start with a blank sheet. Enter a **Dataset name** and any **Observations**, then choose **Save changes** to apply your edits to the model. Editing cells in an included dataset saves a separate local copy. Imported and edited curves use the September scenario method with the latest quotes from that sheet.

Calculations use **Date**, **ON**, **1M**, **3M**, and **6M**. You can save an incomplete sheet and finish it later. Use UTF-8 CSV files, unique dates such as 2026-09-01 in ascending order, and rates such as 3.66% or 0.0366. **Download CSV** includes the entire sheet. Across calendar-day gaps, the calculation holds the overnight quote until the next observation.

## Reconciliation

| Figure | July article and source workbook | Calculated with the source rates |
| --- | --- | --- |
| Historical 6M vs. ON | 1,003 decisions · 32% 6M wins · −4.7 bp average excess | 1,003 decisions · 32.4028% · −4.6507 holding-period bp |
| Cycle replay · rates up / rates down | −14.5 / +16.4 bp, supplied in the Cycle_Excess sheet | −23.6588 / +15.8221 bp for the audit workbook’s first trade. The full-window means are −21.9575 / +9.2055 bp. |
| ON / 1M / 3M / 6M ladder | 10% / 15% / 25% / 50% | 10% / 15% / 25% / 50%, selected from 781 feasible mixes in 5-point increments |
| July ladder worst regret | 9.8 bp, maximum of the supplied Regret rows | 3.0542 annualized bp using the July workbook’s monthly-compounding method |
| September v10 | Saved September reference model | 1,036 historical decisions · 31.3707% 6M wins · −4.5732 bp. Five paths and 4,580 windows. Reference worst regret 40.7692 bp. Grid minimum 39.5209 bp. |

The July source preserves the slide’s cycle excess and per-scenario regret figures as supplied values. The calculation workbook rebuilds returns from the saved rates and scenario nodes. Its July method interpolates monthly ON and applies the same modeled quote to each tenor at its reset, comparing a single 36-month holding period per path. September generates daily term curves and compares overlapping 180-day windows.

The historical charts use the calculated decisions. The first point starts on January 3, 2022, shows a 14.6505 bp quoted spread, and produces a −11.7785 bp holding-period difference at the adjusted July 5 maturity.

Run **py -3 app.py --check** on Windows or **python3 app.py --check** on macOS/Linux to reconcile the built-in datasets and calculation outputs.

## Sources

- July input rates, scenario nodes and archived values come from **USD_Cash_Allocation_Data(2).xlsx**. The calculation reference is **USD_Cash_Allocation_Fully_Calculated.xlsx**, including its Premium_Outcome, Cycle_Excess and Allocation_Grid sheets.
- September input comes from **Curve 1-sep(1).csv**. **USD_Cash_Allocation_Model_v10.xlsx** supplies the later scenario and reconciliation conventions.
- Overnight compounding follows the observed business-day sequence. The historical term inputs are SOFR OIS par-rate proxies. [NY Fed SOFR methodology](https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates) · [Eris historical par coupon curve](https://files.erisfutures.com/ftp/Eris_Historical_ParCouponCurve_SOFR.csv)

Scenario paths are illustrative. The model excludes fees, credit losses and liquidity costs. Historical and September scenario windows overlap.
