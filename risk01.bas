Attribute VB_Name = "risk01"
Option Explicit

' risk01.bas
' Interest-rate risk exposure engine for roll-level cash / term-deposit data.
'
' Input sheet required: Detail
' Required logical columns:
' tenor, roll number, investment start date, rate date used,
' maturity target date, actual end date, rate, accrual days,
' starting cash, interest earned, ending cash
'
' Main macro: RunRisk01Analysis
'
' The code is intentionally unbiased. It does not assume a winning tenor.
' It reads whatever tenors exist in Detail and builds analysis tabs from them.

Private Const SRC_SHEET As String = "Detail"
Private Const N_FRONTIER As Long = 2500
Private Const MAX_WAM As Double = 90
Private Const MIN_ON As Double = 0.2
Private Const MAX_6M As Double = 0.25

Public Sub RunRisk01Analysis()
    Dim wb As Workbook
    Dim wsD As Worksheet
    Dim hRow As Long
    Dim lastRow As Long
    Dim tenors As Object
    
    On Error GoTo Fail
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    Application.Calculation = xlCalculationManual
    
    Set wb = ThisWorkbook
    Set wsD = SafeSheet(wb, SRC_SHEET)
    If wsD Is Nothing Then Err.Raise 1001, , "Sheet 'Detail' was not found."
    
    hRow = FindHeaderRow(wsD)
    If hRow = 0 Then Err.Raise 1002, , "Could not find the header row."
    
    lastRow = LastUsedRow(wsD)
    If lastRow <= hRow Then Err.Raise 1003, , "No data rows found in Detail."
    
    DeleteRiskTabs wb
    BuildReadMe wb
    Set tenors = BuildCleanRolls(wb, wsD, hRow, lastRow)
    BuildRatePanel wb, tenors
    BuildValuePanel wb, tenors
    BuildReturnPanel wb
    BuildExcessPanel wb
    BuildRiskSummary wb, tenors
    BuildRegimePanel wb
    BuildFrontier wb, tenors
    BuildStressPanel wb, tenors
    BuildDashboard wb, tenors
    FormatRiskTabs wb
    
    MsgBox "risk01 completed." & vbCrLf & _
           "Tenors detected: " & JoinKeys(tenors), _
           vbInformation, "risk01"

CleanExit:
    Application.Calculation = xlCalculationAutomatic
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    Exit Sub

Fail:
    MsgBox "risk01 failed: " & Err.Description, vbCritical, "risk01"
    Resume CleanExit
End Sub

' =========================================================
' Basic workbook helpers
' =========================================================

Private Function SafeSheet(ByVal wb As Workbook, ByVal nm As String) As Worksheet
    On Error Resume Next
    Set SafeSheet = wb.Worksheets(nm)
    On Error GoTo 0
End Function

Private Function MakeSheet(ByVal wb As Workbook, ByVal nm As String) As Worksheet
    Dim ws As Worksheet
    Set ws = SafeSheet(wb, nm)
    If ws Is Nothing Then
        Set ws = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        ws.Name = nm
    Else
        ws.Cells.Clear
    End If
    Set MakeSheet = ws
End Function

Private Function LastUsedRow(ByVal ws As Worksheet) As Long
    Dim f As Range
    Set f = ws.Cells.Find(What:="*", LookIn:=xlFormulas, _
                          SearchOrder:=xlByRows, _
                          SearchDirection:=xlPrevious)
    If f Is Nothing Then
        LastUsedRow = 0
    Else
        LastUsedRow = f.Row
    End If
End Function

Private Sub DeleteRiskTabs(ByVal wb As Workbook)
    Dim arr As Variant
    Dim i As Long
    Dim ws As Worksheet
    arr = Array("00_ReadMe", "01_CleanRolls", "02_RatePanel", _
                "03_ValuePanel", "04_ReturnPanel", "05_ExcessVsON", _
                "06_RiskSummary", "07_RegimeAnalysis", _
                "08_EfficientFrontier", "09_StressScenarios", _
                "10_Dashboard")
    For i = LBound(arr) To UBound(arr)
        Set ws = SafeSheet(wb, CStr(arr(i)))
        If Not ws Is Nothing Then ws.Delete
    Next i
End Sub

Private Function CleanHeader(ByVal txt As String) As String
    txt = LCase$(Trim$(txt))
    txt = Replace(txt, " ", "")
    txt = Replace(txt, "_", "")
    txt = Replace(txt, "-", "")
    txt = Replace(txt, "/", "")
    txt = Replace(txt, ".", "")
    CleanHeader = txt
End Function

Private Function FindHeaderRow(ByVal ws As Worksheet) As Long
    Dim r As Long
    Dim c As Long
    Dim lastCol As Long
    Dim hasTenor As Boolean
    Dim hasRate As Boolean
    Dim hasEndCash As Boolean
    Dim key As String
    
    For r = 1 To 20
        lastCol = ws.Cells(r, ws.Columns.Count).End(xlToLeft).Column
        hasTenor = False
        hasRate = False
        hasEndCash = False
        For c = 1 To lastCol
            key = CleanHeader(CStr(ws.Cells(r, c).Value))
            If key = "tenor" Then hasTenor = True
            If key = "rate" Or key = "ratedateused" Then hasRate = True
            If key = "endingcash" Then hasEndCash = True
        Next c
        If hasTenor And hasRate And hasEndCash Then
            FindHeaderRow = r
            Exit Function
        End If
    Next r
End Function

