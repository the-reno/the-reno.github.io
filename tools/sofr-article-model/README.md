# USD Cash Allocation Model

Open the article’s original rate history and follow the calculations through to the allocation decision. This folder stores the model code and both dated datasets.

## Open the model

Open the local copy of **tools/sofr-article-model** and double-click **Run_SOFR_Model.cmd** on Windows. Python 3.10 or later starts the model on localhost and opens the HTML in your browser. Keep the command window open while you work.

To get a local copy of this folder with Git, run:

    git clone --filter=blob:none --sparse https://github.com/the-reno/the-reno.github.io.git ronu-one
    cd ronu-one
    git sparse-checkout set tools/sofr-article-model
    cd tools/sofr-article-model

On macOS or Linux, run this command from the extracted folder.

    python3 app.py --port 0

On Windows, the terminal command is:

    py -3 app.py --port 0

### Data from GitHub

At startup the launcher reads the July curve, the July scenario inputs and the September curve from a single commit on the repository’s main branch. **Rates** links to the exact CSV revision.

If the connection fails, the model uses the included rate files and displays that source in **Rates**. Add **--source github** to require a GitHub connection or **--source local** to start with the included files. Cash amounts, allocations and imported CSVs are processed on localhost.

## Follow the article

| Screen | What to do |
| --- | --- |
| **1. Rates** | Read the rate history beside the latest quotes and full-sample analysis. Open **Rate datasets** in the header to inspect the source observations. |
| **2. Historical test** | Recalculate the 1,003 complete six-month decisions. Switch between the history and the scatter plot. Select an entry date to see Modified Following maturity, ACT/360 day count, the compounded ON return and the simple locked return. |
| **3. Cycle replay** | Compare rates-up and rates-down paths from a common 5.50% start. The table shows the article values and two reproducible calculations with their observation counts. |
| **4. Scenarios** | Compare the five original 36-month paths and annualized regret across pure ON, pure 6M and the ladder. Compare the archived chart values with the calculated table. |
| **5. Allocation** | Choose a rate path, enter a USD balance and change the mix. Compare interest with rolling ON and check annualized regret across the paths. Download the detailed scenario results. |

### Use a different curve

Use **Rate datasets** in the header to switch between the July article, the September rerun, and saved imports. The spreadsheet keeps the headers visible while you scroll and displays each annual rate to four decimal places. **Import CSV** updates the spreadsheet, chart, and analysis. The imported curve uses the September scenario method with your latest quotes.

Enter a **Dataset name** and any **Observations**, then choose **Save details**. Imports, names, and observations are stored on this computer and are available when you reopen the model.

The CSV header is **Date,ON,1M,3M,6M**. Use UTF-8 and unique dates in ascending order. Use dates such as 2026-09-01 and annual rate decimals such as 0.0366 for 3.66%. Use **Download CSV** for a template. Across calendar-day gaps, the calculation holds the overnight quote until the next observation.

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
