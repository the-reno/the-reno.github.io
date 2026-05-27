"""
Deposit vs SOFR Swap Analyzer

Creates a formatted one-tab Excel workbook comparing:
- fixed deposit only
- fixed deposit + forward-starting SOFR swap

Methodology:
- Deposit and fixed swap leg accrue ACT/360.
- SOFR is updated on business days only.
- Weekends and user-entered holidays carry the previous business-day SOFR.
- SOFR is compounded daily.
- Spread over SOFR is added linearly, not compounded.
- No PV, MTM, or hedge-accounting treatment.

Run:
    pip install openpyxl
    python generate_excel.py
"""

from __future__ import annotations

from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.chart import BarChart, Reference

OUTPUT_FILE = "Deposit_SOFR_Swap_Analyzer_Calendar_Compounded.xlsx"


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


def build_workbook() -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "Deposit vs SOFR Swap"
    ws.sheet_view.showGridLines = False

    blue = "1F4E78"
    yellow = "FFF2CC"
    green = "D9EAD3"
    gray = "E7E6E6"

    ws.merge_cells("A1:H1")
    ws["A1"] = "Deposit vs SOFR Swap Analyzer"
    ws["A1"].font = Font(bold=True, size=16, color=blue)

    ws["A3"] = "Transaction Inputs"
    style_cell(ws["A3"], blue, True, "FFFFFF")
    inputs = [
        ("Notional", 100_000_000, "$#,##0"),
        ("Deposit Start", date(2026, 5, 26), "dd-mmm-yy"),
        ("Deposit End", date(2026, 8, 20), "dd-mmm-yy"),
        ("Deposit Rate", 0.0395, "0.00%"),
        ("Swap Start", date(2026, 6, 17), "dd-mmm-yy"),
        ("Swap End", date(2026, 8, 20), "dd-mmm-yy"),
        ("SOFR Spread bp", 26, "0"),
    ]
    for row, (label, value, fmt) in enumerate(inputs, 4):
        ws[f"A{row}"] = label
        ws[f"B{row}"] = value
        style_cell(ws[f"A{row}"], gray, True)
        style_cell(ws[f"B{row}"], yellow, num_format=fmt)

    ws["D3"] = "Market Data"
    style_cell(ws["D3"], blue, True, "FFFFFF")
    market = [
        ("As Of Date", date(2026, 5, 26), "dd-mmm-yy"),
        ("SOFR Today", 0.0355, "0.00%"),
        ("Effective Fed Rate", 0.0433, "0.00%"),
    ]
    for row, (label, value, fmt) in enumerate(market, 4):
        ws[f"D{row}"] = label
        ws[f"E{row}"] = value
        style_cell(ws[f"D{row}"], gray, True)
        style_cell(ws[f"E{row}"], yellow, num_format=fmt)

    ws["D8"] = "Fed Scenario"
    style_cell(ws["D8"], blue, True, "FFFFFF")
    ws["D9"] = "Meeting Date"
    ws["E9"] = "Move bp"
    style_cell(ws["D9"], gray, True)
    style_cell(ws["E9"], gray, True)
    meetings = [
        (date(2026, 6, 17), 25),
        (date(2026, 7, 29), 25),
        (date(2026, 9, 16), 0),
        (date(2026, 10, 28), 0),
        (date(2026, 12, 9), 0),
    ]
    for row, (meeting, move) in enumerate(meetings, 10):
        ws[f"D{row}"] = meeting
        ws[f"E{row}"] = move
        style_cell(ws[f"D{row}"], yellow, num_format="dd-mmm-yy")
        style_cell(ws[f"E{row}"], yellow, num_format="0")

    ws["G3"] = "Holiday Calendar"
    style_cell(ws["G3"], blue, True, "FFFFFF")
    ws["G4"] = "Holiday Date"
    ws["H4"] = "Holiday Name"
    style_cell(ws["G4"], gray, True)
    style_cell(ws["H4"], gray, True)
    holidays = [
        (date(2026, 6, 19), "Juneteenth"),
        (date(2026, 7, 3), "Independence Day Observed"),
        (date(2026, 9, 7), "Labor Day"),
        (date(2026, 11, 26), "Thanksgiving"),
        (date(2026, 12, 25), "Christmas"),
    ]
    for row in range(5, 25):
        idx = row - 5
        if idx < len(holidays):
            ws[f"G{row}"] = holidays[idx][0]
            ws[f"H{row}"] = holidays[idx][1]
        style_cell(ws[f"G{row}"], yellow, num_format="dd-mmm-yy")
        style_cell(ws[f"H{row}"], yellow)

    ws["A17"] = "Output Summary"
    style_cell(ws["A17"], blue, True, "FFFFFF")
    for col, header in zip("ABCD", ["Metric", "Deposit Only", "Deposit + Swap", "Difference"]):
        ws[f"{col}18"] = header
        style_cell(ws[f"{col}18"], gray, True)

    swap_days = 'COUNTIFS($J$30:$J$430,">="&$B$8,$J$30:$J$430,"<"&$B$9)'
    final_sofr_factor = 'LOOKUP(2,1/($O$30:$O$430<>""),$O$30:$O$430)'
    spread_factor = f'($B$10/10000)*({swap_days}/360)'
    float_coupon_factor = f'(({final_sofr_factor})-1)+{spread_factor}'

    rows = [
        (19, "Deposit Days", "=B6-B5", "=B6-B5", "=C19-B19", "0"),
        (20, "Deposit Interest", "=B4*B7*B19/360", "=B20", "=C20-B20", "$#,##0"),
        (21, "Floating Received", "=0", f"=B4*({float_coupon_factor})", "=C21-B21", "$#,##0"),
        (22, "Fixed Paid", "=0", f"=B4*B7*({swap_days})/360", "=C22-B22", "$#,##0"),
        (23, "Net Swap", "=0", "=C21-C22", "=C23-B23", "$#,##0"),
        (24, "Total Interest", "=B20", "=C20+C23", "=C24-B24", "$#,##0"),
        (25, "Maturity Value", "=B4+B24", "=B4+C24", "=C25-B25", "$#,##0"),
        (26, "Effective Yield", "=B24/B4*360/B19", "=C24/B4*360/B19", "=C26-B26", "0.00%"),
        (27, "Float Coupon Rate", "=0", f"=({float_coupon_factor})*360/({swap_days})", "=C27-B27", "0.00%"),
    ]
    for row, metric, f1, f2, f3, fmt in rows:
        ws[f"A{row}"] = metric
        ws[f"B{row}"] = f1
        ws[f"C{row}"] = f2
        ws[f"D{row}"] = f3
        style_cell(ws[f"A{row}"], gray, True)
        for col in "BCD":
            style_cell(ws[f"{col}{row}"], green, num_format=fmt)

    ws["F17"] = "Scenario"
    ws["G17"] = "Total Interest"
    ws["F18"] = "Deposit Only"
    ws["G18"] = "=B24"
    ws["F19"] = "Deposit + Swap"
    ws["G19"] = "=C24"
    for cell in ["F17", "G17", "F18", "G18", "F19", "G19"]:
        style_cell(ws[cell], gray if cell in ["F17", "G17"] else None, bold=cell in ["F17", "G17"], num_format="$#,##0" if cell in ["G18", "G19"] else None)

    chart = BarChart()
    chart.title = "Total Interest Comparison"
    chart.y_axis.title = "Interest"
    chart.x_axis.title = "Scenario"
    data = Reference(ws, min_col=7, min_row=17, max_row=19)
    cats = Reference(ws, min_col=6, min_row=18, max_row=19)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.height = 7
    chart.width = 12
    ws.add_chart(chart, "F21")

    ws["J28"] = "SOFR Daily Compounding Engine"
    style_cell(ws["J28"], blue, True, "FFFFFF")
    engine_headers = [
        "Date", "Bus Day", "Raw SOFR", "Carried SOFR", "SOFR Factor", "SOFR Cum Factor",
        "SOFR Accrued", "Spread Accrued", "Float Accrued", "Fixed Accrued"
    ]
    for col_idx, header in enumerate(engine_headers, 10):
        cell = ws.cell(29, col_idx)
        cell.value = header
        style_cell(cell, gray, True)

    for row in range(30, 431):
        if row == 30:
            ws[f"J{row}"] = "=$B$8"
        else:
            ws[f"J{row}"] = f"=IFERROR(IF(AND(J{row-1}<>\"\",J{row-1}+1<$B$9),J{row-1}+1,\"\"),\"\")"
        ws[f"K{row}"] = f"=IF(J{row}=\"\",\"\",IF(AND(WEEKDAY(J{row},2)<=5,COUNTIF($G$5:$G$24,J{row})=0),\"Y\",\"N\"))"
        ws[f"L{row}"] = f"=IF(J{row}=\"\",\"\",IF(K{row}=\"Y\",$E$5+SUMIFS($E$10:$E$14,$D$10:$D$14,\"<\"&J{row})/10000,\"\"))"
        if row == 30:
            ws[f"M{row}"] = f"=IF(J{row}=\"\",\"\",IF(L{row}<>\"\",L{row},$E$5))"
        else:
            ws[f"M{row}"] = f"=IF(J{row}=\"\",\"\",IF(L{row}<>\"\",L{row},M{row-1}))"
        ws[f"N{row}"] = f"=IF(J{row}=\"\",\"\",1+M{row}/360)"
        if row == 30:
            ws[f"O{row}"] = f"=IF(J{row}=\"\",\"\",N{row})"
        else:
            ws[f"O{row}"] = f"=IF(J{row}=\"\",\"\",O{row-1}*N{row})"
        ws[f"P{row}"] = f"=IF(J{row}=\"\",\"\",$B$4*(O{row}-1))"
        ws[f"Q{row}"] = f"=IF(J{row}=\"\",\"\",$B$4*($B$10/10000)*COUNTIFS($J$30:J{row},\">=\"&$B$8,$J$30:J{row},\"<\"&$B$9)/360)"
        ws[f"R{row}"] = f"=IF(J{row}=\"\",\"\",P{row}+Q{row})"
        ws[f"S{row}"] = f"=IF(J{row}=\"\",\"\",$B$4*$B$7*COUNTIFS($J$30:J{row},\">=\"&$B$8,$J$30:J{row},\"<\"&$B$9)/360)"

        for col_idx in range(10, 20):
            style_cell(ws.cell(row, col_idx))
        ws[f"J{row}"].number_format = "dd-mmm-yy"
        ws[f"L{row}"].number_format = "0.00%"
        ws[f"M{row}"].number_format = "0.00%"
        ws[f"N{row}"].number_format = "0.000000000"
        ws[f"O{row}"].number_format = "0.000000000"
        for col in ["P", "Q", "R", "S"]:
            ws[f"{col}{row}"].number_format = "$#,##0"

    ws["A31"] = "Methodology"
    style_cell(ws["A31"], blue, True, "FFFFFF")
    ws.merge_cells("A32:H35")
    ws["A32"] = (
        "SOFR is updated only on business days; weekends and user-entered holidays carry the prior SOFR fixing. "
        "The SOFR component is compounded daily. The spread is added linearly as spread x days / 360, not compounded. "
        "Accrued SOFR, spread, total floating, and fixed swap amounts are shown in the engine table for auditability."
    )
    ws["A32"].alignment = Alignment(wrap_text=True, vertical="top")
    ws["A32"].font = Font(color="666666")

    widths = {
        "A": 22, "B": 18, "C": 18, "D": 18, "E": 14,
        "F": 18, "G": 18, "H": 22, "J": 14, "K": 10,
        "L": 14, "M": 14, "N": 14, "O": 18, "P": 16, "Q": 16, "R": 16, "S": 16,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    ws.freeze_panes = "A18"
    return wb


if __name__ == "__main__":
    workbook = build_workbook()
    workbook.save(OUTPUT_FILE)
    print(f"Created {OUTPUT_FILE}")
