from __future__ import annotations
from datetime import datetime
from artifact_tool import Workbook, SpreadsheetFile

OUTPUT = '/mnt/data/Rolling_Liquidity_Rate_Scenario_Model_Generic.xlsx'

wb = Workbook.create()
ws = wb.worksheets.add('Dashboard')

header_fmt = {"fill":"#1F4E78","font":{"bold":True,"color":"#FFFFFF"},"horizontal_alignment":"center","vertical_alignment":"center"}
sub_fmt = {"fill":"#D9EAD3","font":{"bold":True},"horizontal_alignment":"center"}
input_fmt = {"fill":"#FFF2CC"}

ws.get_range('A1:N1').merge()
ws.get_range('A1').values = [['Rolling Liquidity Portfolio Rate Scenario Model']]
ws.get_range('A1').format = {"font":{"bold":True,"size":16,"color":"#1F4E78"},"horizontal_alignment":"left"}
ws.get_range('A2:N2').merge()
ws.get_range('A2').values = [['Generic model. User inputs Fed scenarios and rollover curve assumptions through Dec-2026.']]
ws.get_range('A2').format = {"font":{"italic":True,"color":"#666666"}}

ws.get_range('A4:B4').merge(); ws.get_range('A4').values=[['Environment']]; ws.get_range('A4').format=header_fmt
env = [
    ['As Of Date', datetime(2026,5,26)],
    ['Horizon End', datetime(2026,12,31)],
    ['SOFR Today', 0.0355],
    ['SOFR Spread', 0.0026],
    ['Rollover Pass-through', 0.80],
]
ws.get_range('A5:B9').values = env
ws.get_range('A5:A9').format=sub_fmt; ws.get_range('B5:B9').format=input_fmt
ws.get_range('B5:B6').format.number_format='dd-mmm-yy'
ws.get_range('B7:B8').format.number_format='0.00%'
ws.get_range('B9').format.number_format='0%'

ws.get_range('D4:E4').merge(); ws.get_range('D4').values=[['Portfolio']]; ws.get_range('D4').format=header_fmt
portfolio = [
    ['Total Portfolio', 10000000000],
    ['1M Weight', 1/3],
    ['2M Weight', 1/3],
    ['3M Weight', 1/3],
    ['Current Fixed Rate', 0.0395],
    ['Proposed Floating %', 0.25],
]
ws.get_range('D5:E10').values = portfolio
ws.get_range('D5:D10').format=sub_fmt; ws.get_range('E5:E10').format=input_fmt
ws.get_range('E5').format.number_format='$#,##0'
ws.get_range('E6:E8').format.number_format='0%'
ws.get_range('E9:E10').format.number_format='0.00%'

ws.get_range('G4:I4').merge(); ws.get_range('G4').values=[['Fed Scenario Inputs']]; ws.get_range('G4').format=header_fmt
ws.get_range('G5:I5').values=[['Meeting Date','Base Move bp','Scenario Move bp']]
ws.get_range('G5:I5').format=sub_fmt
fed_dates=[datetime(2026,6,17), datetime(2026,7,29), datetime(2026,9,16), datetime(2026,10,28), datetime(2026,12,9)]
ws.get_range('G6:I10').values=[[d,0,0] for d in fed_dates]
ws.get_range('G6:G10').format.number_format='dd-mmm-yy'
ws.get_range('H6:I10').format=input_fmt

ws.get_range('K4:M4').merge(); ws.get_range('K4').values=[['Rollover Rate Inputs']]; ws.get_range('K4').format=header_fmt
ws.get_range('K5:M5').values=[['Tenor','Base Rate','Scenario Adj bp']]
ws.get_range('K5:M5').format=sub_fmt
ws.get_range('K6:M8').values=[['1M',0.0395,0],['2M',0.0395,0],['3M',0.0395,0]]
ws.get_range('L6:L8').format.number_format='0.00%'
ws.get_range('L6:M8').format=input_fmt

