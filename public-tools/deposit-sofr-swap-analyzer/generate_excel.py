"""
Deposit vs SOFR Swap Analyzer
Creates a single-tab Excel workbook to compare:
1. Fixed deposit only
2. Fixed deposit plus forward-starting SOFR swap

Assumptions:
- ACT/360
- Floating leg = daily SOFR path + spread
- Fed shocks entered in bp
- Fed shock impacts SOFR after meeting date
- No PV / MTM
"""

from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.chart import BarChart, Reference

OUTPUT_FILE = "Deposit_SOFR_Swap_Analyzer.xlsx"


def style_cell(cell, fill=None, bold=False, font_color="000000", num_format=None):
    thin = Side(style="thin", color="B7B7B7")
    cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    if fill:
        cell.fill = PatternFill("solid", fgColor=fill)
    if bold:
        cell.font = Font(bold=True, color=font_color)
    if num_format:
        cell.number_format = num_format
    cell.alignment = Alignment(vertical="center")


def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "Deposit vs SOFR Swap"
    ws.sheet_view.showGridLines = False

    blue = "1F4E78"
    yellow = "FFF2CC"
    green = "D9EAD3"
    gray = "E7E6E6"

    ws["A1"] = "Deposit vs SOFR Swap Analyzer"
    ws["A1"].font = Font(bold=True, size=16, color=blue)

    # Transaction inputs
    ws["A3"] = "Transaction Inputs"
    style_cell(ws["A3"], blue, True, "FFFFFF")
    inputs = [
        ("Notional", 100000000, "$#,##0"),
        ("Deposit Start", date(2026, 5, 26), "dd-mmm-yy"),
        ("Deposit End", date(2026, 8, 20), "dd-mmm-yy"),
        ("Deposit Rate", 0.0395, "0.00%"),
        ("Swap Start", date(2026, 6, 17), "dd-mmm-yy"),
        ("Swap End", date(2026, 8, 20), "dd-mmm-yy"),
        ("SOFR Spread bp", 26, "0"),
    ]
    for r, (label, value, fmt) in enumerate(inputs, 4):
        ws[f"A{r}"] = label
        ws[f"B{r}"] = value
        style_cell(ws[f"A{r}"], gray, True)
        style_cell(ws[f"B{r}"], yellow, False, num_format=fmt)

    # Market data
    ws["D3"] = "Market Data"
    style_cell(ws["D3"], blue, True, "FFFFFF")
    ws["D4"] = "Market Date"
    ws["E4"] = date(2026, 5, 26)
    ws["D5"] = "SOFR Today"
    ws["E5"] = 0.0355
    for c in ["D4", "D5"]:
        style_cell(ws[c], gray, True)
    style_cell(ws["E4"], yellow, num_format="dd-mmm-yy")
    style_cell(ws["E5"], yellow, num_format="0.00%")

    # Fed path
    ws["D7"] = "Fed Shock Path"
    style_cell(ws["D7"], blue, True, "FFFFFF")
    ws["D8"] = "Meeting Date"
    ws["E8"] = "Move bp"
    style_cell(ws["D8"], gray, True)
    style_cell(ws["E8"], gray, True)
    meetings = [
        (date(2026, 6, 17), 25),
        (date(2026, 7, 29), 25),
        (None, 0),
        (None, 0),
        (None, 0),
    ]
    for r, (meeting, move) in enumerate(meetings, 9):
        ws[f"D{r}"] = meeting
        ws[f"E{r}"] = move
        style_cell(ws[f"D{r}"], yellow, num_format="dd-mmm-yy")
        style_cell(ws[f"E{r}"], yellow, num_format="0")

    # Output summary
    ws["A16"] = "Output Summary"
    style_cell(ws["A16"], blue, True, "FFFFFF")
    headers = ["Metric", "Deposit Only", "Deposit + Swap", "Difference"]
    for col, header in zip("ABCD", headers):
        ws[f"{col}17"] = header
        style_cell(ws[f"{col}17"], gray, True)

    rows = [
        (18, "Deposit Days", "=B6-B5", "=B6-B5", "=C18-B18", "0"),
        (19, "Deposit Interest", "=B4*B7*B18/360", "=B19", "=C19-B19", "$#,##0"),
        (20, "Floating Received", "=0", "=SUM(K27:K400)", "=C20-B20", "$#,##0"),
        (21, "Fixed Paid", "=0", "=SUM(L27:L400)", "=C21-B21", "$#,##0"),
        (22, "Net Swap", "=0", "=C20-C21", "=C22-B22", "$#,##0"),
        (23, "Total Interest", "=B19", "=C19+C22", "=C23-B23", "$#,##0"),
        (24, "Maturity Value", "=B4+B23", "=B4+C23", "=C24-B24", "$#,##0"),
        (25, "Effective Yield", "=B23/B4*360/B18", "=C23/B4*360/B18", "=C25-B25", "0.00%"),
    ]
    for r, metric, f1, f2, f3, fmt in rows:
        ws[f"A{r}"] = metric
        ws[f"B{r}"] = f1
        ws[f"C{r}"] = f2
        ws[f"D{r}"] = f3
        style_cell(ws[f"A{r}"], gray, True)
        for col in "BCD":
            style_cell(ws[f"{col}{r}"], green, num_format=fmt)

    # Daily accrual engine
    ws["G3"] = "Daily Accrual Engine"
    style_cell(ws["G3"], blue, True, "FFFFFF")
    daily_headers = ["Date", "Day", "SOFR", "SOFR+Spread", "Float Accrual", "Fixed Accrual"]
    for col, header in zip("GHIJKL", daily_headers):
        ws[f"{col}4"] = header
        style_cell(ws[f"{col}4"], gray, True)

    for r in range(5, 401):
        if r == 5:
            ws[f"G{r}"] = "=$B$5"
        else:
            ws[f"G{r}"] = f"=IF(G{r-1}+1<=$B$6,G{r-1}+1,\"\")"
        ws[f"H{r}"] = f"=IF(G{r}=\"\",\"\",1)"
        ws[f"I{r}"] = f"=IF(G{r}=\"\",\"\",$E$5+(IF(AND($D$9<>\"\",G{r}>$D$9),$E$9,0)+IF(AND($D$10<>\"\",G{r}>$D$10),$E$10,0)+IF(AND($D$11<>\"\",G{r}>$D$11),$E$11,0)+IF(AND($D$12<>\"\",G{r}>$D$12),$E$12,0)+IF(AND($D$13<>\"\",G{r}>$D$13),$E$13,0))/10000)"
        ws[f"J{r}"] = f"=IF(G{r}=\"\",\"\",I{r}+$B$10/10000)"
        ws[f"K{r}"] = f"=IF(AND(G{r}>=$B$8,G{r}<$B$9),$B$4*J{r}/360,0)"
        ws[f"L{r}"] = f"=IF(AND(G{r}>=$B$8,G{r}<$B$9),$B$4*$B$7/360,0)"
        for col in "GHIJKL":
            style_cell(ws[f"{col}{r}"])
        ws[f"G{r}"].number_format = "dd-mmm-yy"
        ws[f"I{r}"].number_format = "0.00%"
        ws[f"J{r}"].number_format = "0.00%"
        ws[f"K{r}"].number_format = "$#,##0"
        ws[f"L{r}"].number_format = "$#,##0"

    # Chart
    ws["G18"] = "Scenario"
    ws["H18"] = "Total Interest"
    ws["G19"] = "Deposit Only"
    ws["H19"] = "=B23"
    ws["G20"] = "Deposit + Swap"
    ws["H20"] = "=C23"
    for c in ["G18", "H18", "G19", "H19", "G20", "H20"]:
        style_cell(ws[c])
    ws["H19"].number_format = "$#,##0"
    ws["H20"].number_format = "$#,##0"

    chart = BarChart()
    chart.title = "Total Interest Comparison"
    chart.y_axis.title = "Interest"
    chart.x_axis.title = "Scenario"
    data = Reference(ws, min_col=8, min_row=18, max_row=20)
    cats = Reference(ws, min_col=7, min_row=19, max_row=20)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.height = 7
    chart.width = 12
    ws.add_chart(chart, "G22")

    # Column widths
    widths = {"A": 22, "B": 18, "C": 18, "D": 18, "E": 12, "G": 14, "H": 10, "I": 12, "J": 14, "K": 16, "L": 16}
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    ws.freeze_panes = "A17"
    return wb


if __name__ == "__main__":
    wb = build_workbook()
    wb.save(OUTPUT_FILE)
    print(f"Created {OUTPUT_FILE}")