Private Function HeaderMap(ByVal ws As Worksheet, ByVal hRow As Long) As Object
    Dim d As Object
    Dim c As Long
    Dim lastCol As Long
    Dim key As String
    Set d = CreateObject("Scripting.Dictionary")
    lastCol = ws.Cells(hRow, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastCol
        key = CleanHeader(CStr(ws.Cells(hRow, c).Value))
        If Len(key) > 0 Then d(key) = c
    Next c
    Set HeaderMap = d
End Function

Private Function HeaderCol(ByVal h As Object, ParamArray names() As Variant) As Long
    Dim i As Long
    Dim key As String
    For i = LBound(names) To UBound(names)
        key = CleanHeader(CStr(names(i)))
        If h.Exists(key) Then
            HeaderCol = CLng(h(key))
            Exit Function
        End If
    Next i
End Function

Private Function ToNumber(ByVal v As Variant) As Double
    Dim s As String
    Dim pct As Boolean
    If IsError(v) Or IsEmpty(v) Then Exit Function
    If IsNumeric(v) Then
        ToNumber = CDbl(v)
        Exit Function
    End If
    s = Trim$(CStr(v))
    pct = (InStr(1, s, "%", vbTextCompare) > 0)
    s = Replace(s, "$", "")
    s = Replace(s, ",", "")
    s = Replace(s, "%", "")
    s = Replace(s, "(", "-")
    s = Replace(s, ")", "")
    If Len(s) = 0 Then Exit Function
    If IsNumeric(s) Then
        ToNumber = CDbl(s)
        If pct Then ToNumber = ToNumber / 100#
    End If
End Function

Private Function ToDateValue(ByVal v As Variant) As Date
    If IsDate(v) Then ToDateValue = CDate(v)
End Function

Private Function DaysForTenor(ByVal tenor As String) As Double
    Dim t As String
    t = UCase$(Trim$(tenor))
    If t = "ON" Or t = "O/N" Or t = "OVERNIGHT" Then
        DaysForTenor = 1
    ElseIf Right$(t, 1) = "M" Then
        If IsNumeric(Left$(t, Len(t) - 1)) Then
            DaysForTenor = CDbl(Left$(t, Len(t) - 1)) * 30#
        End If
    ElseIf Right$(t, 1) = "Y" Then
        If IsNumeric(Left$(t, Len(t) - 1)) Then
            DaysForTenor = CDbl(Left$(t, Len(t) - 1)) * 365#
        End If
    End If
    If DaysForTenor = 0 Then DaysForTenor = 30#
End Function

Private Function MonthEnd(ByVal d As Date) As Date
    MonthEnd = DateSerial(Year(d), Month(d) + 1, 0)
End Function

Private Function JoinKeys(ByVal d As Object) As String
    Dim k As Variant
    Dim s As String
    For Each k In d.Keys
        If Len(s) > 0 Then s = s & ", "
        s = s & CStr(k)
    Next k
    JoinKeys = s
End Function

' =========================================================
' 00 ReadMe
' =========================================================

Private Sub BuildReadMe(ByVal wb As Workbook)
    Dim ws As Worksheet
    Set ws = MakeSheet(wb, "00_ReadMe")
    ws.Range("A1").Value = "risk01 - Interest Rate Risk Exposure Analysis"
    ws.Range("A3").Value = "Purpose"
    ws.Range("B3").Value = "Analyze historical interest-rate exposure for rolling cash and term-deposit strategies."
    ws.Range("A5").Value = "Input"
    ws.Range("B5").Value = "Place roll-level data in a worksheet named Detail. Header names are matched flexibly."
    ws.Range("A7").Value = "Core idea"
    ws.Range("B7").Value = "The model studies rates, reinvestment risk, excess carry versus ON, liquidity lockup, WAM, frontier simulations, and stress scenarios."
    ws.Range("A9").Value = "Unbiased approach"
    ws.Range("B9").Value = "The macro detects tenors dynamically. It does not assume a best tenor or a specific curve shape."
    ws.Range("A11").Value = "Main macro"
    ws.Range("B11").Value = "RunRisk01Analysis"
End Sub

' =========================================================
' 01 CleanRolls
' =========================================================

Private Function BuildCleanRolls(ByVal wb As Workbook, _
                                 ByVal wsD As Worksheet, _
                                 ByVal hRow As Long, _
                                 ByVal lastRow As Long) As Object
    Dim ws As Worksheet
    Dim h As Object
    Dim tDict As Object
    Dim cTenor As Long, cRoll As Long, cStart As Long
    Dim cRateDate As Long, cTarget As Long, cEnd As Long
    Dim cRate As Long, cDays As Long, cStartCash As Long
    Dim cInterest As Long, cEndCash As Long
    Dim r As Long, o As Long
    Dim t As String
    Dim ds As Date, dr As Date, dt As Date, de As Date
    Dim rt As Double, days As Double, sc As Double
    Dim intAmt As Double, ec As Double
    Dim rollRet As Double
    
    Set ws = MakeSheet(wb, "01_CleanRolls")
    Set h = HeaderMap(wsD, hRow)
    Set tDict = CreateObject("Scripting.Dictionary")
    
    cTenor = HeaderCol(h, "tenor")
    cRoll = HeaderCol(h, "roll number", "rollnumber")
    cStart = HeaderCol(h, "investment start date", "investmentstartdate")
    cRateDate = HeaderCol(h, "rate date used", "ratedateused")
    cTarget = HeaderCol(h, "maturity target date", "maturitytargetdate")
    cEnd = HeaderCol(h, "actual end date", "actualenddate")
    cRate = HeaderCol(h, "rate")
    cDays = HeaderCol(h, "accrual days", "accrualdays")
    cStartCash = HeaderCol(h, "starting cash", "startingcash")
    cInterest = HeaderCol(h, "interest earned", "interestearned")
    cEndCash = HeaderCol(h, "ending cash", "endingcash")
    
    If cTenor = 0 Or cStart = 0 Or cRateDate = 0 Then GoTo MissingCols
    If cEnd = 0 Or cRate = 0 Or cDays = 0 Then GoTo MissingCols
    If cStartCash = 0 Or cInterest = 0 Or cEndCash = 0 Then GoTo MissingCols
    
    ws.Cells(1, 1).Value = "tenor"
    ws.Cells(1, 2).Value = "roll_number"
    ws.Cells(1, 3).Value = "investment_start_date"
    ws.Cells(1, 4).Value = "rate_date_used"
    ws.Cells(1, 5).Value = "maturity_target_date"
    ws.Cells(1, 6).Value = "actual_end_date"
    ws.Cells(1, 7).Value = "rate_decimal"
    ws.Cells(1, 8).Value = "rate_pct"
    ws.Cells(1, 9).Value = "accrual_days"
    ws.Cells(1, 10).Value = "starting_cash"
    ws.Cells(1, 11).Value = "interest_earned"
    ws.Cells(1, 12).Value = "ending_cash"
    ws.Cells(1, 13).Value = "roll_return"
    ws.Cells(1, 14).Value = "annualized_roll_return"
    ws.Cells(1, 15).Value = "tenor_days"
    ws.Cells(1, 17).Value = "Comments"
    ws.Cells(2, 17).Value = "Cleaned roll ledger. One row equals one completed roll."
    ws.Cells(3, 17).Value = "Rates and cash values are converted to numeric values."
    
    o = 2
    For r = hRow + 1 To lastRow
        t = UCase$(Trim$(CStr(wsD.Cells(r, cTenor).Value)))
        If Len(t) > 0 Then
            ds = ToDateValue(wsD.Cells(r, cStart).Value)
            dr = ToDateValue(wsD.Cells(r, cRateDate).Value)
            If cTarget > 0 Then dt = ToDateValue(wsD.Cells(r, cTarget).Value)
            de = ToDateValue(wsD.Cells(r, cEnd).Value)
            rt = ToNumber(wsD.Cells(r, cRate).Value)
            If rt > 1 Then rt = rt / 100#
            days = ToNumber(wsD.Cells(r, cDays).Value)
            sc = ToNumber(wsD.Cells(r, cStartCash).Value)
            intAmt = ToNumber(wsD.Cells(r, cInterest).Value)
            ec = ToNumber(wsD.Cells(r, cEndCash).Value)
            If ds > 0 And de > 0 And sc > 0 And ec > 0 Then
                If Not tDict.Exists(t) Then tDict.Add t, t
                rollRet = ec / sc - 1#
                ws.Cells(o, 1).Value = t
                If cRoll > 0 Then
                    ws.Cells(o, 2).Value = wsD.Cells(r, cRoll).Value
                Else
                    ws.Cells(o, 2).Value = o - 1
                End If
                ws.Cells(o, 3).Value = ds
                ws.Cells(o, 4).Value = dr
                If dt > 0 Then ws.Cells(o, 5).Value = dt
                ws.Cells(o, 6).Value = de
                ws.Cells(o, 7).Value = rt
                ws.Cells(o, 8).Value = rt
                ws.Cells(o, 9).Value = days
                ws.Cells(o, 10).Value = sc
                ws.Cells(o, 11).Value = intAmt
                ws.Cells(o, 12).Value = ec
                ws.Cells(o, 13).Value = rollRet
                If days > 0 Then
                    ws.Cells(o, 14).Value = (1# + rollRet) ^ (365# / days) - 1#
                End If
                ws.Cells(o, 15).Value = DaysForTenor(t)
                o = o + 1
            End If
        End If
    Next r
    
    If tDict.Count = 0 Then Err.Raise 1005, , "No valid rows were created."
    ws.Columns.AutoFit
    ws.Range("C:F").NumberFormat = "yyyy-mm-dd"
    ws.Range("G:H,M:N").NumberFormat = "0.0000%"
    ws.Range("J:L").NumberFormat = "$#,##0.00"
    Set BuildCleanRolls = tDict
    Exit Function

MissingCols:
    Err.Raise 1004, , "Missing required columns in Detail."
End Function

' =========================================================
' 02 RatePanel
' =========================================================

Private Sub BuildRatePanel(ByVal wb As Workbook, ByVal tenors As Object)
    Dim wsC As Worksheet, ws As Worksheet
    Dim lastRow As Long, r As Long, c As Long, o As Long
    Dim dates As Object, rates As Object
    Dim k As Variant, dateKey As String, key As String
    Dim arr() As Date, i As Long, j As Long, temp As Date
    Dim tList As Variant, t As String
    
    Set wsC = wb.Worksheets("01_CleanRolls")
    Set ws = MakeSheet(wb, "02_RatePanel")
    Set dates = CreateObject("Scripting.Dictionary")
    Set rates = CreateObject("Scripting.Dictionary")
    tList = tenors.Keys
    lastRow = LastUsedRow(wsC)
    
    For r = 2 To lastRow
        If IsDate(wsC.Cells(r, 4).Value) Then
            dateKey = CStr(CLng(CDate(wsC.Cells(r, 4).Value)))
            t = CStr(wsC.Cells(r, 1).Value)
            If Not dates.Exists(dateKey) Then dates.Add dateKey, CDate(wsC.Cells(r, 4).Value)
            rates(dateKey & "|" & t) = wsC.Cells(r, 7).Value
        End If
    Next r
    If dates.Count = 0 Then Exit Sub
    
    ReDim arr(0 To dates.Count - 1)
    i = 0
    For Each k In dates.Keys
        arr(i) = dates(k)
        i = i + 1
    Next k
    SortDates arr
    
    ws.Cells(1, 1).Value = "rate_date"
    For c = LBound(tList) To UBound(tList)
        ws.Cells(1, c + 2).Value = tList(c)
    Next c
    
    o = 2
    For i = LBound(arr) To UBound(arr)
        ws.Cells(o, 1).Value = arr(i)
        dateKey = CStr(CLng(arr(i)))
        For c = LBound(tList) To UBound(tList)
            key = dateKey & "|" & CStr(tList(c))
            If rates.Exists(key) Then ws.Cells(o, c + 2).Value = rates(key)
        Next c
        o = o + 1
    Next i
    
    ws.Cells(1, 8).Value = "Comments"
    ws.Cells(2, 8).Value = "Historical rates by tenor and rate date."
    ws.Cells(3, 8).Value = "Blanks mean the tenor did not reset on that date."
    ws.Columns.AutoFit
    ws.Columns(1).NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(o, UBound(tList) + 2)).NumberFormat = "0.0000%"
End Sub

Private Sub SortDates(ByRef arr() As Date)
    Dim i As Long, j As Long
    Dim tmp As Date
    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(j) < arr(i) Then
                tmp = arr(i)
                arr(i) = arr(j)
                arr(j) = tmp
            End If
        Next j
    Next i
End Sub

' =========================================================
' 03 ValuePanel
' =========================================================

Private Sub BuildValuePanel(ByVal wb As Workbook, ByVal tenors As Object)
    Dim wsC As Worksheet, ws As Worksheet
    Dim tList As Variant
    Dim lastRow As Long, r As Long, c As Long, o As Long
    Dim minD As Date, maxD As Date, obsD As Date
    Dim v As Variant
    
    Set wsC = wb.Worksheets("01_CleanRolls")
    Set ws = MakeSheet(wb, "03_ValuePanel")
    tList = tenors.Keys
    lastRow = LastUsedRow(wsC)
    minD = CDate(Application.WorksheetFunction.Min(wsC.Range("F2:F" & lastRow)))
    maxD = CDate(Application.WorksheetFunction.Max(wsC.Range("F2:F" & lastRow)))
    
    ws.Cells(1, 1).Value = "observation_date"
    For c = LBound(tList) To UBound(tList)
        ws.Cells(1, c + 2).Value = tList(c)
    Next c
    
    obsD = MonthEnd(minD)
    o = 2
    Do While obsD <= maxD
        ws.Cells(o, 1).Value = obsD
        For c = LBound(tList) To UBound(tList)
            v = LastCashOnDate(wsC, lastRow, CStr(tList(c)), obsD)
            If Not IsEmpty(v) Then ws.Cells(o, c + 2).Value = v
        Next c
        obsD = MonthEnd(DateAdd("m", 1, obsD))
        o = o + 1
    Loop
    
    If ws.Cells(o - 1, 1).Value <> maxD Then
        ws.Cells(o, 1).Value = maxD
        For c = LBound(tList) To UBound(tList)
            v = LastCashOnDate(wsC, lastRow, CStr(tList(c)), maxD)
            If Not IsEmpty(v) Then ws.Cells(o, c + 2).Value = v
        Next c
    End If
    
    ws.Cells(1, 8).Value = "Comments"
    ws.Cells(2, 8).Value = "Common monthly value panel."
    ws.Cells(3, 8).Value = "Uses latest realized ending cash on or before each observation date."
    ws.Columns.AutoFit
    ws.Columns(1).NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(o, UBound(tList) + 2)).NumberFormat = "$#,##0.00"