ws.get_range('A12:F12').merge(); ws.get_range('A12').values=[['Executive Summary']]; ws.get_range('A12').format=header_fmt
ws.get_range('A13:F13').values=[['Metric','100% Fixed - Base','100% Fixed - Scenario','Proposed Mix','50/50 Mix','100% Floating']]
ws.get_range('A13:F13').format=sub_fmt
ws.get_range('A14:A18').values=[['Income to Horizon'],['Yield to Horizon'],['Increment vs 100% Fixed Scenario'],['Floating Allocation'],['Fixed Allocation']]
ws.get_range('B14:F18').formulas=[
    ['=B46','=C46','=D46','=E46','=F46'],
    ['=B47','=C47','=D47','=E47','=F47'],
    ['=B46-C46','=C46-C46','=D46-C46','=E46-C46','=F46-C46'],
    ['=0','=0','=$E$10','=0.5','=1'],
    ['=1-B17','=1-C17','=1-D17','=1-E17','=1-F17'],
]
ws.get_range('B14:F14').format.number_format='$#,##0'
ws.get_range('B15:F15').format.number_format='0.00%'
ws.get_range('B16:F16').format.number_format='$#,##0'
ws.get_range('B17:F18').format.number_format='0%'

ws.get_range('A21:H21').merge(); ws.get_range('A21').values=[['Rolling Investment Schedule']]; ws.get_range('A21').format=header_fmt
ws.get_range('A22:H22').values=[['Bucket','Tenor Months','Start Date','Maturity/Roll Date','Period Days','Weight','Base Rollover Rate','Scenario Rollover Rate']]
ws.get_range('A22:H22').format=sub_fmt

rows=[]
start=datetime(2026,5,26)
horizon=datetime(2026,12,31)
def add_months(dt, months):
    m=dt.month+months; y=dt.year+(m-1)//12; m=(m-1)%12+1
    day=min(dt.day, [31,29 if y%4==0 else 28,31,30,31,30,31,31,30,31,30,31][m-1])
    return datetime(y,m,day)
for tenor, months in [('1M',1),('2M',2),('3M',3)]:
    s=start
    while s<horizon:
        e=min(add_months(s,months),horizon)
        rows.append([tenor,months,s,e,None,None,None,None])
        s=e
last=22+len(rows)
ws.get_range(f'A23:H{last}').values=rows
for r in range(23,last+1):
    ws.get_range(f'E{r}').formulas=[[f'=D{r}-C{r}']]
    ws.get_range(f'F{r}').formulas=[[f'=IF(A{r}="1M",$E$6,IF(A{r}="2M",$E$7,$E$8))']]
    ws.get_range(f'G{r}').formulas=[[f'=IF(A{r}="1M",$L$6,IF(A{r}="2M",$L$7,$L$8))']]
    ws.get_range(f'H{r}').formulas=[[f'=G{r}+((SUMIFS($I$6:$I$10,$G$6:$G$10,">="&C{r},$G$6:$G$10,"<"&D{r})/10000)*$B$9)+IF(A{r}="1M",$M$6,IF(A{r}="2M",$M$7,$M$8))/10000']]
ws.get_range(f'C23:D{last}').format.number_format='dd-mmm-yy'
ws.get_range(f'E23:F{last}').format.number_format='0'
ws.get_range(f'G23:H{last}').format.number_format='0.00%'

