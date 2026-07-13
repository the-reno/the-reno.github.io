Attribute VB_Name = "risk01"
Option Explicit

' risk01.bas
' Interest-rate risk exposure engine for roll-level cash / term-deposit data.
' Source sheet required: Detail
' Main macro: RunRisk01Analysis
'
' Expected fields in Detail, any order:
' tenor, roll number, investment start date, rate date used, maturity target date,
' actual end date, rate, accrual days, starting cash, interest earned, ending cash
'
' Output tabs:
' 00_ReadMe, 01_CleanRolls, 02_RatePanel, 03_ValuePanel, 04_ReturnPanel,
' 05_ExcessVsON, 06_RiskSummary, 07_EfficientFrontier, 08_StressScenarios, 09_Dashboard
'
' Design: dynamic tenors, unbiased curve approach, ON benchmark only if present.

Private Const DETAIL_SHEET As String = "Detail"
Private Const FRONTIER_SIMS As Long = 1500
Private Const MAX_WAM_DAYS As Double = 90
Private Const MIN_ON_WGT As Double = 0.2
Private Const MAX_6M_WGT As Double = 0.25

Public Sub RunRisk01Analysis()
    Dim wb As Workbook, wsD As Worksheet, hRow As Long, lastRow As Long, tenors As Object
    On Error GoTo Fail
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    Application.Calculation = xlCalculationManual
    Set wb = ThisWorkbook
    Set wsD = SheetByName(wb, DETAIL_SHEET)
    If wsD Is Nothing Then Err.Raise 1001, , "Sheet 'Detail' not found."
    hRow = FindHeaderRow(wsD)
    If hRow = 0 Then Err.Raise 1002, , "Header row not found in Detail."
    lastRow = wsD.Cells(wsD.Rows.Count, 1).End(xlUp).Row
    DeleteOutputs wb
    BuildReadMe wb
    Set tenors = BuildCleanRolls(wb, wsD, hRow, lastRow)
    BuildRatePanel wb, tenors
    BuildValuePanel wb, tenors
    BuildReturnPanel wb
    BuildExcessPanel wb
    BuildRiskSummary wb, tenors
    BuildFrontier wb, tenors
    BuildStress wb, tenors
    BuildDashboard wb, tenors
    FormatOutputs wb
    MsgBox "risk01 completed. Tabs created from Detail. Tenors: " & JoinKeys(tenors, ", "), vbInformation
Done:
    Application.Calculation = xlCalculationAutomatic
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    Exit Sub
Fail:
    MsgBox "risk01 failed: " & Err.Description, vbCritical
    Resume Done
End Sub

Private Function SheetByName(wb As Workbook, nm As String) As Worksheet
    On Error Resume Next
    Set SheetByName = wb.Worksheets(nm)
    On Error GoTo 0
End Function

Private Function WS(wb As Workbook, nm As String) As Worksheet
    Dim x As Worksheet
    Set x = SheetByName(wb, nm)
    If x Is Nothing Then
        Set x = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        x.Name = nm
    Else
        x.Cells.Clear
    End If
    Set WS = x
End Function

Private Sub DeleteOutputs(wb As Workbook)
    Dim a, i As Long, x As Worksheet
    a = Array("00_ReadMe", "01_CleanRolls", "02_RatePanel", "03_ValuePanel", "04_ReturnPanel", "05_ExcessVsON", "06_RiskSummary", "07_EfficientFrontier", "08_StressScenarios", "09_Dashboard")
    For i = LBound(a) To UBound(a)
        Set x = SheetByName(wb, CStr(a(i)))
        If Not x Is Nothing Then x.Delete
    Next i
End Sub

Private Function NHead(s As String) As String
    s = LCase$(Trim$(s))
    s = Replace(s, " ", ""): s = Replace(s, "_", ""): s = Replace(s, "-", "")
    s = Replace(s, "/", ""): s = Replace(s, ".", "")
    NHead = s
End Function

Private Function FindHeaderRow(ws As Worksheet) As Long
    Dim r As Long, c As Long, lc As Long, hasTenor As Boolean, hasRate As Boolean, hasEndCash As Boolean
    For r = 1 To 15
        lc = ws.Cells(r, ws.Columns.Count).End(xlToLeft).Column
        hasTenor = False: hasRate = False: hasEndCash = False
        For c = 1 To lc
            If NHead(CStr(ws.Cells(r, c).Value)) = "tenor" Then hasTenor = True
            If InStr(1, NHead(CStr(ws.Cells(r, c).Value)), "rate", vbTextCompare) > 0 Then hasRate = True
            If NHead(CStr(ws.Cells(r, c).Value)) = "endingcash" Then hasEndCash = True
        Next c
        If hasTenor And hasRate And hasEndCash Then FindHeaderRow = r: Exit Function
    Next r