End Sub

Private Function LastCashOnDate(ByVal wsC As Worksheet, _
                                ByVal lastRow As Long, _
                                ByVal tenor As String, _
                                ByVal obsDate As Date) As Variant
    Dim r As Long
    Dim bestD As Date
    Dim val As Variant
    For r = 2 To lastRow
        If CStr(wsC.Cells(r, 1).Value) = tenor Then
            If IsDate(wsC.Cells(r, 6).Value) Then
                If CDate(wsC.Cells(r, 6).Value) <= obsDate Then
                    If CDate(wsC.Cells(r, 6).Value) >= bestD Then
                        bestD = CDate(wsC.Cells(r, 6).Value)
                        val = wsC.Cells(r, 12).Value
                    End If
                End If
            End If
        End If
    Next r
    LastCashOnDate = val
End Function

' =========================================================
' 04 ReturnPanel
' =========================================================

Private Sub BuildReturnPanel(ByVal wb As Workbook)
    Dim wsV As Worksheet, ws As Worksheet
    Dim r As Long, c As Long
    Dim lastRow As Long, lastCol As Long
    
    Set wsV = wb.Worksheets("03_ValuePanel")
    Set ws = MakeSheet(wb, "04_ReturnPanel")
    lastRow = LastUsedRow(wsV)
    lastCol = wsV.Cells(1, wsV.Columns.Count).End(xlToLeft).Column
    
    ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).Value = _
        wsV.Range(wsV.Cells(1, 1), wsV.Cells(1, lastCol)).Value
    
    For r = 3 To lastRow
        ws.Cells(r - 1, 1).Value = wsV.Cells(r, 1).Value
        For c = 2 To lastCol
            If IsNumeric(wsV.Cells(r - 1, c).Value) Then
                If IsNumeric(wsV.Cells(r, c).Value) Then
                    If wsV.Cells(r - 1, c).Value > 0 Then
                        ws.Cells(r - 1, c).Value = _
                            wsV.Cells(r, c).Value / wsV.Cells(r - 1, c).Value - 1#
                    End If
                End If
            End If
        Next c
    Next r
    
    ws.Cells(1, 8).Value = "Comments"
    ws.Cells(2, 8).Value = "Monthly returns from the value panel."
    ws.Cells(3, 8).Value = "This table drives risk metrics and frontier simulations."
    ws.Columns.AutoFit
    ws.Columns(1).NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, lastCol)).NumberFormat = "0.0000%"