ws.get_range('A42:F42').merge(); ws.get_range('A42').values=[['Scenario Income Calculations']]; ws.get_range('A42').format=header_fmt
ws.get_range('A43:F43').values=[['Metric','100% Fixed Base','100% Fixed Scenario','Proposed Mix','50/50 Mix','100% Floating']]
ws.get_range('A43:F43').format=sub_fmt
ws.get_range('A44:A47').values=[['Fixed Income'],['Floating Income'],['Total Income'],['Yield to Horizon']]
ws.get_range('B44:F47').formulas=[
    [f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},$G$23:$G${last}/360)*$E$5', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},$H$23:$H${last}/360)*$E$5', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},$H$23:$H${last}/360)*$E$5*(1-$E$10)', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},$H$23:$H${last}/360)*$E$5*0.5', '=0'],
    ['=0','=0', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},($H$23:$H${last}+$B$8)/360)*$E$5*$E$10', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},($H$23:$H${last}+$B$8)/360)*$E$5*0.5', f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},($H$23:$H${last}+$B$8)/360)*$E$5'],
    ['=B44+B45','=C44+C45','=D44+D45','=E44+E45','=F44+F45'],
    ['=B46/$E$5*360/($B$6-$B$5)','=C46/$E$5*360/($B$6-$B$5)','=D46/$E$5*360/($B$6-$B$5)','=E46/$E$5*360/($B$6-$B$5)','=F46/$E$5*360/($B$6-$B$5)']
]
ws.get_range('B44:F46').format.number_format='$#,##0'
ws.get_range('B47:F47').format.number_format='0.00%'

ws.get_range('H42:M42').merge(); ws.get_range('H42').values=[['Floating Allocation Sensitivity — Scenario Path']]; ws.get_range('H42').format=header_fmt
ws.get_range('H43:M43').values=[['Floating %','0%','25%','50%','75%','100%']]
ws.get_range('H44:H46').values=[['Total Income'],['Increment vs 0%'],['Yield']]
for idx,a in enumerate([0,0.25,0.5,0.75,1],start=9):
    col=chr(64+idx)
    ws.get_range(f'{col}43').values=[[a]]
    ws.get_range(f'{col}44').formulas=[[f'=SUMPRODUCT($F$23:$F${last},$E$23:$E${last},$H$23:$H${last}/360)*$E$5*(1-{col}$43)+SUMPRODUCT($F$23:$F${last},$E$23:$E${last},($H$23:$H${last}+$B$8)/360)*$E$5*{col}$43']]
    ws.get_range(f'{col}45').formulas=[[f'={col}44-$I$44']]
    ws.get_range(f'{col}46').formulas=[[f'={col}44/$E$5*360/($B$6-$B$5)']]
ws.get_range('I43:M43').format.number_format='0%'
ws.get_range('I44:M45').format.number_format='$#,##0'
ws.get_range('I46:M46').format.number_format='0.00%'

ws.get_range('A51:N51').merge(); ws.get_range('A51').values=[['Notes']]; ws.get_range('A51').format=header_fmt
ws.get_range('A52:N55').merge()
ws.get_range('A52').values=[['Model purpose: quantify reinvestment risk through Dec-2026 for a rolling 1M/2M/3M liquidity portfolio. User inputs Fed moves, rollover rates, and floating allocation. No client name. Simplified cash income model; not a valuation or hedge-accounting model.']]
ws.get_range('A52').format={"wrap_text":True,"font":{"color":"#666666"}}

chart1 = ws.charts.add('ColumnClustered', {"title":"Income by Strategy","has_legend":False})
chart1.set_data(ws.get_range('A13:F14'))
chart1.set_position('H12','N30')
chart2 = ws.charts.add('line', ws.get_range('I43:M44'))
chart2.title_text = 'Income by Floating Allocation'
chart2.set_position('H31','N41')

for col in ['A','D','G','K']:
    ws.get_range(f'{col}:{col}').format.column_width=18
for col in ['B','E','H','I','L','M']:
    ws.get_range(f'{col}:{col}').format.column_width=14
ws.get_range('A1:N55').format.font = {"name":"Aptos","size":10}
ws.freeze_panes.freeze_rows(13)

print(wb.inspect({"kind":"table","range":"Dashboard!A12:F18","include":"values,formulas","table_max_rows":10,"table_max_cols":8}).ndjson)
print(wb.inspect({"kind":"match","search_term":"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A","options":{"use_regex":True,"max_results":100},"summary":"formula errors"}).ndjson)
SpreadsheetFile.export_xlsx(wb).save(OUTPUT)
print(OUTPUT)
