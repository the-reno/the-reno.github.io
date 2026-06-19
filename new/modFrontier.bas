Attribute VB_Name = "modFrontier"
'==============================================================================
' modFrontier  -  enumerates the weight grid, runs the path simulator on the
' base curve for every mix, and writes the realised frontier table to
' VBA_Frontier.  Risk shown two ways: liquidity (WAM) and income vol (bp).
' Also hosts EnsureSheet + MakeScatter, shared by the other modules.
'==============================================================================
Option Explicit

Public Sub BuildFrontier()
    Dim cfg As TConfig: cfg = LoadConfig
    Dim ws As Worksheet: Set ws = EnsureSheet("VBA_Frontier")
    Dim s As Long: s = cfg.GridStep
    Dim a As Long, b As Long, c As Long, d As Long
    Dim w(1 To 4) As Double, res As TSimResult
    Dim r As Long, idx As Long

    ws.Cells.Clear
    ws.Range("B2").Value = "REALISED EFFICIENT FRONTIER  (path-accurate VBA engine)"
    ws.Range("B2").Font.Bold = True
    ws.Range("B3").Value = "HTM deposits have ~0 mark-to-market vol -> risk = liquidity (WAM) + income vol. " _
        & "Forward rate risk is on VBA_Scenario."
    Dim h As Variant, j As Long
    h = Array("#", "wON", "w1M", "w2M", "w3M", "AnnRet %", "WAM days", "Carry/day bp", "IncomeVol bp", "FinalNAV")
    For j = 0 To UBound(h)
        ws.Cells(4, 2 + j).Value = h(j): ws.Cells(4, 2 + j).Font.Bold = True
    Next j

    r = 5
    Application.ScreenUpdating = False
    For a = 0 To 100 Step s
        For b = 0 To 100 - a Step s
            For c = 0 To 100 - a - b Step s
                d = 100 - a - b - c
                w(1) = a / 100#: w(2) = b / 100#: w(3) = c / 100#: w(4) = d / 100#
                res = SimulateStrategy(w, cfg)
                idx = idx + 1
                ws.Cells(r, 2).Value = idx
                ws.Cells(r, 3).Value = w(1): ws.Cells(r, 4).Value = w(2)
                ws.Cells(r, 5).Value = w(3): ws.Cells(r, 6).Value = w(4)
                ws.Cells(r, 7).Value = res.annReturn
                ws.Cells(r, 8).Value = res.wam
                If res.wam > 1 Then ws.Cells(r, 9).Value = (res.annReturn - cfg.Rf) / res.wam * 100#
                ws.Cells(r, 10).Value = res.incomeVol
                ws.Cells(r, 11).Value = res.finalNav
                r = r + 1
            Next c
        Next b
    Next a
    Application.ScreenUpdating = True

    ws.Range(ws.Cells(5, 3), ws.Cells(r - 1, 6)).NumberFormat = "0%"
    ws.Range(ws.Cells(5, 7), ws.Cells(r - 1, 7)).NumberFormat = "0.000"
    ws.Range(ws.Cells(5, 8), ws.Cells(r - 1, 8)).NumberFormat = "0.0"
    ws.Range(ws.Cells(5, 9), ws.Cells(r - 1, 10)).NumberFormat = "0.00"
    ws.Range(ws.Cells(5, 11), ws.Cells(r - 1, 11)).NumberFormat = "0.0000"
    ws.Columns("B:K").AutoFit
    MakeScatter ws, "Realised frontier: carry vs liquidity (WAM)", 8, 7, r - 1, "B14"
    MsgBox "Frontier built: " & idx & " strategies.", vbInformation
End Sub

' Minimal native scatter (y = ycol, x = xcol) anchored at a cell.
Public Sub MakeScatter(ws As Worksheet, ttl As String, ByVal xcol As Long, _
        ByVal ycol As Long, ByVal lastRow As Long, anchor As String)
    Dim co As ChartObject
    Set co = ws.ChartObjects.Add(ws.Range(anchor).Left, ws.Range(anchor).Top, 460, 280)
    With co.Chart
        .ChartType = xlXYScatter
        .HasTitle = True: .ChartTitle.Text = ttl
        Do While .SeriesCollection.Count > 0: .SeriesCollection(1).Delete: Loop
        With .SeriesCollection.NewSeries
            .XValues = ws.Range(ws.Cells(5, xcol), ws.Cells(lastRow, xcol))
            .Values = ws.Range(ws.Cells(5, ycol), ws.Cells(lastRow, ycol))
            .MarkerStyle = xlMarkerStyleCircle: .MarkerSize = 4
        End With
        .Axes(xlCategory).HasTitle = True: .Axes(xlCategory).AxisTitle.Text = "WAM (days locked)"
        .Axes(xlValue).HasTitle = True: .Axes(xlValue).AxisTitle.Text = "Ann. return (%)"
        .HasLegend = False
    End With
End Sub

Public Sub GridOff(ws As Worksheet)
    On Error Resume Next
    ws.Activate
    ActiveWindow.DisplayGridlines = False
    On Error GoTo 0
End Sub

Public Function EnsureSheet(nm As String) As Worksheet
    On Error Resume Next
    Set EnsureSheet = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If EnsureSheet Is Nothing Then
        Set EnsureSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        EnsureSheet.Name = nm
    End If
End Function