End Sub

' =========================================================
' 05 Excess Vs ON
' =========================================================

Private Sub BuildExcessPanel(ByVal wb As Workbook)
    Dim wsR As Worksheet, ws As Worksheet
    Dim r As Long, c As Long, outC As Long
    Dim lastRow As Long, lastCol As Long, onCol As Long
    
    Set wsR = wb.Worksheets("04_ReturnPanel")
    Set ws = MakeSheet(wb, "05_ExcessVsON")
    lastRow = LastUsedRow(wsR)
    lastCol = wsR.Cells(1, wsR.Columns.Count).End(xlToLeft).Column
    onCol = ColumnInRow(wsR, 1, "ON")
    
    ws.Cells(1, 1).Value = "observation_date"
    If onCol = 0 Then
        ws.Cells(2, 1).Value = "ON not found. Excess analysis not calculated."
        Exit Sub
    End If
    
    outC = 2
    For c = 2 To lastCol
        If UCase$(CStr(wsR.Cells(1, c).Value)) <> "ON" Then
            ws.Cells(1, outC).Value = CStr(wsR.Cells(1, c).Value) & " excess vs ON"
            outC = outC + 1
        End If
    Next c
    
    For r = 2 To lastRow
        ws.Cells(r, 1).Value = wsR.Cells(r, 1).Value
        outC = 2
        For c = 2 To lastCol
            If UCase$(CStr(wsR.Cells(1, c).Value)) <> "ON" Then
                If IsNumeric(wsR.Cells(r, c).Value) Then
                    If IsNumeric(wsR.Cells(r, onCol).Value) Then
                        ws.Cells(r, outC).Value = _
                            wsR.Cells(r, c).Value - wsR.Cells(r, onCol).Value
                    End If
                End If
                outC = outC + 1
            End If
        Next c
    Next r
    
    ws.Cells(1, 8).Value = "Comments"
    ws.Cells(2, 8).Value = "Excess carry versus ON benchmark."
    ws.Cells(3, 8).Value = "Positive value means terming out beat ON in that period."
    ws.Columns.AutoFit
    ws.Columns(1).NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, outC)).NumberFormat = "0.0000%"
End Sub

