Attribute VB_Name = "RollingRateModel"
Option Explicit

' Rolling interest-rate investment model.
' Import this single .bas file into Excel, then run BuildRollingRateTemplate.
' The curve always lives in the workbook on the Curve sheet with columns:
' date, ON, 1M, 2M, 3M, 6M
'
' User inputs:
' - Inputs!B4 = last date
' - Inputs!B5 = lookback years, e.g. 1, 1.5, 2
' - Inputs!B6 = notional
'
' Simulation:
' - Uses ACT/360.
' - Interest compounds at each roll.
' - Maturity ladders are anchored backward from last date and preserve the
'   last-date day-of-month.
' - If target dates are missing from the Curve sheet, the previous available
'   curve date is used.
' - All tenors finish on the same actual final date.

Private Type RatePoint
    CurveDate As Date
    ONRate As Double
    M1Rate As Double
    M2Rate As Double
    M3Rate As Double
    M6Rate As Double
End Type

Private Rates() As RatePoint
Private RateCount As Long

Public Sub BuildRollingRateTemplate()
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False

    EnsureSheet "Inputs", True
    EnsureSheet "Curve", True
    EnsureSheet "Summary", True
    EnsureSheet "Detail", True
    EnsureSheet "Monthly_Position", True
    EnsureSheet "Position_By_Date", True

    BuildInputsSheet
    BuildCurveSheet
    ClearOutputs ThisWorkbook.Worksheets("Summary"), ThisWorkbook.Worksheets("Detail"), ThisWorkbook.Worksheets("Monthly_Position"), ThisWorkbook.Worksheets("Position_By_Date")
    WriteSummaryHeader ThisWorkbook.Worksheets("Summary")
    WriteDetailHeader ThisWorkbook.Worksheets("Detail")
    WriteMonthlyPositionHeader ThisWorkbook.Worksheets("Monthly_Position")
    WritePositionByDateHeader ThisWorkbook.Worksheets("Position_By_Date")

    Application.DisplayAlerts = True
    Application.ScreenUpdating = True

    RunSimulation
    MsgBox "Template created and sample analysis completed. Replace Curve data and update Inputs, then run RunSimulation.", vbInformation
End Sub

