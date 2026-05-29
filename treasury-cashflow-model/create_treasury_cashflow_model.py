from datetime import date, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


OUTPUT_FILE = "treasury_cashflow_model.xlsx"


def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "Cash Flow"

    navy = PatternFill("solid", fgColor="17365D")
    light_blue = PatternFill("solid", fgColor="D9EAF7")
    white_font = Font(color="FFFFFF", bold=True)
    bold_font = Font(bold=True)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Global inputs
    ws["B3"] = "Start Date"
    ws["C3"] = date(2026, 5, 29)
    ws["B4"] = "End Date"
    ws["C4"] = date(2031, 12, 31)
    ws["B3"].font = bold_font
    ws["B4"].font = bold_font

    # Instrument inputs on left side
    input_rows = {
        "Name": 7,
        "Identifier / CUSIP": 8,
        "Maturity Date": 9,
        "Outstanding": 10,
        "Coupon": 11,
        "Frequency": 12,
    }

    for label, row in input_rows.items():
        ws.cell(row, 2, label)
        ws.cell(row, 2).font = bold_font
        ws.cell(row, 2).fill = light_blue

    instruments = [
        ["Bond A", "ID-A", date(2026, 11, 19), 500_000_000, 0.0350, 2],
        ["Bond B", "ID-B", date(2027, 9, 15), 475_000_000, 0.0400, 2],
        ["Bond C", "ID-C", date(2034, 5, 14), 300_000_000, 0.0550, 2],
    ]

    for col_offset, inst in enumerate(instruments, start=3):
        for idx, value in enumerate(inst, start=7):
            ws.cell(idx, col_offset, value)

    # User-entered payment dates table.
    # User enters coupon dates for each bond in rows under each bond column.
    ws["B15"] = "Payment Dates"
    ws["B15"].font = bold_font

    payment_header_row = 16
    for i, inst in enumerate(instruments, start=3):
        ws.cell(payment_header_row, i, inst[0])
        ws.cell(payment_header_row, i).font = white_font
        ws.cell(payment_header_row, i).fill = navy

    sample_payment_dates = {
        3: [date(2026, 5, 19), date(2026, 11, 19)],
        4: [date(2026, 9, 15), date(2027, 3, 15), date(2027, 9, 15)],
        5: [date(2026, 11, 14), date(2027, 5, 14), date(2027, 11, 14), date(2028, 5, 14)],
    }
    for col, dates in sample_payment_dates.items():
        for r_offset, d in enumerate(dates, start=17):
            ws.cell(r_offset, col, d)

    # Holiday calendar
    ws["B30"] = "Holiday Dates"
    ws["B30"].font = bold_font
    holiday_col = 3
    ws.cell(31, holiday_col, "Holiday Date")
    ws.cell(31, holiday_col).font = white_font
    ws.cell(31, holiday_col).fill = navy

    sample_holidays = [
        date(2026, 1, 1),
        date(2026, 1, 19),
        date(2026, 2, 16),
        date(2026, 5, 25),
        date(2026, 7, 3),
        date(2026, 9, 7),
        date(2026, 11, 26),
        date(2026, 12, 25),
    ]
    for r, h in enumerate(sample_holidays, start=32):
        ws.cell(r, holiday_col, h)

    # Cash flow table starts at row 5, column H
    cf_start_row = 5
    cf_start_col = 8  # H

    headers = ["Date", "Day Type"] + [x[0] for x in instruments] + ["Total"]
    for c_offset, h in enumerate(headers):
        cell = ws.cell(cf_start_row, cf_start_col + c_offset, h)
        cell.font = white_font
        cell.fill = navy
        cell.alignment = Alignment(horizontal="center")

    start_date = ws["C3"].value
    end_date = ws["C4"].value
    current = start_date
    row = cf_start_row + 1

    while current <= end_date:
        ws.cell(row, cf_start_col, current)

        # Day Type uses shared holiday calendar.
        ws.cell(
            row,
            cf_start_col + 1,
            f'=IF(COUNTIF($C$32:$C$200,{get_column_letter(cf_start_col)}{row})>0,"HOL",IF(WEEKDAY({get_column_letter(cf_start_col)}{row},2)>5,"WE","BD"))'
        )

        # Each instrument cashflow formula:
        # - If the row date exists in the user-entered payment date list for that bond, pay coupon.
        # - If the row date equals the maturity date, add principal.
        # - Otherwise zero.
        # This keeps the model simple and lets the user control the actual payment schedule.
        for i in range(len(instruments)):
            instrument_cf_col = cf_start_col + 2 + i
            input_col = get_column_letter(3 + i)
            date_list_col = get_column_letter(3 + i)
            row_date = f"{get_column_letter(cf_start_col)}{row}"
            payment_date_range = f"${date_list_col}$17:${date_list_col}$120"
            maturity_date = f"${input_col}$9"
            outstanding = f"${input_col}$10"
            coupon = f"${input_col}$11"
            frequency = f"${input_col}$12"

            formula = (
                f'=IF(COUNTIF({payment_date_range},{row_date})>0,'
                f'{outstanding}*{coupon}/{frequency},0)'
                f'+IF({row_date}={maturity_date},{outstanding},0)'
            )
            ws.cell(row, instrument_cf_col, formula)

        total_col = cf_start_col + 2 + len(instruments)
        first_inst_col = get_column_letter(cf_start_col + 2)
        last_inst_col = get_column_letter(total_col - 1)
        ws.cell(row, total_col, f"=SUM({first_inst_col}{row}:{last_inst_col}{row})")

        current += timedelta(days=1)
        row += 1

    # Formatting
    for col in range(1, total_col + 1):
        ws.column_dimensions[get_column_letter(col)].width = 16
    ws.column_dimensions["B"].width = 22

    for r in range(1, row):
        for c in range(1, total_col + 1):
            ws.cell(r, c).border = border

    ws["C3"].number_format = "dd-mmm-yyyy"
    ws["C4"].number_format = "dd-mmm-yyyy"

    for col in range(3, 3 + len(instruments)):
        ws.cell(9, col).number_format = "dd-mmm-yyyy"
        ws.cell(10, col).number_format = "#,##0"
        ws.cell(11, col).number_format = "0.00%"
        for r in range(17, 121):
            ws.cell(r, col).number_format = "dd-mmm-yyyy"

    for r in range(32, 201):
        ws.cell(r, holiday_col).number_format = "dd-mmm-yyyy"

    for r in range(cf_start_row + 1, row):
        ws.cell(r, cf_start_col).number_format = "dd-mmm-yyyy"
        for c in range(cf_start_col + 2, total_col + 1):
            ws.cell(r, c).number_format = '#,##0.00;[Red](#,##0.00);-'

    ws.freeze_panes = "H6"

    # Excel table only around cashflow grid
    last_col = get_column_letter(total_col)
    first_col = get_column_letter(cf_start_col)
    tab = Table(displayName="CashFlowTable", ref=f"{first_col}{cf_start_row}:{last_col}{row-1}")
    style = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False, showRowStripes=True, showColumnStripes=False)
    tab.tableStyleInfo = style
    ws.add_table(tab)

    wb.save(OUTPUT_FILE)


if __name__ == "__main__":
    build_workbook()
    print(f"Created: {OUTPUT_FILE}")
