"""build_simple_example.py  ->  NII_Engine_Simple.xlsx
Minimal workbook to test the NII engine. Ships formula-free; import the VBA
(NII_ENGINE_ALL_VBA.txt), then paste the formulas from column E of MODEL.
Run: python3 build_simple_example.py     (needs: pip install openpyxl)
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side
from openpyxl.workbook.properties import CalcProperties
from datetime import date

A="Arial"; NAVY="1F3864"
BLUE=Font(name=A,color="0000FF"); BLK=Font(name=A,size=10); SUB=Font(name=A,bold=True,size=10)
YEL=PatternFill("solid",start_color="FFF2CC"); MONO=Font(name="Consolas",size=9,color="7F4F00")
thin=Side(style="thin",color="BFBFBF"); BOX=Border(left=thin,right=thin,top=thin,bottom=thin)

def put(ws,r,c,v,font=BLK,fill=None,nf=None,box=False):
    x=ws.cell(row=r,column=c,value=v); x.font=font
    if fill:x.fill=fill
    if nf:x.number_format=nf
    if box:x.border=BOX
    return x

def build(path="NII_Engine_Simple.xlsx"):
    wb=Workbook()

    # README
    ws=wb.active; ws.title="README"; ws.sheet_view.showGridLines=False
    L=["NII ENGINE — SIMPLE EXAMPLE","",
    "Four functions: FED_HOL, MAKE_CURVE, ACCRUE, SWAP.","",
    "SETUP",
    "1. Open NII_ENGINE_ALL_VBA.txt. Alt+F11 in Excel.",
    "2. Paste its 6 modules. cCalendar and cStripCurve are CLASS modules;",
    "   the other four are normal modules. Delete each block's first",
    "   'Attribute VB_Name' line. Rename each module to its banner name.",
    "3. Save as .xlsm. Press Ctrl+Alt+F9.",
    "4. Go to MODEL. Copy each formula in column E into the yellow cell on",
    "   its left. Do B4 (calendar) and B5 (curve) FIRST.",
    "5. Each Result should match the Expected value next to it.",
    "6. Alt+F8 > TestAll writes a TESTS sheet — expect MODEL STATUS: OK.","",
    "RULE: ACCRUE and SWAP point at the curve CELL B5 — never type \"cuts\"."]
    for i,t in enumerate(L,1):
        ws.cell(row=i,column=1,value=t).font=(Font(name=A,bold=True,size=15,color=NAVY) if i==1 else BLK)
    ws.column_dimensions["A"].width=88

    # INPUTS — holidays in A, FOMC moves as ONE two-column block D:E
    ws=wb.create_sheet("INPUTS"); ws.sheet_view.showGridLines=False
    put(ws,1,1,"INPUTS",Font(name=A,bold=True,size=12,color=NAVY))
    put(ws,3,1,"Holidays",SUB)
    hols=[date(2026,1,1),date(2026,1,19),date(2026,7,3),date(2026,9,7),date(2026,11,26),date(2026,12,25)]
    for i,d in enumerate(hols,4): put(ws,i,1,d,BLUE,nf="YYYY-MM-DD",box=True)
    put(ws,3,4,"FOMC moves (date | bps)",SUB)
    fomc=[(date(2026,6,17),-25),(date(2026,7,29),-25),(date(2026,9,16),-25),(date(2026,10,28),0)]
    for i,(d,m) in enumerate(fomc,4):
        put(ws,i,4,d,BLUE,nf="YYYY-MM-DD",box=True); put(ws,i,5,m,BLUE,nf='0;-0;"-"',box=True)
    put(ws,10,4,"SOFR now %",SUB); put(ws,10,5,3.80,BLUE,nf="0.00",box=True)
    put(ws,12,1,"Holidays = A4:A9   ·   FOMC = D4:E7   ·   SOFR = E10",Font(name=A,size=9,color="595959"))
    for c,w in [("A",13),("D",13),("E",11)]: ws.column_dimensions[c].width=w

    # MODEL — yellow result | expected | check | paste formula
    ws=wb.create_sheet("MODEL"); ws.sheet_view.showGridLines=False
    put(ws,1,1,"MODEL — paste each column-E formula into the yellow cell",Font(name=A,bold=True,size=12,color=NAVY))
    put(ws,3,1,"1 · BUILD OBJECTS (do these first)",SUB); put(ws,3,5,"PASTE THIS",SUB)
    put(ws,4,1,"Calendar"); put(ws,4,2,None,fill=YEL,box=True)
    put(ws,4,5,"=FED_HOL(INPUTS!A4:A9)",MONO)
    put(ws,5,1,"Curve"); put(ws,5,2,None,fill=YEL,box=True)
    put(ws,5,5,'=MAKE_CURVE("cuts",INPUTS!E10,INPUTS!D4:E7,$B$4)',MONO)

    put(ws,7,1,"2 · ACCRUE",SUB)
    put(ws,7,3,"Expected",SUB); put(ws,7,4,"Check",SUB); put(ws,7,5,"PASTE THIS",SUB)
    cases=[("ON, normal day",0.009861,'=ACCRUE(DATE(2026,7,15),DATE(2026,7,16),100,"SIMPLE",$B$5)'),
    ("ON, over a weekend",0.029583,'=ACCRUE(DATE(2026,7,17),DATE(2026,7,20),100,"SIMPLE",$B$5)'),
    ("ON, holiday bridge",0.039444,'=ACCRUE(DATE(2026,7,2),DATE(2026,7,6),100,"SIMPLE",$B$5)'),
    ("Period, simple",0.853750,'=ACCRUE(DATE(2026,7,1),DATE(2026,10,1),100,"SIMPLE",$B$5)'),
    ("Period, compounding",0.857325,'=ACCRUE(DATE(2026,7,1),DATE(2026,10,1),100,"COMPOUND",$B$5)')]
    r=8
    for nm,exp,f in cases:
        put(ws,r,1,nm); x=put(ws,r,2,None,fill=YEL,box=True); x.number_format="0.000000"
        put(ws,r,3,exp,nf="0.000000")
        put(ws,r,4,'=IF(ABS(B%d-C%d)<0.000001,"OK","check")'%(r,r),SUB)
        put(ws,r,5,f,MONO); r+=1

    put(ws,r+1,1,"3 · SWAP — $375mm @3.15%, July, receive-fixed",SUB); r+=2
    swap=[("FIXED leg",1.017187,'=SWAP(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$5,"FIXED")'),
    ("FLOAT leg",1.142773,'=SWAP(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$5,"FLOAT")'),
    ("NET (fixed-float)",-0.125585,'=SWAP(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$5,"NET")')]
    for nm,exp,f in swap:
        put(ws,r,1,nm); x=put(ws,r,2,None,fill=YEL,box=True); x.number_format="0.000000"
        put(ws,r,3,exp,nf="0.000000")
        put(ws,r,4,'=IF(ABS(B%d-C%d)<0.000001,"OK","check")'%(r,r),SUB)
        put(ws,r,5,f,MONO); r+=1
    for c,w in [("A",26),("B",13),("C",13),("D",8),("E",62)]: ws.column_dimensions[c].width=w

    wb.calculation=CalcProperties(fullCalcOnLoad=True)
    wb.save(path); print("saved:",path)

if __name__=="__main__":
    build()