Public Sub RunSimulation()
    Dim wsIn As Worksheet, wsSummary As Worksheet, wsDetail As Worksheet
    Dim wsMonthly As Worksheet, wsByDate As Worksheet
    Dim lastDateInput As Date, actualEndDate As Date
    Dim lookbackYears As Double, notional As Double, targetDay As Long
    Dim lookbackMonths As Long, targetStartDate As Date, actualStartDate As Date
    Dim detailRow As Long, summaryRow As Long, tenor As Variant

    Set wsIn = ThisWorkbook.Worksheets("Inputs")
    Set wsSummary = ThisWorkbook.Worksheets("Summary")
    Set wsDetail = ThisWorkbook.Worksheets("Detail")
    Set wsMonthly = ThisWorkbook.Worksheets("Monthly_Position")
    Set wsByDate = ThisWorkbook.Worksheets("Position_By_Date")

    lastDateInput = CDate(wsIn.Range("B4").Value)
    lookbackYears = CDbl(wsIn.Range("B5").Value)
    notional = CDbl(wsIn.Range("B6").Value)
    targetDay = Day(lastDateInput)
    lookbackMonths = CLng(Round(lookbackYears * 12#, 0))

    LoadRatesFromCurve
    actualEndDate = PreviousCurveDate(lastDateInput)
    targetStartDate = AddMonthsPreserveDay(lastDateInput, -lookbackMonths, targetDay)
    actualStartDate = PreviousCurveDate(targetStartDate)

    wsIn.Range("B8").Value = targetStartDate
    wsIn.Range("B9").Value = actualStartDate
    wsIn.Range("B10").Value = actualEndDate
    wsIn.Range("B11").Value = targetDay
    wsIn.Range("B12").Value = Now

    ClearOutputs wsSummary, wsDetail, wsMonthly, wsByDate
    WriteSummaryHeader wsSummary
    WriteDetailHeader wsDetail
    WriteMonthlyPositionHeader wsMonthly
    WritePositionByDateHeader wsByDate

    detailRow = 2
    summaryRow = 2
    For Each tenor In Array("ON", "1M", "2M", "3M", "6M")
        SimulateTenor wsDetail, detailRow, CStr(tenor), actualStartDate, targetStartDate, actualEndDate, lastDateInput, notional, targetDay
        WriteSummaryRow wsSummary, summaryRow, CStr(tenor)
        summaryRow = summaryRow + 1
    Next tenor

    BuildMonthlyPosition wsMonthly, wsDetail, targetStartDate, lastDateInput, targetDay
    BuildPositionByDate wsByDate, wsDetail
    FormatOutputs wsIn, wsSummary, wsDetail, wsMonthly, wsByDate
    wsSummary.Activate
End Sub

Private Sub EnsureSheet(ByVal sheetName As String, ByVal clearSheet As Boolean)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = sheetName
    ElseIf clearSheet Then
        ws.Cells.Clear
    End If
End Sub

Private Sub BuildInputsSheet()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Inputs")

    ws.Range("A1").Value = "Rolling interest-rate investment model"
    ws.Range("A1").Font.Bold = True
    ws.Range("A3").Value = "Input": ws.Range("B3").Value = "Value"
    ws.Range("A4").Value = "Last date": ws.Range("B4").Value = DateSerial(2026, 6, 30)
    ws.Range("A5").Value = "Lookback years": ws.Range("B5").Value = 3
    ws.Range("A6").Value = "Notional": ws.Range("B6").Value = 1000000
    ws.Range("A8").Value = "Calculated target start date"
    ws.Range("A9").Value = "Calculated actual start date"
    ws.Range("A10").Value = "Calculated common end date"
    ws.Range("A11").Value = "Target day of month"
    ws.Range("A12").Value = "Last run"

    ws.Range("D3").Value = "Notes"
    ws.Range("D4").Value = "Curve data must be on the Curve sheet."
    ws.Range("D5").Value = "Rates may be entered as decimals or percentages."
    ws.Range("D6").Value = "Lookback years can be fractional, such as 1.5."
    ws.Range("D7").Value = "Maturity dates are anchored from Last date."

    ws.Range("B5").NumberFormat = "0.00"
    ws.Range("B6").NumberFormat = "$#,##0.00"
    ws.Range("B4").NumberFormat = "yyyy-mm-dd"
    ws.Range("B8:B10").NumberFormat = "yyyy-mm-dd"
    ws.Range("A:A").Font.Bold = True
    ws.Columns.AutoFit
End Sub

Private Sub BuildCurveSheet()
    Dim ws As Worksheet, d As Date, rowNum As Long
    Dim t As Double, baseRate As Double

    Set ws = ThisWorkbook.Worksheets("Curve")
    ws.Range("A1:F1").Value = Array("date", "ON", "1M", "2M", "3M", "6M")
    ws.Rows(1).Font.Bold = True

    rowNum = 2
    For d = DateSerial(2021, 1, 4) To DateSerial(2026, 6, 30)
        If Weekday(d, vbMonday) <= 5 Then
            t = DateDiff("d", DateSerial(2021, 1, 4), d) / 365#
            baseRate = 0.008 + WorksheetFunction.Min(0.044, 0.008 * t) + 0.004 * Sin(t * 2.1)
            ws.Cells(rowNum, 1).Value = d
            ws.Cells(rowNum, 2).Value = WorksheetFunction.Max(0.0005, baseRate - 0.0015)
            ws.Cells(rowNum, 3).Value = WorksheetFunction.Max(0.0005, baseRate - 0.0005)
            ws.Cells(rowNum, 4).Value = WorksheetFunction.Max(0.0005, baseRate + 0.0002)
            ws.Cells(rowNum, 5).Value = WorksheetFunction.Max(0.0005, baseRate + 0.0008)
            ws.Cells(rowNum, 6).Value = WorksheetFunction.Max(0.0005, baseRate + 0.0018)
            rowNum = rowNum + 1
        End If
    Next d

    ws.Columns("A").NumberFormat = "yyyy-mm-dd"
    ws.Columns("B:F").NumberFormat = "0.0000%"
    ws.Columns.AutoFit
End Sub

Private Sub LoadRatesFromCurve()
    Dim ws As Worksheet, lastRow As Long, r As Long
    Set ws = ThisWorkbook.Worksheets("Curve")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 100, , "Curve sheet has no rate data."

    RateCount = lastRow - 1
    ReDim Rates(1 To RateCount)
    For r = 2 To lastRow
        AssignRatePoint r - 1, ws.Cells(r, 1).Value, ws.Cells(r, 2).Value, ws.Cells(r, 3).Value, ws.Cells(r, 4).Value, ws.Cells(r, 5).Value, ws.Cells(r, 6).Value
    Next r
    SortRatesByDate
End Sub

Private Sub AssignRatePoint(ByVal idx As Long, ByVal d As Variant, ByVal rON As Variant, ByVal r1M As Variant, ByVal r2M As Variant, ByVal r3M As Variant, ByVal r6M As Variant)
    Rates(idx).CurveDate = CDate(d)
    Rates(idx).ONRate = NormalizeRate(rON)
    Rates(idx).M1Rate = NormalizeRate(r1M)
    Rates(idx).M2Rate = NormalizeRate(r2M)
    Rates(idx).M3Rate = NormalizeRate(r3M)
    Rates(idx).M6Rate = NormalizeRate(r6M)
End Sub

Private Function NormalizeRate(ByVal v As Variant) As Double
    NormalizeRate = CDbl(v)
    If Abs(NormalizeRate) > 1# Then NormalizeRate = NormalizeRate / 100#
End Function

Private Sub SortRatesByDate()
    Dim i As Long, j As Long, tmp As RatePoint
    For i = 1 To RateCount - 1
        For j = i + 1 To RateCount
            If Rates(j).CurveDate < Rates(i).CurveDate Then
                tmp = Rates(i)
                Rates(i) = Rates(j)
                Rates(j) = tmp
            End If
        Next j
    Next i
End Sub

Private Sub SimulateTenor(ByVal ws As Worksheet, ByRef rowNum As Long, ByVal tenor As String, ByVal actualStartDate As Date, ByVal targetStartDate As Date, ByVal actualEndDate As Date, ByVal lastDate As Date, ByVal notional As Double, ByVal targetDay As Long)
    Dim cash As Double, investStart As Date, rollNo As Long
    Dim maturityTarget As Date, actualEnd As Date, rateDate As Date, rateUsed As Double
    Dim targets As Collection, i As Long

    cash = notional
    investStart = actualStartDate
    rollNo = 1

    If tenor = "ON" Then
        Do While investStart < actualEndDate
            rateDate = PreviousCurveDate(investStart)
            rateUsed = GetRateForTenor(rateDate, tenor)
            actualEnd = NextCurveDate(investStart)
            If actualEnd > actualEndDate Then actualEnd = actualEndDate
            WriteDetailRow ws, rowNum, tenor, rollNo, investStart, rateDate, actualEnd, actualEnd, rateUsed, cash
            cash = ws.Cells(rowNum, 11).Value
            investStart = actualEnd
            rowNum = rowNum + 1
            rollNo = rollNo + 1
        Loop
        Exit Sub
    End If

    Set targets = BuildTenorTargets(targetStartDate, lastDate, TenorMonths(tenor), targetDay)
    For i = 2 To targets.Count
        If investStart >= actualEndDate Then Exit For
        maturityTarget = CDate(targets(i))
        actualEnd = PreviousCurveDate(maturityTarget)
        If actualEnd <= investStart Then actualEnd = NextCurveDate(investStart)
        If actualEnd > actualEndDate Then actualEnd = actualEndDate

        rateDate = PreviousCurveDate(investStart)
        rateUsed = GetRateForTenor(rateDate, tenor)
        WriteDetailRow ws, rowNum, tenor, rollNo, investStart, rateDate, maturityTarget, actualEnd, rateUsed, cash
        cash = ws.Cells(rowNum, 11).Value
        investStart = actualEnd
        rowNum = rowNum + 1
        rollNo = rollNo + 1
    Next i
End Sub

Private Sub WriteDetailRow(ByVal ws As Worksheet, ByVal rowNum As Long, ByVal tenor As String, ByVal rollNo As Long, ByVal investStart As Date, ByVal rateDate As Date, ByVal maturityTarget As Date, ByVal actualEnd As Date, ByVal rateUsed As Double, ByVal cash As Double)
    Dim accrualDays As Long, interest As Double
    accrualDays = DateDiff("d", investStart, actualEnd)
    interest = cash * rateUsed * accrualDays / 360#

    ws.Cells(rowNum, 1).Value = tenor
    ws.Cells(rowNum, 2).Value = rollNo
    ws.Cells(rowNum, 3).Value = investStart
    ws.Cells(rowNum, 4).Value = rateDate
    ws.Cells(rowNum, 5).Value = maturityTarget
    ws.Cells(rowNum, 6).Value = actualEnd
    ws.Cells(rowNum, 7).Value = rateUsed
    ws.Cells(rowNum, 8).Value = accrualDays
    ws.Cells(rowNum, 9).Value = cash
    ws.Cells(rowNum, 10).Value = interest
    ws.Cells(rowNum, 11).Value = cash + interest
End Sub

Private Function BuildTenorTargets(ByVal startTarget As Date, ByVal endTarget As Date, ByVal monthsStep As Long, ByVal targetDay As Long) As Collection
    Dim reverseTargets As New Collection, currentDate As Date, i As Long
    Set BuildTenorTargets = New Collection

    currentDate = endTarget
    Do While currentDate >= startTarget
        reverseTargets.Add currentDate
        currentDate = AddMonthsPreserveDay(currentDate, -monthsStep, targetDay)
    Loop

    For i = reverseTargets.Count To 1 Step -1
        BuildTenorTargets.Add reverseTargets(i)
    Next i
End Function

Private Sub BuildMonthlyPosition(ByVal wsPos As Worksheet, ByVal wsDetail As Worksheet, ByVal targetStartDate As Date, ByVal lastDate As Date, ByVal targetDay As Long)
    Dim rowNum As Long, targetDate As Date, positionDate As Date
    rowNum = 2
    targetDate = AddMonthsPreserveDay(targetStartDate, 1, targetDay)

    Do While targetDate <= lastDate
        positionDate = PreviousCurveDate(targetDate)
        wsPos.Cells(rowNum, 1).Value = targetDate
        wsPos.Cells(rowNum, 2).Value = positionDate
        wsPos.Cells(rowNum, 3).Value = LatestEndingCash(wsDetail, "ON", positionDate, True, False)
        wsPos.Cells(rowNum, 4).Value = LatestEndingCash(wsDetail, "1M", positionDate, False, False)
        wsPos.Cells(rowNum, 5).Value = LatestEndingCash(wsDetail, "2M", positionDate, False, False)
        wsPos.Cells(rowNum, 6).Value = LatestEndingCash(wsDetail, "3M", positionDate, False, False)
        wsPos.Cells(rowNum, 7).Value = LatestEndingCash(wsDetail, "6M", positionDate, False, False)
        rowNum = rowNum + 1
        targetDate = AddMonthsPreserveDay(targetDate, 1, targetDay)
    Loop
End Sub

Private Sub BuildPositionByDate(ByVal wsPos As Worksheet, ByVal wsDetail As Worksheet)
    Dim dates As Collection, rowNum As Long, i As Long, d As Date, positionDate As Date
    Set dates = UniqueDisplayDates(wsDetail)
    rowNum = 2

    For i = 1 To dates.Count
        d = CDate(dates(i))
        positionDate = PreviousCurveDate(d)
        wsPos.Cells(rowNum, 1).Value = d
        wsPos.Cells(rowNum, 2).Value = positionDate
        wsPos.Cells(rowNum, 3).Value = LatestEndingCash(wsDetail, "ON", positionDate, True, False)
        wsPos.Cells(rowNum, 4).Value = LatestEndingCash(wsDetail, "1M", d, False, True)
        wsPos.Cells(rowNum, 5).Value = LatestEndingCash(wsDetail, "2M", d, False, True)
        wsPos.Cells(rowNum, 6).Value = LatestEndingCash(wsDetail, "3M", d, False, True)
        wsPos.Cells(rowNum, 7).Value = LatestEndingCash(wsDetail, "6M", d, False, True)
        rowNum = rowNum + 1
    Next i
End Sub

Private Function UniqueDisplayDates(ByVal wsDetail As Worksheet) As Collection
    Dim dict As Object, lastRow As Long, r As Long, keyDate As Date
    Set dict = CreateObject("Scripting.Dictionary")
    lastRow = wsDetail.Cells(wsDetail.Rows.Count, "A").End(xlUp).Row

    For r = 2 To lastRow
        If wsDetail.Cells(r, 1).Value = "ON" Then
            keyDate = wsDetail.Cells(r, 6).Value
        Else
            keyDate = wsDetail.Cells(r, 5).Value
        End If
        If Not dict.Exists(CDbl(keyDate)) Then dict.Add CDbl(keyDate), keyDate
    Next r

    Set UniqueDisplayDates = SortDateDictionary(dict)
End Function

Private Function SortDateDictionary(ByVal dict As Object) As Collection
    Dim keys As Variant, i As Long, j As Long, tmp As Variant
    keys = dict.Keys
    For i = LBound(keys) To UBound(keys) - 1
        For j = i + 1 To UBound(keys)
            If CDbl(keys(j)) < CDbl(keys(i)) Then
                tmp = keys(i)
                keys(i) = keys(j)
                keys(j) = tmp
            End If
        Next j
    Next i

    Set SortDateDictionary = New Collection
    For i = LBound(keys) To UBound(keys)
        SortDateDictionary.Add dict(keys(i))
    Next i
End Function

Private Function LatestEndingCash(ByVal wsDetail As Worksheet, ByVal tenor As String, ByVal compareDate As Date, ByVal allowPrior As Boolean, ByVal compareTargetDate As Boolean) As Variant
    Dim lastRow As Long, r As Long, dateCol As Long, candidate As Variant
    lastRow = wsDetail.Cells(wsDetail.Rows.Count, "A").End(xlUp).Row
    dateCol = IIf(compareTargetDate, 5, 6)
    candidate = Empty

    For r = 2 To lastRow
        If wsDetail.Cells(r, 1).Value = tenor Then
            If allowPrior Then
                If wsDetail.Cells(r, dateCol).Value <= compareDate Then candidate = wsDetail.Cells(r, 11).Value
            Else
                If wsDetail.Cells(r, dateCol).Value = compareDate Then
                    LatestEndingCash = wsDetail.Cells(r, 11).Value
                    Exit Function
                End If
            End If
        End If
    Next r

    If IsEmpty(candidate) Then LatestEndingCash = "" Else LatestEndingCash = candidate
End Function

Private Function AddMonthsPreserveDay(ByVal sourceDate As Date, ByVal months As Long, ByVal targetDay As Long) As Date
    Dim y As Long, m As Long, lastDay As Long
    y = Year(sourceDate)
    m = Month(sourceDate) + months
    Do While m > 12
        y = y + 1
        m = m - 12
    Loop
    Do While m < 1
        y = y - 1
        m = m + 12
    Loop
    lastDay = Day(DateSerial(y, m + 1, 0))
    AddMonthsPreserveDay = DateSerial(y, m, WorksheetFunction.Min(targetDay, lastDay))
End Function

Private Function PreviousCurveDate(ByVal targetDate As Date) As Date
    Dim i As Long
    For i = RateCount To 1 Step -1
        If Rates(i).CurveDate <= targetDate Then
            PreviousCurveDate = Rates(i).CurveDate
            Exit Function
        End If
    Next i
    Err.Raise vbObjectError + 101, , "No curve date exists on or before " & Format$(targetDate, "yyyy-mm-dd")
End Function

Private Function NextCurveDate(ByVal targetDate As Date) As Date
    Dim i As Long
    For i = 1 To RateCount
        If Rates(i).CurveDate > targetDate Then
            NextCurveDate = Rates(i).CurveDate
            Exit Function
        End If
    Next i
    NextCurveDate = Rates(RateCount).CurveDate
End Function

Private Function GetRateForTenor(ByVal rateDate As Date, ByVal tenor As String) As Double
    Dim i As Long
    For i = 1 To RateCount
        If Rates(i).CurveDate = rateDate Then
            Select Case tenor
                Case "ON": GetRateForTenor = Rates(i).ONRate
                Case "1M": GetRateForTenor = Rates(i).M1Rate
                Case "2M": GetRateForTenor = Rates(i).M2Rate
                Case "3M": GetRateForTenor = Rates(i).M3Rate
                Case "6M": GetRateForTenor = Rates(i).M6Rate
                Case Else: Err.Raise vbObjectError + 102, , "Unsupported tenor: " & tenor
            End Select
            Exit Function
        End If
    Next i
    Err.Raise vbObjectError + 103, , "Rate date not found: " & Format$(rateDate, "yyyy-mm-dd")
End Function

Private Function TenorMonths(ByVal tenor As String) As Long
    Select Case tenor
        Case "1M": TenorMonths = 1
        Case "2M": TenorMonths = 2
        Case "3M": TenorMonths = 3
        Case "6M": TenorMonths = 6
        Case Else: TenorMonths = 0
    End Select
End Function

Private Sub ClearOutputs(ByVal wsSummary As Worksheet, ByVal wsDetail As Worksheet, ByVal wsMonthly As Worksheet, ByVal wsByDate As Worksheet)
    wsSummary.Cells.Clear
    wsDetail.Cells.Clear
    wsMonthly.Cells.Clear
    wsByDate.Cells.Clear
End Sub

Private Sub WriteSummaryHeader(ByVal ws As Worksheet)
    ws.Range("A1:G1").Value = Array("tenor", "final cash", "total interest", "return %", "number of rolls", "average rate used", "average days per roll")
End Sub

Private Sub WriteDetailHeader(ByVal ws As Worksheet)
    ws.Range("A1:K1").Value = Array("tenor", "roll number", "investment start date", "rate date used", "maturity target date", "actual end date", "rate", "accrual days", "starting cash", "interest earned", "ending cash")
End Sub

Private Sub WriteMonthlyPositionHeader(ByVal ws As Worksheet)
    ws.Range("A1:G1").Value = Array("target month date", "position date", "ON ending cash", "1M ending cash", "2M ending cash", "3M ending cash", "6M ending cash")
End Sub

Private Sub WritePositionByDateHeader(ByVal ws As Worksheet)
    ws.Range("A1:G1").Value = Array("display date", "position date", "ON ending cash", "1M ending cash", "2M ending cash", "3M ending cash", "6M ending cash")
End Sub

Private Sub WriteSummaryRow(ByVal ws As Worksheet, ByVal rowNum As Long, ByVal tenor As String)
    ws.Cells(rowNum, 1).Value = tenor
    ws.Cells(rowNum, 2).Formula = "=LOOKUP(2,1/(Detail!$A:$A=A" & rowNum & "),Detail!$K:$K)"
    ws.Cells(rowNum, 3).Formula = "=B" & rowNum & "-Inputs!$B$6"
    ws.Cells(rowNum, 4).Formula = "=B" & rowNum & "/Inputs!$B$6-1"
    ws.Cells(rowNum, 5).Formula = "=COUNTIF(Detail!$A:$A,A" & rowNum & ")"
    ws.Cells(rowNum, 6).Formula = "=AVERAGEIF(Detail!$A:$A,A" & rowNum & ",Detail!$G:$G)"
    ws.Cells(rowNum, 7).Formula = "=AVERAGEIF(Detail!$A:$A,A" & rowNum & ",Detail!$H:$H)"
End Sub

Private Sub FormatOutputs(ByVal wsIn As Worksheet, ByVal wsSummary As Worksheet, ByVal wsDetail As Worksheet, ByVal wsMonthly As Worksheet, ByVal wsByDate As Worksheet)
    With wsIn
        .Range("B4").NumberFormat = "yyyy-mm-dd"
        .Range("B5").NumberFormat = "0.00"
        .Range("B6").NumberFormat = "$#,##0.00"
        .Range("B8:B10").NumberFormat = "yyyy-mm-dd"
        .Columns.AutoFit
    End With
    With wsSummary
        .Rows(1).Font.Bold = True
        .Columns("B:C").NumberFormat = "$#,##0.00"
        .Columns("D:F").NumberFormat = "0.0000%"
        .Columns("G").NumberFormat = "0.00"
        .Columns.AutoFit
    End With
    With wsDetail
        .Rows(1).Font.Bold = True
        .Columns("C:F").NumberFormat = "yyyy-mm-dd"
        .Columns("G").NumberFormat = "0.0000%"
        .Columns("I:K").NumberFormat = "$#,##0.00"
        .Columns.AutoFit
    End With
    With wsMonthly
        .Rows(1).Font.Bold = True
        .Columns("A:B").NumberFormat = "yyyy-mm-dd"
        .Columns("C:G").NumberFormat = "$#,##0.00"
        .Columns.AutoFit
    End With
    With wsByDate
        .Rows(1).Font.Bold = True
        .Columns("A:B").NumberFormat = "yyyy-mm-dd"
        .Columns("C:G").NumberFormat = "$#,##0.00"
        .Columns.AutoFit
    End With
End Sub
