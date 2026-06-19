Attribute VB_Name = "modDashboard"
'==============================================================================
' modDashboard  -  writes ONE clean "Results" sheet: the precise, valuable
' read-out.  Per-tenor outcome, common ladders/barbell, the carry-best and the
' smoothest-income mix found on the grid, and a plain-language recommendation.
'==============================================================================
Option Explicit

Public Sub RunDashboard()
    LoadCurve
    Dim cfg As TConfig: cfg = LoadConfig
    Dim ws As Worksheet: Set ws = EnsureSheet("Results")
    ws.Cells.Clear: ws.Cells.Font.Name = "Consolas": GridOff ws

    ws.Range("B2").Value = "RESULTS  ·  " & Format(gDate(1), "yyyy-mm-dd") & "  to  " & Format(gDate(gN), "yyyy-mm-dd")
    ws.Range("B2").Font.Bold = True: ws.Range("B2").Font.Size = 14

    Dim r As Long: r = 4
    r = Section(ws, r, "BY TENOR (whole period)")
    HdrRow ws, r, Array("Mix", "AnnRet %", "WAM days", "IncomeVol bp")
    r = r + 1
    Dim nm As Variant: nm = Array("100% ON", "100% 1M", "100% 2M", "100% 3M")
    Dim t As Long, w(1 To 4) As Double, res As TSimResult
    For t = 1 To 4
        Erase w: w(t) = 1#: res = SimulateStrategy(w, cfg)
        r = WriteRow(ws, r, CStr(nm(t - 1)), res)
    Next t

    r = r + 1
    r = Section(ws, r, "COMMON MIXES")
    HdrRow ws, r, Array("Mix", "AnnRet %", "WAM days", "IncomeVol bp"): r = r + 1
    r = WriteRow(ws, r, "Even ladder 25/25/25/25", SimWeights(0.25, 0.25, 0.25, 0.25, cfg))
    r = WriteRow(ws, r, "Barbell 50 ON / 50 3M", SimWeights(0.5, 0, 0, 0.5, cfg))
    r = WriteRow(ws, r, "Front ladder 40/30/20/10", SimWeights(0.4, 0.3, 0.2, 0.1, cfg))

    ' scan grid for carry-best and smoothest-income
    Dim s As Long: s = cfg.GridStep
    Dim a As Long, b As Long, c As Long, d As Long
    Dim bestRet As Double, bestVol As Double
    Dim bw(1 To 4) As Double, vw(1 To 4) As Double
    bestRet = -1E+30: bestVol = 1E+30
    For a = 0 To 100 Step s: For b = 0 To 100 - a Step s: For c = 0 To 100 - a - b Step s
        d = 100 - a - b - c
        w(1) = a / 100#: w(2) = b / 100#: w(3) = c / 100#: w(4) = d / 100#
        res = SimulateStrategy(w, cfg)
        If res.annReturn > bestRet Then bestRet = res.annReturn: bw(1) = w(1): bw(2) = w(2): bw(3) = w(3): bw(4) = w(4)
        If res.incomeVol < bestVol Then bestVol = res.incomeVol: vw(1) = w(1): vw(2) = w(2): vw(3) = w(3): vw(4) = w(4)
    Next c: Next b: Next a

    r = r + 1
    r = Section(ws, r, "BEST ON THE GRID")
    HdrRow ws, r, Array("Mix", "AnnRet %", "WAM days", "IncomeVol bp"): r = r + 1
    r = WriteRow(ws, r, "Highest carry  " & WStr(bw), SimWeights(bw(1), bw(2), bw(3), bw(4), cfg))
    r = WriteRow(ws, r, "Smoothest income  " & WStr(vw), SimWeights(vw(1), vw(2), vw(3), vw(4), cfg))

    r = r + 2
    ws.Cells(r, 2).Value = "READ-OUT"
    ws.Cells(r, 2).Font.Bold = True: ws.Cells(r, 2).Font.Color = RGB(200, 132, 30): r = r + 1
    ws.Cells(r, 2).Value = "Carry differences across mixes are usually small once the curve prices the path;": r = r + 1
    ws.Cells(r, 2).Value = "the durable gain from blending is risk: an even ladder is the smoothest-income,": r = r + 1
    ws.Cells(r, 2).Value = "lowest-regret base. Tilt short (toward ON) for a hiking view, long (3M) for cuts.": r = r + 1
    ws.Range(ws.Cells(r - 3, 2), ws.Cells(r - 1, 2)).Font.Color = RGB(70, 70, 70)

    ws.Columns("B").ColumnWidth = 30
    ws.Range("C:E").ColumnWidth = 12
    MsgBox "Results sheet written.", vbInformation
End Sub

Private Function SimWeights(a As Double, b As Double, c As Double, d As Double, cfg As TConfig) As TSimResult
    Dim w(1 To 4) As Double: w(1) = a: w(2) = b: w(3) = c: w(4) = d
    SimWeights = SimulateStrategy(w, cfg)
End Function

Private Function WriteRow(ws As Worksheet, ByVal r As Long, label As String, res As TSimResult) As Long
    ws.Cells(r, 2).Value = label
    ws.Cells(r, 3).Value = res.annReturn: ws.Cells(r, 3).NumberFormat = "0.000"
    ws.Cells(r, 4).Value = res.wam: ws.Cells(r, 4).NumberFormat = "0.0"
    ws.Cells(r, 5).Value = res.incomeVol: ws.Cells(r, 5).NumberFormat = "0.0"
    WriteRow = r + 1
End Function

Private Function Section(ws As Worksheet, ByVal r As Long, txt As String) As Long
    ws.Cells(r, 2).Value = txt
    ws.Cells(r, 2).Font.Bold = True: ws.Cells(r, 2).Font.Color = RGB(200, 132, 30)
    Section = r + 1
End Function

Private Sub HdrRow(ws As Worksheet, ByVal r As Long, h As Variant)
    Dim j As Long
    For j = 0 To UBound(h)
        ws.Cells(r, 2 + j).Value = h(j)
        ws.Cells(r, 2 + j).Font.Bold = True
        ws.Cells(r, 2 + j).Font.Color = RGB(255, 255, 255)
        ws.Cells(r, 2 + j).Interior.Color = RGB(28, 24, 19)
    Next j
End Sub

Private Function WStr(w() As Double) As String
    WStr = "(" & Format(w(1), "0%") & "/" & Format(w(2), "0%") & "/" & _
           Format(w(3), "0%") & "/" & Format(w(4), "0%") & ")"
End Function