End Function

Private Function HeaderMap(ws As Worksheet, r As Long) As Object
    Dim d As Object, c As Long, lc As Long, k As String
    Set d = CreateObject("Scripting.Dictionary")
    lc = ws.Cells(r, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lc
        k = NHead(CStr(ws.Cells(r, c).Value))
        If Len(k) > 0 Then d(k) = c
    Next c
    Set HeaderMap = d
End Function

Private Function Col(h As Object, ParamArray names()) As Long
    Dim i As Long, k As String
    For i = LBound(names) To UBound(names)
        k = NHead(CStr(names(i)))
        If h.Exists(k) Then Col = CLng(h(k)): Exit Function
    Next i
End Function

Private Function Num(v As Variant) As Double
    Dim s As String, pct As Boolean
    If IsError(v) Or IsEmpty(v) Then Exit Function
    If IsNumeric(v) Then Num = CDbl(v): Exit Function
    s = Trim$(CStr(v)): pct = InStr(1, s, "%") > 0
    s = Replace(s, "$", ""): s = Replace(s, ",", ""): s = Replace(s, "%", "")
    s = Replace(s, "(", "-"): s = Replace(s, ")", "")
    If IsNumeric(s) Then Num = CDbl(s): If pct Then Num = Num / 100#
End Function

Private Function Dte(v As Variant) As Date
    If IsDate(v) Then Dte = CDate(v)
End Function

Private Function TDays(t As String) As Double
    t = UCase$(Trim$(t))
    Select Case t
        Case "ON", "O/N", "OVERNIGHT": TDays = 1
        Case "1M": TDays = 30
        Case "2M": TDays = 60
        Case "3M": TDays = 90
        Case "6M": TDays = 180
        Case "9M": TDays = 270
        Case "12M", "1Y": TDays = 365
        Case Else
            If Right$(t, 1) = "M" And IsNumeric(Left$(t, Len(t) - 1)) Then TDays = CDbl(Left$(t, Len(t) - 1)) * 30 Else TDays = 30
    End Select
End Function

Private Function JoinKeys(d As Object, sep As String) As String
    Dim k, s As String
    For Each k In d.Keys
        If Len(s) > 0 Then s = s & sep
        s = s & CStr(k)
    Next k
    JoinKeys = s
End Function

Private Function LastCol(ws As Worksheet, r As Long) As Long
    LastCol = ws.Cells(r, ws.Columns.Count).End(xlToLeft).Column
End Function

Private Function LastDataRow(ws As Worksheet) As Long
    LastDataRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
End Function

Private Function FindCol(ws As Worksheet, header As String) As Long
    Dim c As Long
    For c = 1 To LastCol(ws, 1)
        If UCase$(Trim$(CStr(ws.Cells(1, c).Value))) = UCase$(Trim$(header)) Then FindCol = c: Exit Function
    Next c
End Function

Private Sub BuildReadMe(wb As Workbook)
    Dim s As Worksheet
    Set s = WS(wb, "00_ReadMe")
    s.Range("A1").Value = "risk01 - Interest Rate Risk Exposure Analysis"
    s.Range("A3").Value = "Purpose": s.Range("B3").Value = "Analyze historical rates, reinvestment exposure, excess carry versus ON, liquidity lockup, and efficient-frontier trade-offs."
    s.Range("A5").Value = "Input": s.Range("B5").Value = "Put roll-level data in a tab named Detail. Headers can be in any order."
    s.Range("A7").Value = "Unbiased approach": s.Range("B7").Value = "The code does not hard-code a winning tenor or curve view. Tenors are detected dynamically and ON is used as benchmark only if present."
    s.Range("A9").Value = "Risk focus": s.Range("B9").Value = "Rate reset risk, reinvestment risk, excess-return volatility, hit ratio, relative drawdown, WAM, liquidity constraints, and stress sensitivity."
End Sub

Private Function BuildCleanRolls(wb As Workbook, wsD As Worksheet, hRow As Long, lastRow As Long) As Object
    Dim s As Worksheet, h As Object, d As Object, r As Long, o As Long, t As String
    Dim cTenor As Long, cRoll As Long, cStart As Long, cRateDate As Long, cTarget As Long, cEnd As Long, cRate As Long, cDays As Long, cSC As Long, cInt As Long, cEC As Long
    Dim rate As Double, sc As Double, ec As Double, days As Double, ds As Date, de As Date
    Set s = WS(wb, "01_CleanRolls")
    Set h = HeaderMap(wsD, hRow)
    Set d = CreateObject("Scripting.Dictionary")
    cTenor = Col(h, "tenor"): cRoll = Col(h, "roll number", "rollnumber")
    cStart = Col(h, "investment start date", "investmentstartdate", "start date")
    cRateDate = Col(h, "rate date used", "ratedateused", "rate date")
    cTarget = Col(h, "maturity target date", "maturitytargetdate", "target date")
    cEnd = Col(h, "actual end date", "actualenddate", "end date")
    cRate = Col(h, "rate"): cDays = Col(h, "accrual days", "accrualdays", "days")
    cSC = Col(h, "starting cash", "startingcash"): cInt = Col(h, "interest earned", "interestearned", "interest"): cEC = Col(h, "ending cash", "endingcash")
    If cTenor = 0 Or cStart = 0 Or cRateDate = 0 Or cEnd = 0 Or cRate = 0 Or cDays = 0 Or cSC = 0 Or cInt = 0 Or cEC = 0 Then Err.Raise 2001, , "Missing required Detail columns."
    s.Range("A1:O1").Value = Array("tenor", "roll_number", "investment_start_date", "rate_date_used", "maturity_target_date", "actual_end_date", "rate_decimal", "rate_pct", "accrual_days", "starting_cash", "interest_earned", "ending_cash", "roll_return", "annualized_roll_return", "tenor_days")
    o = 2
    For r = hRow + 1 To lastRow
        t = UCase$(Trim$(CStr(wsD.Cells(r, cTenor).Value)))
        If Len(t) > 0 Then
            ds = Dte(wsD.Cells(r, cStart).Value): de = Dte(wsD.Cells(r, cEnd).Value)
            sc = Num(wsD.Cells(r, cSC).Value): ec = Num(wsD.Cells(r, cEC).Value)
            days = Num(wsD.Cells(r, cDays).Value): rate = Num(wsD.Cells(r, cRate).Value)
            If rate > 1 Then rate = rate / 100#
            If ds > 0 And de > 0 And sc > 0 And ec > 0 Then
                If Not d.Exists(t) Then d.Add t, t
                s.Cells(o, 1).Value = t
                If cRoll > 0 Then s.Cells(o, 2).Value = wsD.Cells(r, cRoll).Value Else s.Cells(o, 2).Value = o - 1
                s.Cells(o, 3).Value = ds
                s.Cells(o, 4).Value = Dte(wsD.Cells(r, cRateDate).Value)
                If cTarget > 0 Then s.Cells(o, 5).Value = Dte(wsD.Cells(r, cTarget).Value)
                s.Cells(o, 6).Value = de
                s.Cells(o, 7).Value = rate: s.Cells(o, 8).Value = rate
                s.Cells(o, 9).Value = days: s.Cells(o, 10).Value = sc
                s.Cells(o, 11).Value = Num(wsD.Cells(r, cInt).Value): s.Cells(o, 12).Value = ec
                s.Cells(o, 13).Value = ec / sc - 1
                If days > 0 Then s.Cells(o, 14).Value = (1 + ec / sc - 1) ^ (365# / days) - 1
                s.Cells(o, 15).Value = TDays(t)
                o = o + 1
            End If
        End If
    Next r
    s.Range("Q1").Value = "Comments": s.Range("Q2").Value = "Cleaned roll ledger. One row equals one roll. This is the base for all risk analysis."
    Set BuildCleanRolls = d
End Function

Private Sub BuildRatePanel(wb As Workbook, tenors As Object)
    Dim c As Worksheet, s As Worksheet, dates As Object, rates As Object, r As Long, lr As Long, k, arr, i As Long, j As Long, tmp, t, out As Long
    Set c = wb.Worksheets("01_CleanRolls"): Set s = WS(wb, "02_RatePanel")
    Set dates = CreateObject("Scripting.Dictionary"): Set rates = CreateObject("Scripting.Dictionary")
    lr = LastDataRow(c): arr = tenors.Keys
    For r = 2 To lr
        k = CStr(CLng(c.Cells(r, 4).Value))
        If Not dates.Exists(k) Then dates.Add k, c.Cells(r, 4).Value
        rates(k & "|" & CStr(c.Cells(r, 1).Value)) = c.Cells(r, 7).Value
    Next r
    Dim dArr(): ReDim dArr(0 To dates.Count - 1): i = 0
    For Each k In dates.Keys: dArr(i) = dates(k): i = i + 1: Next k
    For i = LBound(dArr) To UBound(dArr) - 1: For j = i + 1 To UBound(dArr): If dArr(j) < dArr(i) Then tmp = dArr(i): dArr(i) = dArr(j): dArr(j) = tmp
    Next j, i
    s.Cells(1, 1).Value = "rate_date"
    For i = LBound(arr) To UBound(arr): s.Cells(1, i + 2).Value = arr(i): Next i
    out = 2
    For i = LBound(dArr) To UBound(dArr)
        s.Cells(out, 1).Value = dArr(i): k = CStr(CLng(dArr(i)))
        For j = LBound(arr) To UBound(arr)
            If rates.Exists(k & "|" & arr(j)) Then s.Cells(out, j + 2).Value = rates(k & "|" & arr(j))
        Next j
        out = out + 1
    Next i
    s.Cells(1, UBound(arr) + 4).Value = "Comments": s.Cells(2, UBound(arr) + 4).Value = "Historical rates by reset date. Blanks mean the tenor did not reset on that date."
End Sub

Private Sub BuildValuePanel(wb As Workbook, tenors As Object)
    Dim c As Worksheet, s As Worksheet, arr, minD As Date, maxD As Date, obs As Date, r As Long, i As Long, out As Long
    Set c = wb.Worksheets("01_CleanRolls"): Set s = WS(wb, "03_ValuePanel")
    arr = tenors.Keys: minD = WorksheetFunction.Min(c.Range("F2:F" & LastDataRow(c))): maxD = WorksheetFunction.Max(c.Range("F2:F" & LastDataRow(c)))
    s.Cells(1, 1).Value = "observation_date"
    For i = LBound(arr) To UBound(arr): s.Cells(1, i + 2).Value = arr(i): Next i
    obs = DateSerial(Year(minD), Month(minD) + 1, 0): out = 2
    Do While obs <= maxD
        s.Cells(out, 1).Value = obs
        For i = LBound(arr) To UBound(arr): s.Cells(out, i + 2).Value = LatestCash(c, CStr(arr(i)), obs): Next i
        obs = DateSerial(Year(DateAdd("m", 1, obs)), Month(DateAdd("m", 1, obs)) + 1, 0)
        out = out + 1
    Loop
    s.Cells(1, UBound(arr) + 4).Value = "Comments": s.Cells(2, UBound(arr) + 4).Value = "Month-end value panel using latest realized ending cash on or before each observation date."
End Sub

Private Function LatestCash(c As Worksheet, tenor As String, obs As Date) As Variant
    Dim r As Long, lr As Long, bd As Date, v
    lr = LastDataRow(c)
    For r = 2 To lr
        If CStr(c.Cells(r, 1).Value) = tenor And c.Cells(r, 6).Value <= obs And c.Cells(r, 6).Value >= bd Then
            bd = c.Cells(r, 6).Value: v = c.Cells(r, 12).Value
        End If
    Next r
    LatestCash = v
End Function

Private Sub BuildReturnPanel(wb As Workbook)
    Dim v As Worksheet, s As Worksheet, r As Long, c As Long, lr As Long, lc As Long
    Set v = wb.Worksheets("03_ValuePanel"): Set s = WS(wb, "04_ReturnPanel")
    lr = LastDataRow(v): lc = LastCol(v, 1)
    s.Range(s.Cells(1, 1), s.Cells(1, lc)).Value = v.Range(v.Cells(1, 1), v.Cells(1, lc)).Value
    For r = 3 To lr
        s.Cells(r - 1, 1).Value = v.Cells(r, 1).Value
        For c = 2 To lc
            If v.Cells(r - 1, c).Value > 0 And v.Cells(r, c).Value > 0 Then s.Cells(r - 1, c).Value = v.Cells(r, c).Value / v.Cells(r - 1, c).Value - 1
        Next c
    Next r
    s.Cells(1, lc + 2).Value = "Comments": s.Cells(2, lc + 2).Value = "Monthly observation returns from synchronized value panel."
End Sub

Private Sub BuildExcessPanel(wb As Workbook)
    Dim rws As Worksheet, s As Worksheet, onC As Long, r As Long, c As Long, o As Long, lr As Long, lc As Long
    Set rws = wb.Worksheets("04_ReturnPanel"): Set s = WS(wb, "05_ExcessVsON")
    onC = FindCol(rws, "ON"): lr = LastDataRow(rws): lc = LastCol(rws, 1)
    s.Cells(1, 1).Value = "observation_date"
    If onC = 0 Then s.Cells(2, 1).Value = "ON benchmark not found.": Exit Sub
    o = 2
    For c = 2 To lc
        If UCase$(CStr(rws.Cells(1, c).Value)) <> "ON" Then s.Cells(1, o).Value = rws.Cells(1, c).Value & " excess vs ON": o = o + 1
    Next c
    For r = 2 To lr
        s.Cells(r, 1).Value = rws.Cells(r, 1).Value: o = 2
        For c = 2 To lc
            If UCase$(CStr(rws.Cells(1, c).Value)) <> "ON" Then
                If IsNumeric(rws.Cells(r, c).Value) And IsNumeric(rws.Cells(r, onC).Value) Then s.Cells(r, o).Value = rws.Cells(r, c).Value - rws.Cells(r, onC).Value
                o = o + 1
            End If
        Next c
    Next r
    s.Cells(1, o + 1).Value = "Comments": s.Cells(2, o + 1).Value = "Incremental carry from terming out cash versus ON."
End Sub

Private Sub BuildRiskSummary(wb As Workbook, tenors As Object)
    Dim s As Worksheet, v As Worksheet, rws As Worksheet, c As Worksheet, arr, i As Long, o As Long, colV As Long, colR As Long, initV As Double, finV As Double, days As Double
    Set s = WS(wb, "06_RiskSummary"): Set v = wb.Worksheets("03_ValuePanel"): Set rws = wb.Worksheets("04_ReturnPanel"): Set c = wb.Worksheets("01_CleanRolls")
    arr = tenors.Keys
    s.Range("A1:Q1").Value = Array("tenor", "tenor_days", "roll_count", "avg_accrual_days", "avg_rate", "rate_change_vol", "worst_reset_change", "initial_value", "final_value", "annualized_return", "annualized_volatility", "ann_excess_vs_ON", "excess_vol_vs_ON", "information_ratio", "hit_ratio_vs_ON", "max_relative_drawdown_vs_ON", "comment")
    o = 2
    For i = LBound(arr) To UBound(arr)
        colV = FindCol(v, CStr(arr(i))): colR = FindCol(rws, CStr(arr(i)))
        initV = FirstVal(v, colV): finV = LastVal(v, colV): days = v.Cells(LastDataRow(v), 1).Value - v.Cells(2, 1).Value
        s.Cells(o, 1).Value = arr(i): s.Cells(o, 2).Value = TDays(CStr(arr(i)))
        s.Cells(o, 3).Value = CountTenor(c, CStr(arr(i))): s.Cells(o, 4).Value = AvgTenor(c, CStr(arr(i)), 9)
        s.Cells(o, 5).Value = AvgTenor(c, CStr(arr(i)), 7): s.Cells(o, 6).Value = ResetVol(c, CStr(arr(i))) * Sqr(12#)
        s.Cells(o, 7).Value = WorstReset(c, CStr(arr(i)))
        s.Cells(o, 8).Value = initV: s.Cells(o, 9).Value = finV
        If initV > 0 And finV > 0 And days > 0 Then s.Cells(o, 10).Value = (finV / initV) ^ (365# / days) - 1
        s.Cells(o, 11).Value = StDevCol(rws, colR) * Sqr(12#)
        If UCase$(CStr(arr(i))) <> "ON" And FindCol(rws, "ON") > 0 Then
            s.Cells(o, 12).Value = AvgDiff(rws, CStr(arr(i)), "ON") * 12#
            s.Cells(o, 13).Value = StDevDiff(rws, CStr(arr(i)), "ON") * Sqr(12#)
            If s.Cells(o, 13).Value <> 0 Then s.Cells(o, 14).Value = s.Cells(o, 12).Value / s.Cells(o, 13).Value
            s.Cells(o, 15).Value = HitRatio(rws, CStr(arr(i)), "ON")
            s.Cells(o, 16).Value = RelDD(v, CStr(arr(i)), "ON")
        End If
        s.Cells(o, 17).Value = "Interest-rate exposure summary: carry, reset risk, excess performance, WAM and drawdown."
        o = o + 1
    Next i
End Sub

Private Function FirstVal(ws As Worksheet, c As Long) As Double
    Dim r As Long: For r = 2 To LastDataRow(ws): If ws.Cells(r, c).Value > 0 Then FirstVal = ws.Cells(r, c).Value: Exit Function
    Next r
End Function
Private Function LastVal(ws As Worksheet, c As Long) As Double
    Dim r As Long: For r = LastDataRow(ws) To 2 Step -1: If ws.Cells(r, c).Value > 0 Then LastVal = ws.Cells(r, c).Value: Exit Function
    Next r
End Function
Private Function CountTenor(ws As Worksheet, t As String) As Long
    Dim r As Long: For r = 2 To LastDataRow(ws): If CStr(ws.Cells(r, 1).Value) = t Then CountTenor = CountTenor + 1
    Next r
End Function
Private Function AvgTenor(ws As Worksheet, t As String, c As Long) As Double
    Dim r As Long, n As Long, x As Double: For r = 2 To LastDataRow(ws): If CStr(ws.Cells(r, 1).Value) = t Then x = x + ws.Cells(r, c).Value: n = n + 1
    Next r: If n > 0 Then AvgTenor = x / n
End Function
Private Function ResetVol(ws As Worksheet, t As String) As Double
    Dim r As Long, n As Long, p, vals() As Double, cur As Double
    For r = 2 To LastDataRow(ws): If CStr(ws.Cells(r, 1).Value) = t Then cur = ws.Cells(r, 7).Value: If Not IsEmpty(p) Then ReDim Preserve vals(0 To n): vals(n) = cur - CDbl(p): n = n + 1
    p = cur
    End If: Next r: If n > 1 Then ResetVol = WorksheetFunction.StDev_S(vals)
End Function
Private Function WorstReset(ws As Worksheet, t As String) As Double
    Dim r As Long, p, cur As Double, d As Double, ok As Boolean
    For r = 2 To LastDataRow(ws): If CStr(ws.Cells(r, 1).Value) = t Then cur = ws.Cells(r, 7).Value: If Not IsEmpty(p) Then d = cur - CDbl(p): If Not ok Or d < WorstReset Then WorstReset = d: ok = True
    p = cur
    End If: Next r
End Function
Private Function StDevCol(ws As Worksheet, c As Long) As Double
    Dim r As Long, n As Long, vals() As Double: If c = 0 Then Exit Function
    For r = 2 To LastDataRow(ws): If IsNumeric(ws.Cells(r, c).Value) And Len(ws.Cells(r, c).Value) > 0 Then ReDim Preserve vals(0 To n): vals(n) = ws.Cells(r, c).Value: n = n + 1
    Next r: If n > 1 Then StDevCol = WorksheetFunction.StDev_S(vals)
End Function
Private Function AvgDiff(ws As Worksheet, a As String, b As String) As Double
    Dim ca As Long, cb As Long, r As Long, n As Long, x As Double: ca = FindCol(ws, a): cb = FindCol(ws, b)
    For r = 2 To LastDataRow(ws): If IsNumeric(ws.Cells(r, ca).Value) And IsNumeric(ws.Cells(r, cb).Value) Then x = x + ws.Cells(r, ca).Value - ws.Cells(r, cb).Value: n = n + 1
    Next r: If n > 0 Then AvgDiff = x / n
End Function
Private Function StDevDiff(ws As Worksheet, a As String, b As String) As Double
    Dim ca As Long, cb As Long, r As Long, n As Long, vals() As Double: ca = FindCol(ws, a): cb = FindCol(ws, b)
    For r = 2 To LastDataRow(ws): If IsNumeric(ws.Cells(r, ca).Value) And IsNumeric(ws.Cells(r, cb).Value) Then ReDim Preserve vals(0 To n): vals(n) = ws.Cells(r, ca).Value - ws.Cells(r, cb).Value: n = n + 1
    Next r: If n > 1 Then StDevDiff = WorksheetFunction.StDev_S(vals)
End Function
Private Function HitRatio(ws As Worksheet, a As String, b As String) As Double
    Dim ca As Long, cb As Long, r As Long, n As Long, win As Long: ca = FindCol(ws, a): cb = FindCol(ws, b)
    For r = 2 To LastDataRow(ws): If IsNumeric(ws.Cells(r, ca).Value) And IsNumeric(ws.Cells(r, cb).Value) Then If ws.Cells(r, ca).Value > ws.Cells(r, cb).Value Then win = win + 1
    n = n + 1
    Next r: If n > 0 Then HitRatio = win / n
End Function
Private Function RelDD(ws As Worksheet, a As String, b As String) As Double
    Dim ca As Long, cb As Long, r As Long, rel As Double, peak As Double, ok As Boolean, dd As Double
    ca = FindCol(ws, a): cb = FindCol(ws, b)
    For r = 2 To LastDataRow(ws)
        If IsNumeric(ws.Cells(r, ca).Value) And IsNumeric(ws.Cells(r, cb).Value) Then
            rel = ws.Cells(r, ca).Value - ws.Cells(r, cb).Value
            If Not ok Then peak = rel: ok = True Else If rel > peak Then peak = rel
            dd = rel - peak: If dd < RelDD Then RelDD = dd
        End If
    Next r
End Function

Private Sub BuildFrontier(wb As Workbook, tenors As Object)
    Dim s As Worksheet, rws As Worksheet, arr, n As Long, i As Long, sim As Long, o As Long, w() As Double, sumW As Double, wam As Double, pr As Double, pv As Double, pe As Double
    Set s = WS(wb, "07_EfficientFrontier"): Set rws = wb.Worksheets("04_ReturnPanel")
    arr = tenors.Keys: n = tenors.Count: ReDim w(0 To n - 1)
    s.Cells(1, 1).Value = "simulation"
    For i = 0 To n - 1: s.Cells(1, i + 2).Value = "w_" & arr(i): Next i
    s.Cells(1, n + 2).Value = "ann_return": s.Cells(1, n + 3).Value = "ann_volatility": s.Cells(1, n + 4).Value = "WAM_days": s.Cells(1, n + 5).Value = "ann_excess_vs_ON": s.Cells(1, n + 6).Value = "constraint_flag": s.Cells(1, n + 7).Value = "comment"
    Randomize 17: o = 2
    For sim = 1 To FRONTIER_SIMS
        sumW = 0: For i = 0 To n - 1: w(i) = Rnd(): sumW = sumW + w(i): Next i
        wam = 0: For i = 0 To n - 1: w(i) = w(i) / sumW: s.Cells(o, i + 2).Value = w(i): wam = wam + w(i) * TDays(CStr(arr(i))): Next i
        pr = PortAvg(rws, arr, w) * 12#: pv = PortVol(rws, arr, w) * Sqr(12#): pe = PortExcess(rws, arr, w) * 12#
        s.Cells(o, 1).Value = sim: s.Cells(o, n + 2).Value = pr: s.Cells(o, n + 3).Value = pv: s.Cells(o, n + 4).Value = wam: s.Cells(o, n + 5).Value = pe
        s.Cells(o, n + 6).Value = IIf(PassRules(arr, w, wam), "Liquidity constrained", "Unconstrained only")
        s.Cells(o, n + 7).Value = "Random portfolio for efficient-frontier scatter. Filter by constraint flag."
        o = o + 1
    Next sim
End Sub
Private Function PortAvg(ws As Worksheet, arr, w() As Double) As Double
    Dim r As Long, i As Long, n As Long, rowR As Double, ok As Boolean, c As Long
    For r = 2 To LastDataRow(ws): rowR = 0: ok = True
        For i = LBound(arr) To UBound(arr): c = FindCol(ws, CStr(arr(i))): If Not IsNumeric(ws.Cells(r, c).Value) Then ok = False Else rowR = rowR + w(i) * ws.Cells(r, c).Value
        Next i
        If ok Then PortAvg = PortAvg + rowR: n = n + 1
    Next r: If n > 0 Then PortAvg = PortAvg / n
End Function
Private Function PortVol(ws As Worksheet, arr, w() As Double) As Double
    Dim r As Long, i As Long, n As Long, vals() As Double, rowR As Double, ok As Boolean, c As Long
    For r = 2 To LastDataRow(ws): rowR = 0: ok = True
        For i = LBound(arr) To UBound(arr): c = FindCol(ws, CStr(arr(i))): If Not IsNumeric(ws.Cells(r, c).Value) Then ok = False Else rowR = rowR + w(i) * ws.Cells(r, c).Value
        Next i
        If ok Then ReDim Preserve vals(0 To n): vals(n) = rowR: n = n + 1
    Next r: If n > 1 Then PortVol = WorksheetFunction.StDev_S(vals)
End Function
Private Function PortExcess(ws As Worksheet, arr, w() As Double) As Double
    Dim onC As Long, r As Long, i As Long, n As Long, rowR As Double, ok As Boolean, c As Long
    onC = FindCol(ws, "ON"): If onC = 0 Then Exit Function
    For r = 2 To LastDataRow(ws): rowR = 0: ok = True
        For i = LBound(arr) To UBound(arr): c = FindCol(ws, CStr(arr(i))): If Not IsNumeric(ws.Cells(r, c).Value) Then ok = False Else rowR = rowR + w(i) * ws.Cells(r, c).Value
        Next i
        If ok And IsNumeric(ws.Cells(r, onC).Value) Then PortExcess = PortExcess + rowR - ws.Cells(r, onC).Value: n = n + 1
    Next r: If n > 0 Then PortExcess = PortExcess / n
End Function
Private Function PassRules(arr, w() As Double, wam As Double) As Boolean
    Dim i As Long, onW As Double, w6 As Double, hasON As Boolean, has6 As Boolean
    PassRules = True
    For i = LBound(arr) To UBound(arr)
        If UCase$(CStr(arr(i))) = "ON" Then onW = w(i): hasON = True
        If UCase$(CStr(arr(i))) = "6M" Then w6 = w(i): has6 = True
    Next i
    If wam > MAX_WAM_DAYS Then PassRules = False
    If hasON And onW < MIN_ON_WGT Then PassRules = False
    If has6 And w6 > MAX_6M_WGT Then PassRules = False
End Function

Private Sub BuildStress(wb As Workbook, tenors As Object)
    Dim s As Worksheet, c As Worksheet, arr, scen, i As Long, j As Long, o As Long, t As String, avgR As Double, sh As Double
    Set s = WS(wb, "08_StressScenarios"): Set c = wb.Worksheets("01_CleanRolls")
    arr = tenors.Keys: scen = Array("Base historical average", "Parallel +100bp", "Parallel -100bp", "Front-end down / term stable", "Front-end up / term stable", "Curve steepening", "Curve flattening")
    s.Range("A1:F1").Value = Array("scenario", "tenor", "historical_avg_rate", "shock", "scenario_rate_proxy", "comment")
    o = 2
    For i = LBound(scen) To UBound(scen)
        For j = LBound(arr) To UBound(arr)
            t = CStr(arr(j)): avgR = AvgTenor(c, t, 7): sh = Shock(CStr(scen(i)), t)
            s.Cells(o, 1).Value = scen(i): s.Cells(o, 2).Value = t: s.Cells(o, 3).Value = avgR: s.Cells(o, 4).Value = sh: s.Cells(o, 5).Value = avgR + sh
            s.Cells(o, 6).Value = "Proxy sensitivity, not forecast. Recompute rolls with a projected curve for full scenario valuation."
            o = o + 1
        Next j
    Next i
End Sub
Private Function Shock(scen As String, t As String) As Double
    Dim d As Double: d = TDays(t)
    Select Case scen
        Case "Parallel +100bp": Shock = 0.01
        Case "Parallel -100bp": Shock = -0.01
        Case "Front-end down / term stable": If d <= 30 Then Shock = -0.01 Else Shock = -0.0025
        Case "Front-end up / term stable": If d <= 30 Then Shock = 0.01 Else Shock = 0.0025
        Case "Curve steepening": Shock = (d / 180#) * 0.0075
        Case "Curve flattening": Shock = 0.0075 - (d / 180#) * 0.0075
    End Select
End Function

Private Sub BuildDashboard(wb As Workbook, tenors As Object)
    Dim s As Worksheet: Set s = WS(wb, "09_Dashboard")
    s.Range("A1").Value = "risk01 Dashboard"
    s.Range("A3").Value = "Core use": s.Range("B3").Value = "Evaluate interest-rate risk exposure, not just return ranking."
    s.Range("A5").Value = "Detected tenors": s.Range("B5").Value = JoinKeys(tenors, ", ")
    s.Range("A7").Value = "Main outputs": s.Range("B7").Value = "Rate history, return panel, excess vs ON, risk summary, frontier simulations, stress scenarios."
    s.Range("A9").Value = "Recommended chart": s.Range("B9").Value = "In 07_EfficientFrontier, create scatter: X = ann_volatility, Y = ann_return, filter = constraint_flag."
    s.Range("A11").Value = "Recommended chart": s.Range("B11").Value = "In 05_ExcessVsON, create line chart to show monthly excess carry versus ON."
End Sub

Private Sub FormatOutputs(wb As Workbook)
    Dim x As Worksheet
    For Each x In wb.Worksheets
        If Left$(x.Name, 2) Like "##" Then
            x.Rows(1).Font.Bold = True
            x.Rows(1).Interior.Color = RGB(217, 225, 242)
            x.Cells.Font.Name = "Calibri": x.Cells.Font.Size = 10
            x.Columns.AutoFit
        End If
    Next x
End Sub