Private Function ColumnInRow(ByVal ws As Worksheet, _
                             ByVal rowNum As Long, _
                             ByVal txt As String) As Long
    Dim c As Long
    Dim lastCol As Long
    lastCol = ws.Cells(rowNum, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastCol
        If UCase$(Trim$(CStr(ws.Cells(rowNum, c).Value))) = UCase$(Trim$(txt)) Then
            ColumnInRow = c
            Exit Function
        End If
    Next c
End Function

' =========================================================
' 06 Risk Summary
' =========================================================

Private Sub BuildRiskSummary(ByVal wb As Workbook, ByVal tenors As Object)
    Dim ws As Worksheet, wsV As Worksheet, wsR As Worksheet, wsC As Worksheet
    Dim tList As Variant
    Dim i As Long, o As Long, c As Long
    Dim lastV As Long, lastR As Long, lastC As Long
    Dim t As String, initV As Double, finalV As Double
    Dim totalDays As Double, annRet As Double, annVol As Double
    Dim exAvg As Variant, exVol As Variant, info As Variant
    Dim hit As Variant, relDD As Variant
    
    Set ws = MakeSheet(wb, "06_RiskSummary")
    Set wsV = wb.Worksheets("03_ValuePanel")
    Set wsR = wb.Worksheets("04_ReturnPanel")
    Set wsC = wb.Worksheets("01_CleanRolls")
    tList = tenors.Keys
    lastV = LastUsedRow(wsV)
    lastR = LastUsedRow(wsR)
    lastC = LastUsedRow(wsC)
    
    ws.Cells(1, 1).Value = "tenor"
    ws.Cells(1, 2).Value = "tenor_days"
    ws.Cells(1, 3).Value = "roll_count"
    ws.Cells(1, 4).Value = "avg_accrual_days"
    ws.Cells(1, 5).Value = "avg_rate"
    ws.Cells(1, 6).Value = "rate_reset_vol"
    ws.Cells(1, 7).Value = "worst_reset_change"
    ws.Cells(1, 8).Value = "initial_value"
    ws.Cells(1, 9).Value = "final_value"
    ws.Cells(1, 10).Value = "annualized_return"
    ws.Cells(1, 11).Value = "annualized_volatility"
    ws.Cells(1, 12).Value = "ann_excess_vs_ON"
    ws.Cells(1, 13).Value = "excess_vol_vs_ON"
    ws.Cells(1, 14).Value = "information_ratio"
    ws.Cells(1, 15).Value = "hit_ratio_vs_ON"
    ws.Cells(1, 16).Value = "max_relative_drawdown_vs_ON"
    
    o = 2
    For i = LBound(tList) To UBound(tList)
        t = CStr(tList(i))
        c = ColumnInRow(wsV, 1, t)
        If c > 0 Then
            initV = FirstNum(wsV, c, 2, lastV)
            finalV = LastNum(wsV, c, 2, lastV)
            totalDays = wsV.Cells(lastV, 1).Value - wsV.Cells(2, 1).Value
            If initV > 0 And finalV > 0 And totalDays > 0 Then
                annRet = (finalV / initV) ^ (365# / totalDays) - 1#
            End If
            annVol = StdevCol(wsR, ColumnInRow(wsR, 1, t), 2, lastR) * Sqr(12#)
            If UCase$(t) <> "ON" And ColumnInRow(wsR, 1, "ON") > 0 Then
                exAvg = AnnExcessAvg(wsR, t, "ON")
                exVol = ExcessVol(wsR, t, "ON")
                If IsNumeric(exVol) And exVol <> 0 Then info = exAvg / exVol Else info = ""
                hit = HitRatio(wsR, t, "ON")
                relDD = RelativeDrawdown(wsV, t, "ON")
            Else
                exAvg = "": exVol = "": info = "": hit = "": relDD = ""
            End If
            ws.Cells(o, 1).Value = t
            ws.Cells(o, 2).Value = DaysForTenor(t)
            ws.Cells(o, 3).Value = CountTenor(wsC, lastC, t)
            ws.Cells(o, 4).Value = AvgByTenor(wsC, lastC, t, 9)
            ws.Cells(o, 5).Value = AvgByTenor(wsC, lastC, t, 7)
            ws.Cells(o, 6).Value = ResetVol(wsC, lastC, t)
            ws.Cells(o, 7).Value = WorstReset(wsC, lastC, t)
            ws.Cells(o, 8).Value = initV
            ws.Cells(o, 9).Value = finalV
            ws.Cells(o, 10).Value = annRet
            ws.Cells(o, 11).Value = annVol
            ws.Cells(o, 12).Value = exAvg
            ws.Cells(o, 13).Value = exVol
            ws.Cells(o, 14).Value = info
            ws.Cells(o, 15).Value = hit
            ws.Cells(o, 16).Value = relDD
            o = o + 1
        End If
    Next i
    
    ws.Cells(1, 18).Value = "Comments"
    ws.Cells(2, 18).Value = "Risk summary by tenor."
    ws.Cells(3, 18).Value = "Focus is interest-rate exposure, reset risk, excess carry, and liquidity."
    ws.Columns.AutoFit
    ws.Range("E:G,J:M,O:P").NumberFormat = "0.0000%"
    ws.Range("H:I").NumberFormat = "$#,##0.00"
End Sub

Private Function FirstNum(ByVal ws As Worksheet, ByVal c As Long, _
                          ByVal r1 As Long, ByVal r2 As Long) As Double
    Dim r As Long
    If c = 0 Then Exit Function
    For r = r1 To r2
        If IsNumeric(ws.Cells(r, c).Value) Then
            If ws.Cells(r, c).Value > 0 Then
                FirstNum = ws.Cells(r, c).Value
                Exit Function
            End If
        End If
    Next r
End Function

Private Function LastNum(ByVal ws As Worksheet, ByVal c As Long, _
                         ByVal r1 As Long, ByVal r2 As Long) As Double
    Dim r As Long
    If c = 0 Then Exit Function
    For r = r2 To r1 Step -1
        If IsNumeric(ws.Cells(r, c).Value) Then
            If ws.Cells(r, c).Value > 0 Then
                LastNum = ws.Cells(r, c).Value
                Exit Function
            End If
        End If
    Next r
End Function

Private Function AvgCol(ByVal ws As Worksheet, ByVal c As Long, _
                        ByVal r1 As Long, ByVal r2 As Long) As Double
    Dim r As Long, s As Double, n As Long
    If c = 0 Then Exit Function
    For r = r1 To r2
        If IsNumeric(ws.Cells(r, c).Value) Then
            If Len(ws.Cells(r, c).Value) > 0 Then
                s = s + ws.Cells(r, c).Value
                n = n + 1
            End If
        End If
    Next r
    If n > 0 Then AvgCol = s / n
End Function

Private Function StdevCol(ByVal ws As Worksheet, ByVal c As Long, _
                          ByVal r1 As Long, ByVal r2 As Long) As Double
    Dim vals() As Double
    Dim r As Long, n As Long
    If c = 0 Then Exit Function
    For r = r1 To r2
        If IsNumeric(ws.Cells(r, c).Value) Then
            If Len(ws.Cells(r, c).Value) > 0 Then
                ReDim Preserve vals(0 To n)
                vals(n) = CDbl(ws.Cells(r, c).Value)
                n = n + 1
            End If
        End If
    Next r
    If n > 1 Then StdevCol = Application.WorksheetFunction.StDev_S(vals)
End Function

Private Function CountTenor(ByVal ws As Worksheet, ByVal lastRow As Long, _
                            ByVal tenor As String) As Long
    Dim r As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, 1).Value) = tenor Then CountTenor = CountTenor + 1
    Next r
End Function

Private Function AvgByTenor(ByVal ws As Worksheet, ByVal lastRow As Long, _
                            ByVal tenor As String, ByVal valCol As Long) As Double
    Dim r As Long, s As Double, n As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, 1).Value) = tenor Then
            If IsNumeric(ws.Cells(r, valCol).Value) Then
                s = s + ws.Cells(r, valCol).Value
                n = n + 1
            End If
        End If
    Next r
    If n > 0 Then AvgByTenor = s / n
End Function

