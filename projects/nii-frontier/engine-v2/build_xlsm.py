"""build_xlsm.py  ->  NII_Engine_v2.xlsm  (macro-enabled, code already inside)

Runs on WINDOWS with Excel installed. It drives Excel via COM to:
  - create the workbook and the INPUTS / MODEL sheets
  - import the three .bas modules from .\bas
  - paste the engine formulas
  - save a real .xlsm  (Excel does the embedding -> always valid)

USAGE (Windows, in this folder):
    pip install pywin32
    python build_xlsm.py

If Excel blocks programmatic VBA import, enable once:
    Excel > File > Options > Trust Center > Trust Center Settings >
    Macro Settings > tick "Trust access to the VBA project object model".
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BAS  = os.path.join(HERE, "bas")
OUT  = os.path.join(HERE, "NII_Engine_v2.xlsm")
MODULES = ["mRegistry.bas", "cRatesCurve.bas", "mEngine.bas"]

# xlOpenXMLWorkbookMacroEnabled = 52
XLSM = 52

def main():
    try:
        import win32com.client as win32
    except ImportError:
        sys.exit("pywin32 not found.  Run:  pip install pywin32")

    for m in MODULES:
        if not os.path.exists(os.path.join(BAS, m)):
            sys.exit("missing module: bas\\%s" % m)

    excel = win32.gencache.EnsureDispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    wb = excel.Workbooks.Add()

    # ---- import the .bas modules (classes import as class modules automatically)
    try:
        vbproj = wb.VBProject
    except Exception:
        excel.Quit()
        sys.exit("Excel blocked VBA access. Enable 'Trust access to the VBA "
                 "project object model' (see header) and re-run.")
    for m in MODULES:
        vbproj.VBComponents.Import(os.path.join(BAS, m))

    # ---- INPUTS sheet
    ws = wb.Worksheets(1); ws.Name = "INPUTS"
    ws.Range("A1").Value = "INPUTS"
    ws.Range("A3").Value = "Holidays (date | name)"
    hol = [("2026-01-01","New Year"),("2026-01-19","MLK Day"),("2026-07-03","Independence (obs)"),
           ("2026-09-07","Labor Day"),("2026-11-26","Thanksgiving"),("2026-12-25","Christmas")]
    for i,(d,n) in enumerate(hol):
        ws.Range("A%d"%(4+i)).Value = d
        ws.Range("B%d"%(4+i)).Value = n
    ws.Range("D3").Value = "FOMC moves (date | bps)"
    fomc = [("2026-06-17",-25),("2026-07-29",-25),("2026-09-16",-25),("2026-10-28",0)]
    for i,(d,m) in enumerate(fomc):
        ws.Range("D%d"%(4+i)).Value = d
        ws.Range("E%d"%(4+i)).Value = m
    ws.Range("A4:A9").NumberFormat = "yyyy-mm-dd"
    ws.Range("D4:D7").NumberFormat = "yyyy-mm-dd"

    # ---- MODEL sheet
    mo = wb.Worksheets.Add(After=ws); mo.Name = "MODEL"
    mo.Range("A1").Value = "MODEL — live engine"
    mo.Range("A3").Value = "Curve"
    mo.Range("B6").Formula = '=BuildCurve("curve1",DATE(2026,6,15),DATE(2030,12,31),3.80,INPUTS!D4:E7,INPUTS!A4:B9)'
    mo.Range("A6").Value = "Curve"

    rows = [
        (9,  "Period simple",   '=Accrue(DATE(2026,7,1),DATE(2026,10,1),100,"SIMPLE",$B$6)',   0.853750),
        (10, "Period compound", '=Accrue(DATE(2026,7,1),DATE(2026,10,1),100,"COMPOUND",$B$6)', 0.857325),
        (13, "Swap FIXED", '=SwapLeg(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$6,"FIXED")', 1.017187),
        (14, "Swap FLOAT", '=SwapLeg(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$6,"FLOAT")', 1.142773),
        (15, "Swap NET",   '=SwapLeg(DATE(2026,7,1),DATE(2026,8,1),375,3.15,$B$6,"NET")',  -0.125585),
    ]
    mo.Range("A8").Value = "ACCRUE"
    mo.Range("A12").Value = "SWAP — $375mm @3.15%, July, receive-fixed"
    for r,label,formula,expected in rows:
        mo.Range("A%d"%r).Value = label
        mo.Range("B%d"%r).Formula = formula
        mo.Range("C%d"%r).Value = expected
        mo.Range("D%d"%r).Formula = '=IF(ABS(B%d-C%d)<0.000001,"OK","check")'%(r,r)
        mo.Range("B%d"%r).NumberFormat = "0.000000"
        mo.Range("C%d"%r).NumberFormat = "0.000000"
    mo.Range("C8").Value = "Expected"; mo.Range("D8").Value = "Check"
    mo.Range("A17").Value = "INSPECT — GET spills provenance + daily strip"
    mo.Range("B18").Formula = "=BuildCurve("info",$B$6,$B$6,0,$B$6,$B$6)"
    mo.Columns("A").ColumnWidth = 28
    mo.Columns("B:D").ColumnWidth = 14

    excel.Calculate()
    wb.SaveAs(OUT, FileFormat=XLSM)
    wb.Close(SaveChanges=False)
    excel.Quit()
    print("created:", OUT)
    print("Open it, enable macros, press Ctrl+Alt+F9. The Check column should read OK.")

if __name__ == "__main__":
    main()
