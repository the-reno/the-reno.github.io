"""NII FRONTIER LITE - generic-inputs standalone spreadsheet (v3.0).
Single tab, minimal fields, every input cell carries a hover note describing its impact.
Flexible data: up to 24 FOMC dates and 12 bonds - leave rows blank to ignore.
Zero macros (.xlsx). Optional VBA helpers ship separately as nii_tools.bas.
Run: python3 build_lite_model_xlsx.py
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.comments import Comment
from openpyxl.chart import LineChart, BarChart, Reference
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.properties import CalcProperties
from openpyxl.utils import get_column_letter as gcl
from datetime import date

VERSION="v3.0"
A="Arial"
BLUE=Font(name=A,color="0000FF"); BLK=Font(name=A); SUB=Font(name=A,bold=True)
HDR=Font(name=A,bold=True,color="FFFFFF"); HF=PatternFill("solid",start_color="1F3864")
CALC=PatternFill("solid",start_color="F2F2F2"); OUT=Font(name=A,bold=True,color="1F3864")
WARN=PatternFill("solid",start_color="FFF2CC")
NUM='#,##0.0;(#,##0.0)'; N2='#,##0.00;(#,##0.00)'
SCEN=["Flat","Gradual cuts","Faster cuts","Delayed cuts","Higher for longer","Hike"]
FOMC=[date(2026,6,17),date(2026,7,29),date(2026,9,16),date(2026,10,28),date(2026,12,9),
date(2027,1,27),date(2027,3,17),date(2027,4,28),date(2027,6,16),date(2027,7,28),
date(2027,9,15),date(2027,10,27),date(2027,12,8),date(2028,1,26),date(2028,3,15),
date(2028,4,26),date(2028,6,14)]
def moves():
    n=24; z=lambda mv:[mv.get(i,0) if i<len(FOMC) else None for i in range(n)]
    return [z({}),z({i:-25 for i in range(0,12,2)}),z({i:-25 for i in range(6)}),
            z({i:-25 for i in range(4,10)}),z({8:-25,9:-25}),z({0:25,1:25})]
BONDS=[("3.50% '27",476.4,3.50,date(2027,9,15)),("6.60% '28",109.9,6.60,date(2028,7,15)),
("3.90% '29",900.0,3.90,date(2029,11,19)),("4.65% '31",400.0,4.65,date(2031,3,12)),
("6.05% '34",500.0,6.05,date(2034,5,14)),("6.35% '40",500.0,6.35,date(2040,3,15)),
("5.10% '44",300.0,5.10,date(2044,5,15))]

wb=Workbook(); ws=wb.active; ws.title="MODEL"
def put(r,c,v,font=BLK,fill=None,nf=None,align=None,note=None):
    x=ws.cell(row=r,column=c,value=v); x.font=font
    if fill:x.fill=fill
    if nf:x.number_format=nf
    if align:x.alignment=Alignment(horizontal=align)
    if note:x.comment=Comment("IMPACT: "+note,"RONIN",height=110,width=260)
    return x

put(1,1,f"NII FRONTIER LITE {VERSION}",Font(name=A,bold=True,size=14,color="1F3864"))
put(2,1,"Single tab, live formulas, no macros. Blue = inputs (hover a cell for what it drives). "
        "Leave FOMC or bond rows blank to exclude them. Monthly approximation, ACT/360, "
        "bonds 30/360. Illustrative only.",Font(name=A,size=9,color="595959"))

# ---------------- INPUTS
put(4,1,"INPUTS",SUB)
ins=[("Start month (1st)",date(2026,7,1),"YYYY-MM-DD",
      "Anchors the 24-month grid. Every date-driven calc (rate steps, bond drop-offs, rolls) shifts with it."),
("Initial SOFR (%)",3.80,N2,
      "Day-0 rate. Sets the level of all scenario paths and the floating legs; shifts all NII roughly in parallel."),
("Total cash ($mm)",500.0,NUM,
      "Scales deposit income and the IRS notional (which is % of this). Bigger cash = bigger rate sensitivity."),
("Deposit beta",1.0,N2,
      "Pass-through of SOFR moves to deposit rates. 1.0 = full; lower beta dampens scenario differences on the cash side."),
("Min ON balance ($mm)",100.0,NUM,
      "Liquidity floor held overnight. Raising it shortens the book: faster repricing, more exposure to cuts."),
("Swap direction (RCV/PAY)","RCV",None,
      "RCV fixed gains when rates fall (hedges this asset-sensitive book). PAY does the opposite."),
("Swap fixed rate (%)",3.15,N2,
      "The traded mid. Its gap to the scenario-fair rate (output) is the carry cost/benefit of hedging - it shapes everything."),
("Swap float spread (bps)",0.0,NUM,
      "Added to SOFR on the floating leg. Positive spread makes receive-fixed less attractive bp-for-bp."),
("IRS notional (% of cash)",75.0,NUM,
      "The hedge ratio. 0% = full scenario dispersion; ~90-100% pins NII near the fixed rate. See the cone chart."),
]
for i,(k,v,nf,nt) in enumerate(ins,5):
    put(i,1,k); put(i,2,v,BLUE,nf=nf,note=nt)
R_START,R_SOFR0,R_CASH,R_BETA,R_MIN,R_DIR,R_FIX,R_SPR,R_NOT=range(5,14)
dv=DataValidation(type="list",formula1='"RCV,PAY"'); ws.add_data_validation(dv); dv.add(f"B{R_DIR}")

put(15,1,"ALLOCATION ($mm) / SPREAD (bps)",SUB)
put(16,1,"Bucket",SUB);put(16,2,"$mm",SUB);put(16,3,"Spread",SUB)
anotes=["Overnight balance: reprices daily, first hurt by cuts, first helped by hikes.",
"1M rolling: ~1 month repricing lag.","2M rolling: ~2 month lag, smoother income.",
"3M rolling: slowest repricing - best income protection in cut scenarios."]
snote="Margin over SOFR earned in this bucket. Raising a spread pulls allocation value toward that tenor in every scenario."
for i,((b,al,sp),an) in enumerate(zip([("ON",100,0),("1M",0,10),("2M",0,15),("3M",400,20)],anotes),17):
    put(i,1,b); put(i,2,al,BLUE,nf=NUM,note=an); put(i,3,sp,BLUE,nf=NUM,note=snote)
c=put(21,1,"Check"); c=put(21,2,'=IF(SUM(B17:B20)<>B7,"SUM<>CASH",IF(B17<B9,"ON<MIN","OK"))',SUB); c.fill=WARN

put(23,1,"FIXED-RATE DEBT (blank rows ignored)",SUB)
put(24,1,"Issue",SUB);put(24,2,"$mm",SUB);put(24,3,"Cpn %",SUB);put(24,4,"Maturity",SUB)
bnote=("Constant cost across scenarios: sets the NII level, not its dispersion. "
       "Drops out of the grid the month after maturity.")
B0,B1=25,32
for i in range(8):
    r=25+i
    if i<len(BONDS):
        n,nm,cp,mt=BONDS[i]
        put(r,1,n); put(r,2,nm,BLUE,nf=NUM,note=bnote); put(r,3,cp,BLUE,nf=N2); put(r,4,mt,BLUE,nf="YYYY-MM-DD")
    else:
        put(r,1,None,BLUE); put(r,2,None,BLUE,nf=NUM,note=bnote); put(r,3,None,BLUE,nf=N2); put(r,4,None,BLUE,nf="YYYY-MM-DD")

# ---------------- FOMC x SCENARIO (F4..N29) - 24 flexible rows + scale row
put(4,6,"FED SCENARIOS — bps per decision (blank dates ignored; edit names, dates, moves)",SUB)
put(5,6,"Decision",SUB); put(5,7,"Effective",SUB)
nmnote="Scenario name - flows through every output header and the charts."
for j,s in enumerate(SCEN): put(5,8+j,s,BLUE,align="center",note=nmnote)
MV=moves(); FR0,FR1=6,29
dnote="FOMC decision date. The move becomes effective the next day. Blank = row ignored."
mvnote="Move in bps at this meeting under this scenario. Cumulative sum builds the rate path."
for i in range(24):
    r=6+i
    put(r,6,FOMC[i] if i<len(FOMC) else None,BLUE,nf="YYYY-MM-DD",note=dnote if i==0 else None)
    put(r,7,f'=IF(F{r}="","",F{r}+1)',fill=CALC,nf="YYYY-MM-DD")
    for j in range(6):
        v=MV[j][i]
        put(r,8+j,v,BLUE,nf='0;-0;"-"',align="center",
            note=mvnote if (i==0 and j==0) else None)
SC=31
put(SC,6,"Scale ×",SUB)
for j in range(6):
    put(SC,8+j,1.0,BLUE,nf="0.00",align="center",
        note="Multiplies every move in this column: 2.0 doubles the path (e.g. -300bp faster cuts), 0.5 halves it. "
             "Cheap way to simulate many scenarios from one shape.")
WR=SC+1
put(WR,6,"Weight",SUB)
for j in range(6):
    put(WR,8+j,1/6,BLUE,nf="0.0%",align="center",
        note="Probability of this scenario. Drives Expected NII and volatility; worst/best ignore weights. Should sum to 100%.")

# ---------------- CALC GRID rows 46-69 + units 71-72
G0=46; NM=24
put(G0-2,1,"CALCULATION GRID (do not edit)",SUB)
hdrs=["Month","Days","Bond cost"]
for s in SCEN: hdrs+=["SOFR","ON%","1M%","2M%","3M%","Dep","Swap/$"]
for c,h in enumerate(hdrs,1): put(G0-1,c,h,HDR,HF)
for j in range(6): ws.cell(row=G0-1,column=4+j*7).value=f'=H$5&"|SOFR"' if False else None
for j in range(6):  # dynamic headers from scenario names
    put(G0-1,4+j*7,f"={gcl(8+j)}5",HDR,HF)
for m in range(NM):
    r=G0+m
    put(r,1,f"=EDATE($B${R_START},{m})",fill=CALC,nf="MMM-YY")
    put(r,2,f"=EDATE(A{r},1)-A{r}",fill=CALC)
    put(r,3,f"=SUMPRODUCT(($B${B0}:$B${B1}>0)*($D${B0}:$D${B1}>A{r})*$B${B0}:$B${B1}*$C${B0}:$C${B1})/100/12",fill=CALC,nf=N2)
    for j in range(6):
        b=4+j*7; L=lambda k:gcl(b+k); mc=gcl(8+j)
        put(r,b,f'=$B${R_SOFR0}+{mc}${SC}*SUMIFS({mc}${FR0}:{mc}${FR1},$G${FR0}:$G${FR1},"<="&A{r},$F${FR0}:$F${FR1},"<>")/100',
            fill=CALC,nf=N2)
        adj=lambda src:f"$B${R_SOFR0}+$B${R_BETA}*({src}-$B${R_SOFR0})"
        put(r,b+1,f"={adj(L(0)+str(r))}+$C$17/100",fill=CALC,nf=N2)
        put(r,b+2,f"={adj(L(0)+str(r))}+$C$18/100",fill=CALC,nf=N2)
        col=f"{L(0)}${G0}:{L(0)}${G0+NM-1}"
        put(r,b+3,f"={adj(f'AVERAGE(INDEX({col},MAX(1,{m})):INDEX({col},{m+1}))')}+$C$19/100",fill=CALC,nf=N2)
        put(r,b+4,f"={adj(f'AVERAGE(INDEX({col},MAX(1,{m-1})):INDEX({col},{m+1}))')}+$C$20/100",fill=CALC,nf=N2)
        put(r,b+5,f"=($B$17*{L(1)}{r}+$B$18*{L(2)}{r}+$B$19*{L(3)}{r}+$B$20*{L(4)}{r})/100*B{r}/360",fill=CALC,nf="0.0000")
        put(r,b+6,f'=IF($B${R_DIR}="RCV",1,-1)*(($B${R_FIX}/100)-({L(0)}{r}/100+$B${R_SPR}/10000))*B{r}/360',
            fill=CALC,nf="0.000000")
U=G0+NM+1
put(U-1,1,"UNIT TOTALS",SUB)
put(U,3,f"=SUM(C{G0}:C{G0+NM-1})",fill=CALC,nf=NUM)
for j in range(6):
    b=4+j*7; L=lambda k:gcl(b+k)
    for k in range(1,5):
        put(U,b+k,f"=SUMPRODUCT({L(k)}{G0}:{L(k)}{G0+NM-1}/100*$B${G0}:$B${G0+NM-1})/360",fill=CALC,nf="0.00000")
    put(U,b+6,f"=SUM({L(6)}{G0}:{L(6)}{G0+NM-1})",fill=CALC,nf="0.00000")
    put(U+1,b,f"=SUMPRODUCT({L(0)}{G0}:{L(0)}{G0+NM-1}/100*$B${G0}:$B${G0+NM-1})/360"
              f"+$B${R_SPR}/10000*SUM($B${G0}:$B${G0+NM-1})/360",fill=CALC,nf="0.00000")

# ---------------- RESULTS (P4..V16)
O=16
put(4,O,"RESULTS — 2Y TOTALS ($MM)",SUB)
for j in range(6): put(5,O+1+j,f"={gcl(8+j)}5",SUB,align="center")
for i,k in enumerate(["Deposit income","Swap net","Bond cost","NII total"]): put(6+i,O,k)
for j in range(6):
    c=O+1+j; b=4+j*7; CL=gcl(c)
    put(6,c,f"=$B$17*{gcl(b+1)}${U}+$B$18*{gcl(b+2)}${U}+$B$19*{gcl(b+3)}${U}+$B$20*{gcl(b+4)}${U}",OUT,nf=NUM)
    put(7,c,f"=$B${R_NOT}/100*$B${R_CASH}*{gcl(b+6)}${U}",OUT,nf=NUM)
    put(8,c,f"=$C${U}",OUT,nf=NUM)
    put(9,c,f"={CL}6+{CL}7-{CL}8",Font(name=A,bold=True),nf=NUM)
wrng=f"$H${WR}:$M${WR}"
put(11,O,"Expected NII",SUB); put(11,O+1,f"=SUMPRODUCT({wrng},$Q$9:$V$9)",OUT,nf=NUM)
put(12,O,"NII volatility",SUB); put(12,O+1,f"=SQRT(MAX(0,SUMPRODUCT({wrng},($Q$9:$V$9-$Q$11)^2)))",OUT,nf=N2)
put(13,O,"Worst / Best",SUB); put(13,O+1,"=MIN($Q$9:$V$9)",OUT,nf=NUM); put(13,O+2,"=MAX($Q$9:$V$9)",OUT,nf=NUM)
fl=",".join(f"{gcl(4+j*7)}{U+1}" for j in range(6))
put(14,O,"Scenario-fair fixed (%)",SUB)
put(14,O+1,f"=100*SUMPRODUCT({wrng},CHOOSE({{1,2,3,4,5,6}},{fl}))/(SUM($B${G0}:$B${G0+NM-1})/360)",OUT,nf=N2)
put(15,O,"Carry gap (bps)",SUB); put(15,O+1,f"=($B${R_FIX}-$Q$14)*100",OUT,nf=NUM)

# ---------------- SENSITIVITY + CONE
put(17,O,"NII × IRS NOTIONAL",SUB)
put(18,O,"p%",SUB)
for j in range(6): put(18,O+1+j,f"={gcl(8+j)}5",SUB,align="center")
for i,p in enumerate(range(0,101,10)):
    r=19+i; put(r,O,p,fill=CALC,nf="0")
    for j in range(6):
        b=4+j*7; c=O+1+j
        put(r,c,f"={gcl(c)}$6+$P{r}/100*$B${R_CASH}*{gcl(b+6)}${U}-$C${U}",fill=CALC,nf=NUM)
    put(r,O+7,f"=MAX({gcl(O+1)}{r}:{gcl(O+6)}{r})-MIN({gcl(O+1)}{r}:{gcl(O+6)}{r})",fill=CALC,nf=N2)
put(18,O+7,"Disp.",SUB)
dR=f"${gcl(O+7)}$19:${gcl(O+7)}$29"
put(30,O,"Min dispersion @ %",SUB)
put(30,O+2,f"=INDEX($P$19:$P$29,MATCH(MIN({dR}),{dR},0))",OUT,nf="0",
    note="The hedge ratio where scenario outcomes converge most - the cone's pinch point.")
put(30,O+3,f"=MIN({dR})",OUT,nf=N2)

# ---------------- TIMELINE (selected scenario)
T0=25  # col Y
put(4,T0,"COMPOSITION — scenario:",SUB)
put(4,T0+3,SCEN[2],BLUE,note="Pick which scenario the composition table and charts below display.")
dv2=DataValidation(type="list",formula1=f"=$Q$5:$V$5"); ws.add_data_validation(dv2); dv2.add(f"{gcl(T0+3)}4")
SELC=f"${gcl(T0+3)}$4"
mtch=f"MATCH({SELC},$Q$5:$V$5,0)-1"
for c,h in enumerate(["Month","ON","1M","2M","3M","SWAP","BOND","NET"]): put(5,T0+c,h,SUB)
for m in range(NM):
    r=6+m; gr=G0+m
    put(r,T0,f"=A{gr}",fill=CALC,nf="MMM-YY")
    for k in range(4):
        put(r,T0+1+k,f"=$B${17+k}*INDEX($A{gr}:$AU{gr},4+({mtch})*7+{k+1})/100*$B{gr}/360",fill=CALC,nf="0.000")
    put(r,T0+5,f"=$B${R_NOT}/100*$B${R_CASH}*INDEX($A{gr}:$AU{gr},4+({mtch})*7+6)",fill=CALC,nf="0.000")
    put(r,T0+6,f"=-$C{gr}",fill=CALC,nf="0.000")
    put(r,T0+7,f"=SUM({gcl(T0+1)}{r}:{gcl(T0+6)}{r})",OUT,nf="0.000")

# ---------------- SELF-TESTS + VERSION
put(33,1,"SELF-TESTS",SUB)
tests=[("Weights sum 100%",f'=IF(ABS(SUM(H{WR}:M{WR})-1)<0.0001,"OK","FAIL")'),
("Allocation",'=IF(B21="OK","OK","FAIL")'),
("NII identity",'=IF(SUMPRODUCT(ABS($Q$9:$V$9-($Q$6:$V$6+$Q$7:$V$7-$Q$8:$V$8)))<0.001,"OK","FAIL")'),
("Timeline=NII",f'=IF(ABS(SUM({gcl(T0+7)}6:{gcl(T0+7)}29)-INDEX($Q$9:$V$9,MATCH({SELC},$Q$5:$V$5,0)))<0.01,"OK","FAIL")'),
("Pinch in range",f'=IF(AND($R$30>=0,$R$30<=100),"OK","FAIL")')]
for i,(k,f) in enumerate(tests,34):
    put(i,1,k); c=put(i,2,f,SUB); c.fill=WARN
put(39,1,"MODEL STATUS",SUB)
c=put(39,2,'=IF(COUNTIF(B34:B38,"FAIL")=0,"OK — ALL TESTS PASS","CHECK FAILED TESTS")',
      Font(name=A,bold=True,color="006100")); c.fill=WARN
put(40,1,"Version",SUB); put(40,2,VERSION,SUB)

# ---------------- CHARTS
def line(t,h=7,w=14):
    c=LineChart(); c.title=t; c.height,c.width=h,w
    c.y_axis.delete=False; c.x_axis.delete=False; return c
ch=line("SOFR step paths (%)")
for j in range(6):
    ch.add_data(Reference(ws,min_col=4+j*7,min_row=G0-1,max_row=G0+NM-1),titles_from_data=True)
ch.set_categories(Reference(ws,min_col=1,min_row=G0,max_row=G0+NM-1))
for sr in ch.series: sr.smooth=False
ws.add_chart(ch,"P33")
ch2=line("Convergence: NII vs IRS notional %")
ch2.add_data(Reference(ws,min_col=O+1,max_col=O+6,min_row=18,max_row=29),titles_from_data=True)
ch2.set_categories(Reference(ws,min_col=O,min_row=19,max_row=29))
for sr in ch2.series: sr.smooth=False
ws.add_chart(ch2,"P49")
ch5=BarChart(); ch5.type="col"; ch5.grouping="stacked"; ch5.overlap=100
ch5.title="Cashflow composition (selected scenario)"; ch5.height,ch5.width=8,16
ch5.y_axis.delete=False; ch5.x_axis.delete=False
ch5.add_data(Reference(ws,min_col=T0+1,max_col=T0+6,min_row=5,max_row=5+NM),titles_from_data=True)
ch5.set_categories(Reference(ws,min_col=T0,min_row=6,max_row=5+NM))
ws.add_chart(ch5,f"{gcl(T0)}33")
ln=line("NET NII by month",5,16)
ln.add_data(Reference(ws,min_col=T0+7,min_row=5,max_row=5+NM),titles_from_data=True)
ln.set_categories(Reference(ws,min_col=T0,min_row=6,max_row=5+NM))
ws.add_chart(ln,f"{gcl(T0)}49")

wb.calculation=CalcProperties(fullCalcOnLoad=True)
ws.freeze_panes="A4"
for col,w in [("A",24),("B",12),("C",9),("D",12),("F",12),("G",12),("P",22)]:
    ws.column_dimensions[col].width=w

import os
_dir=os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
_out=os.path.join(_dir,f"NII_Frontier_Lite_{VERSION}.xlsx")
try: wb.save(_out)
except PermissionError:
    _out=os.path.join(_dir,f"NII_Frontier_Lite_{VERSION}_new.xlsx"); wb.save(_out)
print(f"saved: {_out}")