Private Function ResetVol(ByVal ws As Worksheet, ByVal lastRow As Long, _
                          ByVal tenor As String) As Double
    Dim vals() As Double
    Dim r As Long, n As Long
    Dim prior As Variant, chg As Double
    For r = 2 To lastRow
        If CStr(ws.Cells(r, 1).Value) = tenor Then
            If IsNumeric(ws.Cells(r, 7).Value) Then
                If Not IsEmpty(prior) Then
                    chg = CDbl(ws.Cells(r, 7).Value) - CDbl(prior)
                    ReDim Preserve vals(0 To n)
                    vals(n) = chg
                    n = n + 1
                End If
                prior = ws.Cells(r, 7).Value
            End If
        End If
    Next r
    If n > 1 Then ResetVol = Application.WorksheetFunction.StDev_S(vals)
End Function

Private Function WorstReset(ByVal ws As Worksheet, ByVal lastRow As Long, _
                            ByVal tenor As String) As Double
    Dim r As Long
    Dim prior As Variant
    Dim chg As Double
    Dim worst As Double
    Dim started As Boolean
    For r = 2 To lastRow
        If CStr(ws.Cells(r, 1).Value) = tenor Then
            If IsNumeric(ws.Cells(r, 7).Value) Then
                If Not IsEmpty(prior) Then
                    chg = CDbl(ws.Cells(r, 7).Value) - CDbl(prior)
                    If Not started Then
                        worst = chg
                        started = True
                    ElseIf chg < worst Then
                        worst = chg
                    End If
                End If
                prior = ws.Cells(r, 7).Value
            End If
        End If
    Next r
    WorstReset = worst
End Function

Private Function AnnExcessAvg(ByVal ws As Worksheet, _
                              ByVal tenor As String, _
                              ByVal bench As String) As Double
    Dim cT As Long, cB As Long
    Dim r As Long, lastRow As Long
    Dim s As Double, n As Long
    cT = ColumnInRow(ws, 1, tenor)
    cB = ColumnInRow(ws, 1, bench)
    If cT = 0 Or cB = 0 Then Exit Function
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        If IsNumeric(ws.Cells(r, cT).Value) Then
            If IsNumeric(ws.Cells(r, cB).Value) Then
                s = s + ws.Cells(r, cT).Value - ws.Cells(r, cB).Value
                n = n + 1
            End If
        End If
    Next r
    If n > 0 Then AnnExcessAvg = (s / n) * 12#
End Function

Private Function ExcessVol(ByVal ws As Worksheet, _
                           ByVal tenor As String, _
                           ByVal bench As String) As Double
    Dim cT As Long, cB As Long
    Dim r As Long, n As Long, lastRow As Long
    Dim vals() As Double
    cT = ColumnInRow(ws, 1, tenor)
    cB = ColumnInRow(ws, 1, bench)
    If cT = 0 Or cB = 0 Then Exit Function
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        If IsNumeric(ws.Cells(r, cT).Value) Then
            If IsNumeric(ws.Cells(r, cB).Value) Then
                ReDim Preserve vals(0 To n)
                vals(n) = ws.Cells(r, cT).Value - ws.Cells(r, cB).Value
                n = n + 1
            End If
        End If
    Next r
    If n > 1 Then ExcessVol = Application.WorksheetFunction.StDev_S(vals) * Sqr(12#)
End Function

Private Function HitRatio(ByVal ws As Worksheet, _
                          ByVal tenor As String, _
                          ByVal bench As String) As Double
    Dim cT As Long, cB As Long
    Dim r As Long, n As Long, hit As Long, lastRow As Long
    cT = ColumnInRow(ws, 1, tenor)
    cB = ColumnInRow(ws, 1, bench)
    If cT = 0 Or cB = 0 Then Exit Function
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        If IsNumeric(ws.Cells(r, cT).Value) Then
            If IsNumeric(ws.Cells(r, cB).Value) Then
                n = n + 1
                If ws.Cells(r, cT).Value > ws.Cells(r, cB).Value Then hit = hit + 1
            End If
        End If
    Next r
    If n > 0 Then HitRatio = hit / n
End Function

Private Function RelativeDrawdown(ByVal ws As Worksheet, _
                                  ByVal tenor As String, _
                                  ByVal bench As String) As Double
    Dim cT As Long, cB As Long
    Dim r As Long, lastRow As Long
    Dim rel As Double, peak As Double, dd As Double, worst As Double
    Dim started As Boolean
    cT = ColumnInRow(ws, 1, tenor)
    cB = ColumnInRow(ws, 1, bench)
    If cT = 0 Or cB = 0 Then Exit Function
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        If IsNumeric(ws.Cells(r, cT).Value) Then
            If IsNumeric(ws.Cells(r, cB).Value) Then
                rel = ws.Cells(r, cT).Value - ws.Cells(r, cB).Value
                If Not started Then
                    peak = rel
                    worst = 0
                    started = True
                End If
                If rel > peak Then peak = rel
                dd = rel - peak
                If dd < worst Then worst = dd
            End If
        End If
    Next r
    RelativeDrawdown = worst
End Function

' =========================================================
' 07 RegimeAnalysis
' =========================================================

Private Sub BuildRegimePanel(ByVal wb As Workbook)
    Dim ws As Worksheet, wsR As Worksheet
    Dim lastRow As Long, r As Long, onCol As Long
    Dim onRet As Double, reg As String
    
    Set wsR = wb.Worksheets("04_ReturnPanel")
    Set ws = MakeSheet(wb, "07_RegimeAnalysis")
    lastRow = LastUsedRow(wsR)
    onCol = ColumnInRow(wsR, 1, "ON")
    
    ws.Cells(1, 1).Value = "observation_date"
    ws.Cells(1, 2).Value = "ON_return"
    ws.Cells(1, 3).Value = "regime"
    ws.Cells(1, 4).Value = "comment"
    ws.Cells(1, 5).Value = "1M_excess"
    ws.Cells(1, 6).Value = "2M_excess"
    ws.Cells(1, 7).Value = "3M_excess"
    ws.Cells(1, 8).Value = "6M_excess"
    
    If onCol = 0 Then
        ws.Cells(2, 1).Value = "ON not found. Regime analysis skipped."
        Exit Sub
    End If
    
    For r = 2 To lastRow
        If IsNumeric(wsR.Cells(r, onCol).Value) Then
            onRet = wsR.Cells(r, onCol).Value
            If onRet > 0.003 Then
                reg = "High front-end carry"
            ElseIf onRet < 0.0015 Then
                reg = "Low front-end carry"
            Else
                reg = "Stable front-end carry"
            End If
            ws.Cells(r, 1).Value = wsR.Cells(r, 1).Value
            ws.Cells(r, 2).Value = onRet
            ws.Cells(r, 3).Value = reg
            ws.Cells(r, 4).Value = "Thresholds are transparent and can be changed."
            ws.Cells(r, 5).Value = RetDiff(wsR, r, "1M", "ON")
            ws.Cells(r, 6).Value = RetDiff(wsR, r, "2M", "ON")
            ws.Cells(r, 7).Value = RetDiff(wsR, r, "3M", "ON")
            ws.Cells(r, 8).Value = RetDiff(wsR, r, "6M", "ON")
        End If
    Next r
    ws.Columns.AutoFit
    ws.Columns(1).NumberFormat = "yyyy-mm-dd"
    ws.Range("B:B,E:H").NumberFormat = "0.0000%"
End Sub

Private Function RetDiff(ByVal ws As Worksheet, ByVal r As Long, _
                         ByVal tenor As String, ByVal bench As String) As Variant
    Dim cT As Long, cB As Long
    cT = ColumnInRow(ws, 1, tenor)
    cB = ColumnInRow(ws, 1, bench)
    If cT = 0 Or cB = 0 Then
        RetDiff = ""
    ElseIf IsNumeric(ws.Cells(r, cT).Value) And IsNumeric(ws.Cells(r, cB).Value) Then
        RetDiff = ws.Cells(r, cT).Value - ws.Cells(r, cB).Value
    Else
        RetDiff = ""
    End If
End Function

' =========================================================
' 08 EfficientFrontier
' =========================================================

Private Sub BuildFrontier(ByVal wb As Workbook, ByVal tenors As Object)
    Dim ws As Worksheet, wsR As Worksheet
    Dim tList As Variant, n As Long, sim As Long, i As Long
    Dim weights() As Double, sumW As Double, rowOut As Long
    Dim pRet As Double, pVol As Double, wam As Double, pEx As Double
    
    Set ws = MakeSheet(wb, "08_EfficientFrontier")
    Set wsR = wb.Worksheets("04_ReturnPanel")
    tList = tenors.Keys
    n = tenors.Count
    ReDim weights(0 To n - 1)
    
    ws.Cells(1, 1).Value = "simulation"
    For i = 0 To n - 1
        ws.Cells(1, i + 2).Value = "w_" & CStr(tList(i))
    Next i
    ws.Cells(1, n + 2).Value = "portfolio_ann_return"
    ws.Cells(1, n + 3).Value = "portfolio_ann_volatility"
    ws.Cells(1, n + 4).Value = "weighted_avg_maturity_days"
    ws.Cells(1, n + 5).Value = "ann_excess_vs_ON"
    ws.Cells(1, n + 6).Value = "constraint_flag"
    ws.Cells(1, n + 7).Value = "comment"
    
    Randomize 17
    rowOut = 2
    For sim = 1 To N_FRONTIER
        sumW = 0
        For i = 0 To n - 1
            weights(i) = Rnd()
            sumW = sumW + weights(i)
        Next i
        For i = 0 To n - 1
            weights(i) = weights(i) / sumW
            ws.Cells(rowOut, i + 2).Value = weights(i)
        Next i
        pRet = PortAvgReturn(wsR, tList, weights) * 12#
        pVol = PortVol(wsR, tList, weights) * Sqr(12#)
        wam = PortWAM(tList, weights)
        pEx = PortExcessON(wsR, tList, weights) * 12#
        ws.Cells(rowOut, 1).Value = sim
        ws.Cells(rowOut, n + 2).Value = pRet
        ws.Cells(rowOut, n + 3).Value = pVol
        ws.Cells(rowOut, n + 4).Value = wam
        ws.Cells(rowOut, n + 5).Value = pEx
        If PassConstraints(tList, weights, wam) Then
            ws.Cells(rowOut, n + 6).Value = "Liquidity constrained"
        Else
            ws.Cells(rowOut, n + 6).Value = "Unconstrained only"
        End If
        ws.Cells(rowOut, n + 7).Value = "Random allocation. Use scatter chart to view frontier."
        rowOut = rowOut + 1
    Next sim
    
    ws.Cells(rowOut + 1, 1).Value = "Comments"
    ws.Cells(rowOut + 1, 2).Value = "Frontier uses historical monthly returns. It is not a forecast."
    ws.Cells(rowOut + 2, 2).Value = "Default constraints: WAM <= 90, ON >= 20%, 6M <= 25%."
    ws.Columns.AutoFit
    ws.Range(ws.Cells(2, 2), ws.Cells(rowOut, n + 3)).NumberFormat = "0.0000%"
    ws.Range(ws.Cells(2, n + 5), ws.Cells(rowOut, n + 5)).NumberFormat = "0.0000%"
End Sub

Private Function PortAvgReturn(ByVal ws As Worksheet, ByVal tList As Variant, _
                               ByRef w() As Double) As Double
    Dim r As Long, i As Long, c As Long, n As Long
    Dim lastRow As Long, rowRet As Double, ok As Boolean
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        rowRet = 0
        ok = True
        For i = LBound(tList) To UBound(tList)
            c = ColumnInRow(ws, 1, CStr(tList(i)))
            If c = 0 Or Not IsNumeric(ws.Cells(r, c).Value) Then
                ok = False
                Exit For
            End If
            rowRet = rowRet + w(i) * ws.Cells(r, c).Value
        Next i
        If ok Then
            PortAvgReturn = PortAvgReturn + rowRet
            n = n + 1
        End If
    Next r
    If n > 0 Then PortAvgReturn = PortAvgReturn / n
End Function

Private Function PortVol(ByVal ws As Worksheet, ByVal tList As Variant, _
                         ByRef w() As Double) As Double
    Dim r As Long, i As Long, c As Long, n As Long
    Dim lastRow As Long, rowRet As Double, ok As Boolean
    Dim vals() As Double
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        rowRet = 0
        ok = True
        For i = LBound(tList) To UBound(tList)
            c = ColumnInRow(ws, 1, CStr(tList(i)))
            If c = 0 Or Not IsNumeric(ws.Cells(r, c).Value) Then
                ok = False
                Exit For
            End If
            rowRet = rowRet + w(i) * ws.Cells(r, c).Value
        Next i
        If ok Then
            ReDim Preserve vals(0 To n)
            vals(n) = rowRet
            n = n + 1
        End If
    Next r
    If n > 1 Then PortVol = Application.WorksheetFunction.StDev_S(vals)
End Function

Private Function PortWAM(ByVal tList As Variant, ByRef w() As Double) As Double
    Dim i As Long
    For i = LBound(tList) To UBound(tList)
        PortWAM = PortWAM + w(i) * DaysForTenor(CStr(tList(i)))
    Next i
End Function

Private Function PortExcessON(ByVal ws As Worksheet, ByVal tList As Variant, _
                              ByRef w() As Double) As Double
    Dim r As Long, i As Long, c As Long, onCol As Long
    Dim lastRow As Long, rowRet As Double, n As Long, ok As Boolean
    onCol = ColumnInRow(ws, 1, "ON")
    If onCol = 0 Then Exit Function
    lastRow = LastUsedRow(ws)
    For r = 2 To lastRow
        rowRet = 0
        ok = True
        For i = LBound(tList) To UBound(tList)
            c = ColumnInRow(ws, 1, CStr(tList(i)))
            If c = 0 Or Not IsNumeric(ws.Cells(r, c).Value) Then
                ok = False
                Exit For
            End If
            rowRet = rowRet + w(i) * ws.Cells(r, c).Value
        Next i
        If ok And IsNumeric(ws.Cells(r, onCol).Value) Then
            PortExcessON = PortExcessON + rowRet - ws.Cells(r, onCol).Value
            n = n + 1
        End If
    Next r
    If n > 0 Then PortExcessON = PortExcessON / n
End Function

Private Function PassConstraints(ByVal tList As Variant, ByRef w() As Double, _
                                 ByVal wam As Double) As Boolean
    Dim i As Long
    Dim onW As Double, sixW As Double
    Dim hasON As Boolean, has6M As Boolean
    PassConstraints = True
    For i = LBound(tList) To UBound(tList)
        If UCase$(CStr(tList(i))) = "ON" Then
            onW = w(i)
            hasON = True
        End If
        If UCase$(CStr(tList(i))) = "6M" Then
            sixW = w(i)
            has6M = True
        End If
    Next i
    If wam > MAX_WAM Then PassConstraints = False
    If hasON And onW < MIN_ON Then PassConstraints = False
    If has6M And sixW > MAX_6M Then PassConstraints = False
End Function

' =========================================================
' 09 StressScenarios
' =========================================================

Private Sub BuildStressPanel(ByVal wb As Workbook, ByVal tenors As Object)
    Dim ws As Worksheet, wsC As Worksheet
    Dim tList As Variant, scenarios As Variant
    Dim s As Long, i As Long, o As Long, lastC As Long
    Dim t As String, avgR As Double, sh As Double
    
    Set ws = MakeSheet(wb, "09_StressScenarios")
    Set wsC = wb.Worksheets("01_CleanRolls")
    tList = tenors.Keys
    lastC = LastUsedRow(wsC)
    scenarios = Array("Base historical average", "Parallel +100bp", _
                      "Parallel -100bp", "Front-end down / term stable", _
                      "Front-end up / term stable", "Curve steepening", _
                      "Curve flattening")
    ws.Cells(1, 1).Value = "scenario"
    ws.Cells(1, 2).Value = "tenor"
    ws.Cells(1, 3).Value = "historical_avg_rate"
    ws.Cells(1, 4).Value = "shock"
    ws.Cells(1, 5).Value = "scenario_rate_proxy"
    o = 2
    For s = LBound(scenarios) To UBound(scenarios)
        For i = LBound(tList) To UBound(tList)
            t = CStr(tList(i))
            avgR = AvgByTenor(wsC, lastC, t, 7)
            sh = ScenarioShock(CStr(scenarios(s)), t)
            ws.Cells(o, 1).Value = scenarios(s)
            ws.Cells(o, 2).Value = t
            ws.Cells(o, 3).Value = avgR
            ws.Cells(o, 4).Value = sh
            ws.Cells(o, 5).Value = avgR + sh
            o = o + 1
        Next i
    Next s
    ws.Cells(1, 7).Value = "Comments"
    ws.Cells(2, 7).Value = "Stress table is a rate-sensitivity proxy, not a forecast."
    ws.Cells(3, 7).Value = "For full stress testing, rerun Detail with a stressed curve."
    ws.Columns.AutoFit
    ws.Range("C:E").NumberFormat = "0.0000%"
End Sub

Private Function ScenarioShock(ByVal scenarioName As String, _
                               ByVal tenor As String) As Double
    Dim d As Double
    d = DaysForTenor(tenor)
    Select Case scenarioName
        Case "Base historical average"
            ScenarioShock = 0
        Case "Parallel +100bp"
            ScenarioShock = 0.01
        Case "Parallel -100bp"
            ScenarioShock = -0.01
        Case "Front-end down / term stable"
            If d <= 30 Then ScenarioShock = -0.01 Else ScenarioShock = -0.0025
        Case "Front-end up / term stable"
            If d <= 30 Then ScenarioShock = 0.01 Else ScenarioShock = 0.0025
        Case "Curve steepening"
            ScenarioShock = (d / 180#) * 0.0075
        Case "Curve flattening"
            ScenarioShock = 0.0075 - (d / 180#) * 0.0075
        Case Else
            ScenarioShock = 0
    End Select
End Function

' =========================================================
' 10 Dashboard and formatting
' =========================================================

Private Sub BuildDashboard(ByVal wb As Workbook, ByVal tenors As Object)
    Dim ws As Worksheet
    Set ws = MakeSheet(wb, "10_Dashboard")
    ws.Range("A1").Value = "risk01 Dashboard"
    ws.Range("A3").Value = "Use this workbook as an interest-rate risk engine."
    ws.Range("A5").Value = "Key tabs"
    ws.Range("A6").Value = "02_RatePanel: historical rates by tenor"
    ws.Range("A7").Value = "05_ExcessVsON: incremental carry versus ON"
    ws.Range("A8").Value = "06_RiskSummary: reset risk, WAM, hit ratio, drawdown"
    ws.Range("A9").Value = "08_EfficientFrontier: portfolio trade-offs"
    ws.Range("A10").Value = "09_StressScenarios: curve shock proxy"
    ws.Range("A12").Value = "Suggested charts"
    ws.Range("A13").Value = "Rate line chart, excess carry chart, frontier scatter, WAM bar chart."
    ws.Range("A15").Value = "Detected tenors"
    ws.Range("B15").Value = JoinKeys(tenors)
    ws.Columns.AutoFit
End Sub

Private Sub FormatRiskTabs(ByVal wb As Workbook)
    Dim ws As Worksheet
    For Each ws In wb.Worksheets
        If Left$(ws.Name, 3) Like "##_*" Then
            ws.Rows(1).Font.Bold = True
            ws.Rows(1).Interior.Color = RGB(217, 225, 242)
            ws.Cells.Font.Name = "Calibri"
            ws.Cells.Font.Size = 10
            ws.Columns.AutoFit
        End If
    Next ws
End Sub
