
Attribute VB_Name = "RatesAnalysisModel"
Option Explicit

' ============================================================================
' Historical Cash Investment Analysis
'
' Required curve headers:
'   Date | ON | 1M | 2M | 3M | 6M
'
' Rates are entered and displayed as percentage points:
'   1.54 means 1.54%, not 0.0154.
'
' Core conventions:
'   - ACT/360
'   - Interest always reinvested
'   - Monthly target dates remain anchored to the requested start date
'   - If a target date is unavailable, use the latest prior curve date
'   - ON matures on the next available curve date
'   - Daily accrual includes every calendar day through analysis end
'
' Import this module together with Rates_Analysis_Structure.bas.
'
' Main procedures:
'   BuildRatesAnalysisModel  - calculate and rebuild the complete model
'   LoadSimulationData       - optional deterministic test data
'   RunRatesModelSelfTest    - run structural and reconciliation checks
' ============================================================================

Private Const TENOR_COUNT As Long = 5
Private Const DAY_COUNT As Double = 360#

Private gCurveDates() As Double
Private gRates() As Double
Private gRateValid() As Boolean
Private gCurveRows As Long

Private gRequestedStartDate As Double
Private gStartDate As Double        ' Effective start date used in the simulation
Private gEndDate As Double
Private gNotional As Double
Private gNumDays As Long
Private gWeightStep As Double

Private gTx() As Variant
Private gTxCount As Long
Private gDaily() As Variant
Private gDailyCount As Long

Private gBalance() As Double
Private gDailyInterest() As Double
Private gOpeningPrincipal() As Double
Private gCompletedTransactions() As Long
Private gMonthlyReturns() As Double
Private gMonthlyCount As Long
Private gMonthEndDates() As Double

Private gEndingValue(1 To TENOR_COUNT) As Double
Private gTotalInterest(1 To TENOR_COUNT) As Double
Private gAnnualizedReturn(1 To TENOR_COUNT) As Double
Private gAverageRate(1 To TENOR_COUNT) As Double
Private gTenorAnnualReturn(1 To TENOR_COUNT) As Double
Private gTenorAnnualVol(1 To TENOR_COUNT) As Double


Public Sub BuildRatesAnalysisModel()

    On Error GoTo BuildFail

    BuildModelCore False
    PostProcessActualCurveV3

    MsgBox "Rates analysis model updated successfully using the current Curve sheet.", _
           vbInformation
    Exit Sub

BuildFail:
    MsgBox "Model update stopped: " & Err.Description, vbCritical

End Sub


Public Sub LoadSimulationData()
    LoadSimulationDataCore True
End Sub

Private Sub LoadSimulationDataCore(ByVal showCompletionMessage As Boolean)

    Dim ws As Worksheet
    Dim startDate As Date, endDate As Date, currentDate As Date
    Dim outputData() As Variant
    Dim businessDays As Long, rowNumber As Long
    Dim x As Double, onRate As Double, slope As Double

    Application.ScreenUpdating = False
    ResetRatesAnalysisStructureSilently

    startDate = DateSerial(2023, 1, 2)
    endDate = DateSerial(2025, 12, 31)

    currentDate = startDate
    Do While currentDate <= endDate
        If Weekday(currentDate, vbMonday) <= 5 Then businessDays = businessDays + 1
        currentDate = currentDate + 1
    Loop

    ReDim outputData(1 To businessDays, 1 To 6)

    currentDate = startDate
    rowNumber = 0

    Do While currentDate <= endDate
        If Weekday(currentDate, vbMonday) <= 5 Then
            rowNumber = rowNumber + 1
            x = rowNumber / 252#

            onRate = 4.15 + 0.85 * Sin(x * 2.2) + 0.35 * Cos(x * 0.75)
            slope = 0.06 + 0.24 * Sin(x * 1.35) - 0.08 * Cos(x * 0.55)

            outputData(rowNumber, 1) = currentDate
            outputData(rowNumber, 2) = Round(onRate, 4)
            outputData(rowNumber, 3) = Round(onRate + slope * 0.25, 4)
            outputData(rowNumber, 4) = Round(onRate + slope * 0.45, 4)
            outputData(rowNumber, 5) = Round(onRate + slope * 0.65, 4)
            outputData(rowNumber, 6) = Round(onRate + slope, 4)
        End If

        currentDate = currentDate + 1
    Loop

    Set ws = ThisWorkbook.Worksheets("Curve")
    ws.Range("A2").Resize(businessDays, 6).Value = outputData
    ws.Range("A2:A" & businessDays + 1).NumberFormat = "mm/dd/yyyy"
    ws.Range("B2:F" & businessDays + 1).NumberFormat = "0.0000"
    ws.Range("A2:F" & businessDays + 1).Font.Color = RGB(0, 0, 255)

    With ThisWorkbook.Worksheets("Inputs")
        .Range("B5").Value = DateSerial(2023, 1, 31)
        .Range("B6").Value = DateSerial(2025, 12, 31)
        .Range("B7").Value = 100000000#
        .Range("B8").Value = 0.1
    End With

    Application.ScreenUpdating = True

    If showCompletionMessage Then
        MsgBox "Deterministic simulation data loaded. Run BuildRatesAnalysisModel.", vbInformation
    End If

End Sub

Public Sub RunRatesModelSelfTest()

    Dim expectedDailyRows As Long
    Dim actualDailyRows As Long
    Dim t As Long
    Dim dailyInterestTotal As Double
    Dim differenceValue As Double
    Dim testMessage As String

    LoadSimulationDataCore False
    BuildModelCore False
    PostProcessActualCurveV3

    expectedDailyRows = TENOR_COUNT * gNumDays
    actualDailyRows = ThisWorkbook.Worksheets("Daily_Accrual"). _
                      Cells(ThisWorkbook.Worksheets("Daily_Accrual").Rows.Count, 1). _
                      End(xlUp).Row - 3

    If actualDailyRows <> expectedDailyRows Then
        Err.Raise vbObjectError + 901, , _
            "Self-test failed: expected " & expectedDailyRows & _
            " daily rows but found " & actualDailyRows & "."
    End If

    For t = 1 To TENOR_COUNT
        dailyInterestTotal = SumDailyInterestBetween(t, gStartDate, gEndDate)
        differenceValue = Abs(dailyInterestTotal - gTotalInterest(t))

        If differenceValue > 0.05 Then
            Err.Raise vbObjectError + 902, , _
                "Self-test failed for " & TenorName(t) & _
                ": daily interest does not reconcile to ending value."
        End If

        If gEndingValue(t) <= gNotional Then
            Err.Raise vbObjectError + 903, , _
                "Self-test failed for " & TenorName(t) & _
                ": ending value is not greater than initial notional."
        End If
    Next t

    If ThisWorkbook.Worksheets("Dashboard").ChartObjects.Count <> 8 Then
        Err.Raise vbObjectError + 904, , _
            "Self-test failed: the Dashboard should contain eight charts."
    End If

    testMessage = "Self-test passed." & vbCrLf & _
                  "Curve rows: " & gCurveRows & vbCrLf & _
                  "Daily ledger rows: " & actualDailyRows & vbCrLf & _
                  "Transactions: " & gTxCount & vbCrLf & _
                  "Dashboard charts: 8"

    MsgBox testMessage, vbInformation

End Sub

Private Sub BuildModelCore(ByVal showCompletionMessage As Boolean)

    Dim oldCalc As XlCalculation

    On Error GoTo CleanFail

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    oldCalc = Application.Calculation
    Application.Calculation = xlCalculationManual

    Application.StatusBar = "Preparing model structure..."
    EnsureRatesAnalysisStructure

    Application.StatusBar = "Loading curve data..."
    LoadCurveData
    LoadInputs
    ValidateInputs
    InitializeCalculationArrays

    Application.StatusBar = "Building daily transaction schedules..."
    BuildAllStrategies
    WriteDataQuality
    WriteTransactions
    WriteDailyAccrual

    Application.StatusBar = "Building historical premium analysis..."
    BuildPremiumAnalysis

    Application.StatusBar = "Building rolling return analysis..."
    BuildRollingResults
    BuildMonthlyReturns

    Application.StatusBar = "Building diversification analysis..."
    BuildPortfolioAnalysis

    Application.StatusBar = "Building swap framework..."
    BuildSwapAnalysis

    Application.StatusBar = "Building CFO dashboard..."
    BuildChartData
    BuildDashboard
    BuildMethodology

    Application.CalculateFull

    Application.StatusBar = False
    Application.Calculation = oldCalc
    Application.EnableEvents = True
    Application.ScreenUpdating = True

    If showCompletionMessage Then
        MsgBox "Rates analysis model updated successfully.", vbInformation
    End If

    Exit Sub

CleanFail:
    Application.StatusBar = False
    Application.Calculation = oldCalc
    Application.EnableEvents = True
    Application.ScreenUpdating = True

    If showCompletionMessage Then
        MsgBox "Model update stopped: " & Err.Description, vbCritical
    Else
        Err.Raise Err.Number, Err.Source, Err.Description
    End If

End Sub


' ============================================================================
' Curve and input loading

' ============================================================================
' Curve and input loading
' ============================================================================


Private Sub LoadCurveData()

    Dim ws As Worksheet
    Dim headerRow As Long
    Dim colDate As Long, colON As Long, col1M As Long
    Dim col2M As Long, col3M As Long, col6M As Long
    Dim lastRow As Long, lastColumn As Long
    Dim r As Long, i As Long, t As Long
    Dim columns(1 To TENOR_COUNT) As Long
    Dim dateValue As Variant
    Dim currentDate As Double
    Dim validRows As Long

    Set ws = ThisWorkbook.Worksheets("Curve")

    headerRow = FindHeaderRow(ws, "Date", 20)
    If headerRow = 0 Then
        Err.Raise vbObjectError + 100, , "Curve header 'Date' was not found in the first 20 rows."
    End If

    colDate = FindHeaderColumn(ws, headerRow, "Date")
    colON = FindHeaderColumn(ws, headerRow, "ON")
    col1M = FindHeaderColumn(ws, headerRow, "1M")
    col2M = FindHeaderColumn(ws, headerRow, "2M")
    col3M = FindHeaderColumn(ws, headerRow, "3M")
    col6M = FindHeaderColumn(ws, headerRow, "6M")

    If colDate = 0 Or colON = 0 Or col1M = 0 Or col2M = 0 Or col3M = 0 Or col6M = 0 Then
        Err.Raise vbObjectError + 101, , _
            "Curve must contain Date, ON, 1M, 2M, 3M and 6M headers."
    End If

    columns(1) = colON
    columns(2) = col1M
    columns(3) = col2M
    columns(4) = col3M
    columns(5) = col6M

    lastRow = ws.Cells(ws.Rows.Count, colDate).End(xlUp).Row
    lastColumn = Application.WorksheetFunction.Max(colDate, colON, col1M, col2M, col3M, col6M)

    If lastRow <= headerRow Then
        Err.Raise vbObjectError + 102, , "The Curve sheet contains no data."
    End If

    ws.Range(ws.Cells(headerRow, 1), ws.Cells(lastRow, lastColumn)).Sort _
        Key1:=ws.Cells(headerRow + 1, colDate), Order1:=xlAscending, Header:=xlYes

    validRows = 0
    For r = headerRow + 1 To lastRow
        If Len(Trim$(CStr(ws.Cells(r, colDate).Value))) > 0 Then validRows = validRows + 1
    Next r

    If validRows = 0 Then
        Err.Raise vbObjectError + 103, , "The Curve sheet contains no valid dates."
    End If

    gCurveRows = validRows
    ReDim gCurveDates(1 To gCurveRows)
    ReDim gRates(1 To gCurveRows, 1 To TENOR_COUNT)
    ReDim gRateValid(1 To gCurveRows, 1 To TENOR_COUNT)

    i = 0

    For r = headerRow + 1 To lastRow

        dateValue = ws.Cells(r, colDate).Value
        If Len(Trim$(CStr(dateValue))) = 0 Then GoTo NextCurveRow

        If IsDate(dateValue) Then
            currentDate = CDbl(CDate(dateValue))
        ElseIf IsNumeric(dateValue) And CDbl(dateValue) > 0 Then
            currentDate = CDbl(dateValue)
        Else
            Err.Raise vbObjectError + 104, , "Invalid curve date in data row " & r & "."
        End If

        i = i + 1
        gCurveDates(i) = currentDate

        If i > 1 Then
            If gCurveDates(i) <= gCurveDates(i - 1) Then
                Err.Raise vbObjectError + 105, , _
                    "Curve dates must be unique and sorted ascending. Review row " & r & "."
            End If
        End If

        For t = 1 To TENOR_COUNT
            If IsNumeric(ws.Cells(r, columns(t)).Value) And _
               Len(Trim$(CStr(ws.Cells(r, columns(t)).Value))) > 0 Then

                gRates(i, t) = CDbl(ws.Cells(r, columns(t)).Value)
                gRateValid(i, t) = True
            Else
                gRates(i, t) = 0#
                gRateValid(i, t) = False
            End If
        Next t

NextCurveRow:
    Next r

End Sub






Private Sub LoadInputs()

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Inputs")

    If Not IsDate(ws.Range("B5").Value) Then
        Err.Raise vbObjectError + 110, , "Invalid analysis start date in Inputs!B5."
    End If

    If Not IsDate(ws.Range("B6").Value) Then
        Err.Raise vbObjectError + 111, , "Invalid analysis end date in Inputs!B6."
    End If

    If Not IsNumeric(ws.Range("B7").Value) Then
        Err.Raise vbObjectError + 112, , "Invalid initial notional in Inputs!B7."
    End If

    If Not IsNumeric(ws.Range("B8").Value) Then
        Err.Raise vbObjectError + 113, , "Invalid frontier weight step in Inputs!B8."
    End If

    gRequestedStartDate = CDbl(CDate(ws.Range("B5").Value))
    gEndDate = CDbl(CDate(ws.Range("B6").Value))
    gNotional = CDbl(ws.Range("B7").Value)
    gWeightStep = CDbl(ws.Range("B8").Value)

End Sub

Private Sub ValidateInputs()

    Dim effectiveIndex As Long
    Dim units As Double
    Dim t As Long

    If gRequestedStartDate > gEndDate Then
        Err.Raise vbObjectError + 120, , _
            "Analysis start date must be before or equal to the end date."
    End If

    If gRequestedStartDate < gCurveDates(1) Then
        Err.Raise vbObjectError + 121, , _
            "No curve date exists on or before the analysis start date."
    End If

    If gEndDate > gCurveDates(gCurveRows) + 7 Then
        Err.Raise vbObjectError + 122, , _
            "The analysis end date is more than seven calendar days after the final curve observation."
    End If

    If gNotional <= 0 Then
        Err.Raise vbObjectError + 123, , _
            "Initial notional must be greater than zero."
    End If

    If gWeightStep <= 0 Or gWeightStep > 1 Then
        Err.Raise vbObjectError + 124, , _
            "The frontier weight step must be greater than 0% and no more than 100%."
    End If

    units = 1# / gWeightStep
    If Abs(units - Round(units, 0)) > 0.0000001 Then
        Err.Raise vbObjectError + 125, , _
            "The frontier weight step must divide 100% exactly, such as 5%, 10%, 20% or 25%."
    End If

    effectiveIndex = LatestCurveIndexLE(gRequestedStartDate)
    gStartDate = gCurveDates(effectiveIndex)

    For t = 1 To TENOR_COUNT
        Call LatestValidRateIndexLE(gStartDate, t)
    Next t

End Sub


Private Sub InitializeCalculationArrays()

    Dim maxTransactions As Long
    Dim maxDailyRows As Long

    gNumDays = CLng(gEndDate - gStartDate) + 1
    maxTransactions = gCurveRows * TENOR_COUNT + 100
    maxDailyRows = gNumDays * TENOR_COUNT + 100

    ReDim gTx(1 To maxTransactions, 1 To 14)
    ReDim gDaily(1 To maxDailyRows, 1 To 20)
    ReDim gBalance(1 To TENOR_COUNT, 0 To gNumDays - 1)
    ReDim gDailyInterest(1 To TENOR_COUNT, 0 To gNumDays - 1)
    ReDim gOpeningPrincipal(1 To TENOR_COUNT, 0 To gNumDays - 1)
    ReDim gCompletedTransactions(1 To TENOR_COUNT)

    gTxCount = 0
    gDailyCount = 0

End Sub

' ============================================================================
' Daily transaction engine
' ============================================================================

Private Sub BuildAllStrategies()

    BuildOneStrategy 1, "ON", 0
    BuildOneStrategy 2, "1M", 1
    BuildOneStrategy 3, "2M", 2
    BuildOneStrategy 4, "3M", 3
    BuildOneStrategy 5, "6M", 6

End Sub

Private Sub BuildOneStrategy(ByVal tenorIndex As Long, ByVal tenorName As String, ByVal tenorMonths As Long)

    Dim actualStartIndex As Long
    Dim rateIndex As Long
    Dim rollIndex As Long
    Dim transactionID As Long

    Dim targetStart As Double
    Dim currentStart As Double
    Dim targetRoll As Double
    Dim actualRoll As Double
    Dim contractualEnd As Double

    Dim rateDate As Double
    Dim ratePercent As Double
    Dim principal As Double
    Dim fullInterest As Double
    Dim closingPrincipal As Double
    Dim priorInterestPaid As Double
    Dim dailyInterestAmount As Double

    Dim periodDays As Long
    Dim completed As Boolean
    Dim accrualStart As Double
    Dim accrualEnd As Double
    Dim currentDay As Double
    Dim dayNumber As Long
    Dim dayOffset As Long
    Dim adjustmentFlag As String
    Dim rollFlag As String
    Dim statusText As String
    Dim paidToday As Double

    actualStartIndex = LatestCurveIndexLE(gStartDate)
    currentStart = gCurveDates(actualStartIndex)
    targetStart = gRequestedStartDate
    principal = gNotional
    transactionID = 1
    priorInterestPaid = 0#

    Do While currentStart <= gEndDate

        rateIndex = LatestValidRateIndexLE(currentStart, tenorIndex)
        rateDate = gCurveDates(rateIndex)
        ratePercent = gRates(rateIndex, tenorIndex)

        actualRoll = 0#

        If tenorName = "ON" Then
            targetRoll = currentStart + 1
            rollIndex = NextCurveIndexAfter(currentStart)
            If rollIndex > 0 Then actualRoll = gCurveDates(rollIndex)
        Else
            targetRoll = CDbl(AddMonthsAnchored(CDate(gRequestedStartDate), transactionID * tenorMonths))
            If targetRoll <= gCurveDates(gCurveRows) Then
                rollIndex = LatestCurveIndexLE(targetRoll)
                actualRoll = gCurveDates(rollIndex)
            End If
        End If

        If actualRoll > 0 And actualRoll <= currentStart Then
            Err.Raise vbObjectError + 130, , _
                "No curve observation exists after " & Format(CDate(currentStart), "mm/dd/yyyy") & _
                " and on or before the target roll date " & Format(CDate(targetRoll), "mm/dd/yyyy") & _
                " for tenor " & tenorName & "."
        End If

        completed = (actualRoll > 0 And actualRoll <= gEndDate)

        If actualRoll > 0 Then
            contractualEnd = actualRoll
        Else
            contractualEnd = targetRoll
        End If

        periodDays = CLng(contractualEnd - currentStart)
        If periodDays < 0 Then periodDays = 0

        fullInterest = principal * (ratePercent / 100#) * periodDays / DAY_COUNT
        closingPrincipal = principal + fullInterest

        adjustmentFlag = ""
        If currentStart <> targetStart Then adjustmentFlag = AddFlag(adjustmentFlag, "Start adjusted to prior curve date")
        If actualRoll > 0 And actualRoll <> targetRoll Then adjustmentFlag = AddFlag(adjustmentFlag, "Roll adjusted to prior/available curve date")
        If rateDate <> currentStart Then adjustmentFlag = AddFlag(adjustmentFlag, "Rate from prior valid curve date")

        If completed Then
            statusText = "COMPLETED"
        Else
            statusText = "OPEN AT ANALYSIS END"
        End If

        AddTransactionRow tenorName, transactionID, targetStart, currentStart, rateDate, ratePercent, _
                          targetRoll, actualRoll, periodDays, principal, fullInterest, closingPrincipal, _
                          statusText, adjustmentFlag

        accrualStart = currentStart
        If accrualStart < gStartDate Then accrualStart = gStartDate

        accrualEnd = gEndDate
        If actualRoll > 0 And actualRoll - 1 < accrualEnd Then accrualEnd = actualRoll - 1

        dailyInterestAmount = principal * (ratePercent / 100#) / DAY_COUNT

        If accrualStart <= accrualEnd Then
            currentDay = accrualStart

            Do While currentDay <= accrualEnd

                dayNumber = CLng(currentDay - currentStart) + 1
                dayOffset = CLng(currentDay - gStartDate)

                If transactionID = 1 And currentDay = currentStart Then
                    rollFlag = "START"
                ElseIf transactionID > 1 And currentDay = currentStart Then
                    rollFlag = "ROLL / NEW DEAL"
                Else
                    rollFlag = ""
                End If

                If currentDay = currentStart Then
                    paidToday = priorInterestPaid
                Else
                    paidToday = 0#
                End If

                AddDailyRow currentDay, tenorName, transactionID, currentStart, targetRoll, actualRoll, _
                            rateDate, ratePercent, principal, dailyInterestAmount, _
                            dailyInterestAmount * dayNumber, fullInterest, paidToday, _
                            principal + dailyInterestAmount * dayNumber, dayNumber, periodDays, _
                            CLng(contractualEnd - currentDay), rollFlag, statusText, adjustmentFlag

                If dayOffset >= 0 And dayOffset < gNumDays Then
                    gBalance(tenorIndex, dayOffset) = principal + dailyInterestAmount * dayNumber
                    gDailyInterest(tenorIndex, dayOffset) = dailyInterestAmount
                    gOpeningPrincipal(tenorIndex, dayOffset) = principal
                End If

                currentDay = currentDay + 1
            Loop
        End If

        If Not completed Then Exit Do

        gCompletedTransactions(tenorIndex) = gCompletedTransactions(tenorIndex) + 1

        priorInterestPaid = fullInterest
        principal = closingPrincipal

        If tenorName = "ON" Then
            targetStart = actualRoll
        Else
            targetStart = targetRoll
        End If

        currentStart = actualRoll
        transactionID = transactionID + 1

    Loop

End Sub

Private Sub AddTransactionRow(ByVal tenorName As String, ByVal transactionID As Long, _
                              ByVal targetStart As Double, ByVal actualStart As Double, _
                              ByVal rateDate As Double, ByVal ratePercent As Double, _
                              ByVal targetRoll As Double, ByVal actualRoll As Double, _
                              ByVal transactionDays As Long, ByVal openingNotional As Double, _
                              ByVal periodInterest As Double, ByVal closingNotional As Double, _
                              ByVal statusText As String, ByVal adjustmentFlag As String)

    gTxCount = gTxCount + 1

    gTx(gTxCount, 1) = tenorName
    gTx(gTxCount, 2) = transactionID
    gTx(gTxCount, 3) = CDate(targetStart)
    gTx(gTxCount, 4) = CDate(actualStart)
    gTx(gTxCount, 5) = CDate(rateDate)
    gTx(gTxCount, 6) = ratePercent
    gTx(gTxCount, 7) = CDate(targetRoll)

    If actualRoll > 0 Then
        gTx(gTxCount, 8) = CDate(actualRoll)
    Else
        gTx(gTxCount, 8) = Empty
    End If

    gTx(gTxCount, 9) = transactionDays
    gTx(gTxCount, 10) = openingNotional
    gTx(gTxCount, 11) = periodInterest
    gTx(gTxCount, 12) = closingNotional
    gTx(gTxCount, 13) = statusText
    gTx(gTxCount, 14) = adjustmentFlag

End Sub

Private Sub AddDailyRow(ByVal accrualDate As Double, ByVal tenorName As String, _
                        ByVal transactionID As Long, ByVal transactionStart As Double, _
                        ByVal targetRoll As Double, ByVal actualRoll As Double, _
                        ByVal rateDate As Double, ByVal ratePercent As Double, _
                        ByVal openingNotional As Double, ByVal dailyInterestAmount As Double, _
                        ByVal cumulativeInterest As Double, ByVal fullPeriodInterest As Double, _
                        ByVal interestPaidToday As Double, ByVal economicBalance As Double, _
                        ByVal daysAccrued As Long, ByVal transactionDays As Long, _
                        ByVal daysToRoll As Long, ByVal rollFlag As String, _
                        ByVal statusText As String, ByVal adjustmentFlag As String)

    gDailyCount = gDailyCount + 1

    gDaily(gDailyCount, 1) = CDate(accrualDate)
    gDaily(gDailyCount, 2) = tenorName
    gDaily(gDailyCount, 3) = transactionID
    gDaily(gDailyCount, 4) = CDate(transactionStart)
    gDaily(gDailyCount, 5) = CDate(targetRoll)

    If actualRoll > 0 Then
        gDaily(gDailyCount, 6) = CDate(actualRoll)
    Else
        gDaily(gDailyCount, 6) = Empty
    End If

    gDaily(gDailyCount, 7) = CDate(rateDate)
    gDaily(gDailyCount, 8) = ratePercent
    gDaily(gDailyCount, 9) = openingNotional
    gDaily(gDailyCount, 10) = dailyInterestAmount
    gDaily(gDailyCount, 11) = cumulativeInterest
    gDaily(gDailyCount, 12) = fullPeriodInterest
    gDaily(gDailyCount, 13) = interestPaidToday
    gDaily(gDailyCount, 14) = economicBalance
    gDaily(gDailyCount, 15) = daysAccrued
    gDaily(gDailyCount, 16) = transactionDays
    gDaily(gDailyCount, 17) = daysToRoll
    gDaily(gDailyCount, 18) = rollFlag
    gDaily(gDailyCount, 19) = statusText
    gDaily(gDailyCount, 20) = adjustmentFlag

End Sub

' ============================================================================
' Output sheets
' ============================================================================

Private Sub WriteDataQuality()

    Dim ws As Worksheet
    Dim t As Long, missingCount As Long
    Dim rowNumber As Long

    Set ws = PrepareOutputSheet("Data_Quality", "Data Quality and Model Controls", "C")

    WriteRow ws.Range("A3"), Array("Check", "Result", "Status")
    ApplyHeaderStyle ws.Range("A3:C3")

    rowNumber = 4
    ws.Cells(rowNumber, 1).Value = "Curve rows": ws.Cells(rowNumber, 2).Value = gCurveRows: ws.Cells(rowNumber, 3).Value = "PASS": rowNumber = rowNumber + 1
    ws.Cells(rowNumber, 1).Value = "Curve start": ws.Cells(rowNumber, 2).Value = CDate(gCurveDates(1)): ws.Cells(rowNumber, 3).Value = "PASS": rowNumber = rowNumber + 1
    ws.Cells(rowNumber, 1).Value = "Curve end": ws.Cells(rowNumber, 2).Value = CDate(gCurveDates(gCurveRows)): ws.Cells(rowNumber, 3).Value = "PASS": rowNumber = rowNumber + 1
    ws.Cells(rowNumber, 1).Value = "Duplicate / non-ascending dates": ws.Cells(rowNumber, 2).Value = 0: ws.Cells(rowNumber, 3).Value = "PASS": rowNumber = rowNumber + 1

    For t = 1 To TENOR_COUNT
        missingCount = CountMissingRates(t)
        ws.Cells(rowNumber, 1).Value = "Missing " & TenorName(t) & " rates"
        ws.Cells(rowNumber, 2).Value = missingCount
        ws.Cells(rowNumber, 3).Value = IIf(missingCount = 0, "PASS", "REVIEW")
        rowNumber = rowNumber + 1
    Next t

    ws.Range("B5:B6").NumberFormat = "mm/dd/yyyy"
    ws.Columns("A:C").AutoFit

End Sub

Private Sub WriteTransactions()

    Dim ws As Worksheet
    Dim headers As Variant

    Set ws = PrepareOutputSheet("Transactions", "Transaction Schedule", "N")

    headers = Array("Tenor", "Transaction ID", "Target Start Date", "Actual Start Date", _
                    "Rate Observation Date", "Rate Used (%)", "Target Roll Date", _
                    "Actual Roll Date", "Transaction Days", "Opening Notional ($)", _
                    "Period Interest ($)", "Closing Notional ($)", "Status", "Adjustment Flag")

    ws.Range("A3:N3").Value = headers
    ApplyHeaderStyle ws.Range("A3:N3")
    WriteTrimmedArray ws.Range("A4"), gTx, gTxCount, 14

    ws.Range("C4:E" & gTxCount + 3).NumberFormat = "mm/dd/yyyy"
    ws.Range("G4:H" & gTxCount + 3).NumberFormat = "mm/dd/yyyy"
    ws.Range("F4:F" & gTxCount + 3).NumberFormat = "0.0000;[Red](0.0000);-"
    ws.Range("J4:L" & gTxCount + 3).NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Columns("A:N").AutoFit
    ws.Columns("N").ColumnWidth = 38
    ws.Range("A3:N3").AutoFilter

End Sub

Private Sub WriteDailyAccrual()

    Dim ws As Worksheet
    Dim headers As Variant

    Set ws = PrepareOutputSheet("Daily_Accrual", "Daily Accrual Ledger", "T")

    headers = Array("Accrual Date", "Tenor", "Transaction ID", "Transaction Start Date", _
                    "Target Roll Date", "Actual Roll Date", "Rate Observation Date", _
                    "Rate Used (%)", "Opening Notional ($)", "Daily Interest ($)", _
                    "Cumulative Period Interest ($)", "Full Period Interest ($)", _
                    "Interest Paid Today ($)", "Economic Balance ($)", "Days Accrued", _
                    "Transaction Days", "Days to Roll", "Roll Flag", "Status", "Adjustment Flag")

    ws.Range("A3:T3").Value = headers
    ApplyHeaderStyle ws.Range("A3:T3")
    WriteTrimmedArray ws.Range("A4"), gDaily, gDailyCount, 20

    ws.Range("A4:A" & gDailyCount + 3).NumberFormat = "mm/dd/yyyy"
    ws.Range("D4:G" & gDailyCount + 3).NumberFormat = "mm/dd/yyyy"
    ws.Range("H4:H" & gDailyCount + 3).NumberFormat = "0.0000;[Red](0.0000);-"
    ws.Range("I4:N" & gDailyCount + 3).NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Columns("A:T").AutoFit
    ws.Columns("T").ColumnWidth = 38
    ws.Range("A3:T3").AutoFilter

End Sub

Private Sub BuildPremiumAnalysis()

    Dim ws As Worksheet
    Dim firstCurveIndex As Long, lastCurveIndex As Long
    Dim outputRows As Long, i As Long, r As Long
    Dim data() As Variant
    Dim lastDataRow As Long
    Dim statsRow As Long
    Dim premiumCol As Long

    Set ws = PrepareOutputSheet("Premium_Analysis", "Historical Curve and Term Premium", "T")

    firstCurveIndex = LatestCurveIndexLE(gStartDate)
    If gCurveDates(firstCurveIndex) < gStartDate Then firstCurveIndex = firstCurveIndex + 1
    lastCurveIndex = LatestCurveIndexLE(gEndDate)

    outputRows = lastCurveIndex - firstCurveIndex + 1
    ReDim data(1 To outputRows, 1 To 10)

    r = 0
    For i = firstCurveIndex To lastCurveIndex
        r = r + 1
        data(r, 1) = CDate(gCurveDates(i))
        data(r, 2) = gRates(i, 1)
        data(r, 3) = gRates(i, 2)
        data(r, 4) = gRates(i, 3)
        data(r, 5) = gRates(i, 4)
        data(r, 6) = gRates(i, 5)
        data(r, 7) = (gRates(i, 2) - gRates(i, 1)) * 100#
        data(r, 8) = (gRates(i, 3) - gRates(i, 1)) * 100#
        data(r, 9) = (gRates(i, 4) - gRates(i, 1)) * 100#
        data(r, 10) = (gRates(i, 5) - gRates(i, 1)) * 100#
    Next i

    WriteRow ws.Range("A3"), Array("Date", "ON", "1M", "2M", "3M", "6M", _
                                      "1M Premium (bps)", "2M Premium (bps)", _
                                      "3M Premium (bps)", "6M Premium (bps)")
    ApplyHeaderStyle ws.Range("A3:J3")
    ws.Range("A4").Resize(outputRows, 10).Value = data

    lastDataRow = outputRows + 3
    ws.Range("A4:A" & lastDataRow).NumberFormat = "mm/dd/yyyy"
    ws.Range("B4:F" & lastDataRow).NumberFormat = "0.0000;[Red](0.0000);-"
    ws.Range("G4:J" & lastDataRow).NumberFormat = "0.0;[Red](0.0);-"

    WriteRow ws.Range("L3"), Array("Tenor", "Average (bps)", "Median (bps)", "Minimum (bps)", _
                                    "Maximum (bps)", "% Positive", "Current (bps)", _
                                    "5th Percentile (bps)", "95th Percentile (bps)")
    ApplyHeaderStyle ws.Range("L3:T3")

    For i = 1 To 4
        statsRow = i + 3
        premiumCol = 6 + i

        ws.Cells(statsRow, 12).Value = TenorName(i + 1)
        ws.Cells(statsRow, 13).Formula = "=AVERAGE(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ")"
        ws.Cells(statsRow, 14).Formula = "=MEDIAN(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ")"
        ws.Cells(statsRow, 15).Formula = "=MIN(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ")"
        ws.Cells(statsRow, 16).Formula = "=MAX(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ")"
        ws.Cells(statsRow, 17).Formula = "=COUNTIF(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ","">0"")/COUNT(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ")"
        ws.Cells(statsRow, 18).Formula = "=" & ws.Cells(lastDataRow, premiumCol).Address(False, False)
        ws.Cells(statsRow, 19).Formula = "=PERCENTILE.INC(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ",5%)"
        ws.Cells(statsRow, 20).Formula = "=PERCENTILE.INC(" & ws.Range(ws.Cells(4, premiumCol), ws.Cells(lastDataRow, premiumCol)).Address(False, False) & ",95%)"
    Next i

    ws.Range("M4:P7").NumberFormat = "0.0;[Red](0.0);-"
    ws.Range("Q4:Q7").NumberFormat = "0%"
    ws.Range("R4:T7").NumberFormat = "0.0;[Red](0.0);-"
    ws.Columns("A:T").AutoFit

End Sub

Private Sub BuildRollingResults()

    Dim ws As Worksheet
    Dim growth() As Variant
    Dim summary() As Variant
    Dim i As Long, t As Long
    Dim endingValue As Double, totalInterest As Double
    Dim totalDailyInterest As Double, totalOpening As Double
    Dim currentDate As Double
    Dim outputRow As Long
    Dim quarterStart As Date, quarterEnd As Date
    Dim q As Long

    Set ws = PrepareOutputSheet("Rolling_Results", "Rolling Investment Results", "O")

    ReDim growth(1 To gNumDays, 1 To 6)

    For i = 0 To gNumDays - 1
        currentDate = gStartDate + i
        growth(i + 1, 1) = CDate(currentDate)

        For t = 1 To TENOR_COUNT
            growth(i + 1, t + 1) = gBalance(t, i)
        Next t
    Next i

    WriteRow ws.Range("A3"), Array("Date", "ON", "1M", "2M", "3M", "6M")
    ApplyHeaderStyle ws.Range("A3:F3")
    ws.Range("A4").Resize(gNumDays, 6).Value = growth
    ws.Range("A4:A" & gNumDays + 3).NumberFormat = "mm/dd/yyyy"
    ws.Range("B4:F" & gNumDays + 3).NumberFormat = "$#,##0;[Red]($#,##0);-"

    ReDim summary(1 To TENOR_COUNT, 1 To 8)

    For t = 1 To TENOR_COUNT
        endingValue = gBalance(t, gNumDays - 1)
        totalInterest = endingValue - gNotional

        totalDailyInterest = 0#
        totalOpening = 0#

        For i = 0 To gNumDays - 1
            totalDailyInterest = totalDailyInterest + gDailyInterest(t, i)
            totalOpening = totalOpening + gOpeningPrincipal(t, i)
        Next i

        gEndingValue(t) = endingValue
        gTotalInterest(t) = totalInterest
        gAnnualizedReturn(t) = (endingValue / gNotional) ^ (DAY_COUNT / gNumDays) - 1#

        If totalOpening > 0 Then
            gAverageRate(t) = totalDailyInterest * DAY_COUNT / totalOpening
        Else
            gAverageRate(t) = 0#
        End If

        summary(t, 1) = TenorName(t)
        summary(t, 2) = endingValue
        summary(t, 3) = totalInterest
        summary(t, 4) = endingValue / gNotional - 1#
        summary(t, 5) = gAnnualizedReturn(t)
        summary(t, 6) = gAverageRate(t)
        summary(t, 7) = gCompletedTransactions(t)
        summary(t, 8) = totalInterest - gTotalInterest(1)
    Next t

    WriteRow ws.Range("H3"), Array("Tenor", "Ending Value ($)", "Total Interest ($)", _
                                     "Total Return (%)", "Annualized Return (%)", _
                                     "Average Invested Rate (%)", "Completed Transactions", _
                                     "Incremental Interest vs ON ($)")
    ApplyHeaderStyle ws.Range("H3:O3")
    ws.Range("H4").Resize(TENOR_COUNT, 8).Value = summary
    ws.Range("I4:J8").NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Range("K4:M8").NumberFormat = "0.00%"
    ws.Range("N4:N8").NumberFormat = "0"
    ws.Range("O4:O8").NumberFormat = "$#,##0;[Red]($#,##0);-"

    WriteRow ws.Range("H11"), Array("Period", "ON", "1M", "2M", "3M", "6M")
    ApplyHeaderStyle ws.Range("H11:M11")

    outputRow = 12
    quarterStart = DateSerial(Year(CDate(gStartDate)), ((Month(CDate(gStartDate)) - 1) \ 3) * 3 + 1, 1)

    Do While quarterStart <= CDate(gEndDate)
        quarterEnd = DateAdd("d", -1, DateAdd("q", 1, quarterStart))
        ws.Cells(outputRow, 8).Value = "Q" & DatePart("q", quarterStart) & " " & Year(quarterStart)

        For t = 1 To TENOR_COUNT
            ws.Cells(outputRow, 8 + t).Value = SumDailyInterestBetween(t, CDbl(quarterStart), CDbl(quarterEnd))
        Next t

        outputRow = outputRow + 1
        quarterStart = DateAdd("q", 1, quarterStart)
    Loop

    ws.Range("I12:M" & outputRow - 1).NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Columns("A:O").AutoFit

End Sub

Private Sub BuildMonthlyReturns()

    Dim ws As Worksheet
    Dim firstFullMonthEnd As Date
    Dim currentMonthEnd As Date
    Dim monthCount As Long, i As Long, t As Long
    Dim previousBalance As Double, currentBalance As Double
    Dim riskData() As Variant

    Set ws = PrepareOutputSheet("Monthly_Returns", "Monthly Economic Returns", "K")

    firstFullMonthEnd = DateSerial(Year(CDate(gStartDate)), Month(CDate(gStartDate)) + 1, 0)
    If DateSerial(Year(firstFullMonthEnd), Month(firstFullMonthEnd), 1) < CDate(gStartDate) Then
        firstFullMonthEnd = DateSerial(Year(CDate(gStartDate)), Month(CDate(gStartDate)) + 2, 0)
    End If

    currentMonthEnd = firstFullMonthEnd
    monthCount = 0

    Do While currentMonthEnd <= CDate(gEndDate)
        monthCount = monthCount + 1
        If monthCount = 1 Then
            ReDim gMonthEndDates(1 To 1)
        Else
            ReDim Preserve gMonthEndDates(1 To monthCount)
        End If
        gMonthEndDates(monthCount) = CDbl(currentMonthEnd)
        currentMonthEnd = DateSerial(Year(currentMonthEnd), Month(currentMonthEnd) + 2, 0)
    Loop

    If monthCount < 2 Then
        Err.Raise vbObjectError + 150, , "At least two complete month-end observations are required for volatility analysis."
    End If

    gMonthlyCount = monthCount - 1
    ReDim gMonthlyReturns(1 To gMonthlyCount, 1 To TENOR_COUNT)

    WriteRow ws.Range("A3"), Array("Month End", "ON", "1M", "2M", "3M", "6M")
    ApplyHeaderStyle ws.Range("A3:F3")

    For i = 2 To monthCount
        ws.Cells(i + 2, 1).Value = CDate(gMonthEndDates(i))

        For t = 1 To TENOR_COUNT
            previousBalance = BalanceOnDate(t, gMonthEndDates(i - 1))
            currentBalance = BalanceOnDate(t, gMonthEndDates(i))
            gMonthlyReturns(i - 1, t) = currentBalance / previousBalance - 1#
            ws.Cells(i + 2, t + 1).Value = gMonthlyReturns(i - 1, t)
        Next t
    Next i

    ws.Range("A4:A" & gMonthlyCount + 3).NumberFormat = "mmm-yy"
    ws.Range("B4:F" & gMonthlyCount + 3).NumberFormat = "0.000%"

    ReDim riskData(1 To TENOR_COUNT, 1 To 4)

    For t = 1 To TENOR_COUNT
        gTenorAnnualReturn(t) = GeometricAnnualReturnForTenor(t)
        gTenorAnnualVol(t) = SampleStDevForTenor(t) * Sqr(12#)

        riskData(t, 1) = TenorName(t)
        riskData(t, 2) = gTenorAnnualReturn(t)
        riskData(t, 3) = gTenorAnnualVol(t)
        riskData(t, 4) = TenorMaturityMonths(t)
    Next t

    WriteRow ws.Range("H3"), Array("Portfolio", "Annualized Return (%)", _
                                     "Annualized Volatility (%)", _
                                     "Weighted Average Maturity (Months)")
    ApplyHeaderStyle ws.Range("H3:K3")
    ws.Range("H4").Resize(TENOR_COUNT, 4).Value = riskData
    ws.Range("I4:J8").NumberFormat = "0.000%"
    ws.Range("K4:K8").NumberFormat = "0.0"
    ws.Columns("A:K").AutoFit

End Sub

Private Sub BuildPortfolioAnalysis()

    Dim ws As Worksheet
    Dim units As Long, totalCombos As Long
    Dim comboData() As Variant
    Dim comboRow As Long
    Dim w0 As Long, w1 As Long, w2 As Long, w3 As Long, w4 As Long
    Dim weights(1 To TENOR_COUNT) As Double
    Dim annualReturn As Double, annualVol As Double
    Dim ratio As Double, wam As Double
    Dim lastComboRow As Long
    Dim rowNumber As Long
    Dim bestReturn As Double
    Dim minVolRow As Long, maxRatioRow As Long
    Dim minVolValue As Double, maxRatioValue As Double
    Dim sourceRow As Long

    Set ws = PrepareOutputSheet("Portfolio_Analysis", "Historical Maturity Diversification", "W")

    units = CLng(Application.WorksheetFunction.Round(1# / gWeightStep, 0))
    If units < 1 Then units = 10
    totalCombos = CLng((units + 4#) * (units + 3#) * (units + 2#) * (units + 1#) / 24#)

    ReDim comboData(1 To totalCombos, 1 To 13)
    comboRow = 0

    For w0 = 0 To units
        For w1 = 0 To units - w0
            For w2 = 0 To units - w0 - w1
                For w3 = 0 To units - w0 - w1 - w2

                    w4 = units - w0 - w1 - w2 - w3

                    weights(1) = w0 / units
                    weights(2) = w1 / units
                    weights(3) = w2 / units
                    weights(4) = w3 / units
                    weights(5) = w4 / units

                    CalculatePortfolioStats weights, annualReturn, annualVol

                    If annualVol > 0 Then
                        ratio = annualReturn / annualVol
                    Else
                        ratio = 0#
                    End If

                    wam = weights(2) + 2# * weights(3) + 3# * weights(4) + 6# * weights(5)

                    comboRow = comboRow + 1
                    comboData(comboRow, 1) = weights(1)
                    comboData(comboRow, 2) = weights(2)
                    comboData(comboRow, 3) = weights(3)
                    comboData(comboRow, 4) = weights(4)
                    comboData(comboRow, 5) = weights(5)
                    comboData(comboRow, 6) = annualReturn
                    comboData(comboRow, 7) = annualVol
                    comboData(comboRow, 8) = ratio
                    comboData(comboRow, 9) = wam
                    comboData(comboRow, 10) = weights(1) + weights(2)
                    comboData(comboRow, 11) = weights(1) + weights(2) + weights(3)
                    comboData(comboRow, 12) = weights(1) + weights(2) + weights(3) + weights(4)
                    comboData(comboRow, 13) = 1#
                Next w3
            Next w2
        Next w1
    Next w0

    WriteRow ws.Range("A3"), Array("ON Weight", "1M Weight", "2M Weight", "3M Weight", "6M Weight", _
                                     "Annualized Return (%)", "Annualized Volatility (%)", _
                                     "Return / Volatility", "Weighted Average Maturity (Months)", _
                                     "Available <=30D (%)", "Available <=60D (%)", _
                                     "Available <=90D (%)", "Available <=180D (%)")
    ApplyHeaderStyle ws.Range("A3:M3")
    ws.Range("A4").Resize(comboRow, 13).Value = comboData

    lastComboRow = comboRow + 3

    ws.Range("A4:E" & lastComboRow).NumberFormat = "0%"
    ws.Range("F4:G" & lastComboRow).NumberFormat = "0.000%"
    ws.Range("H4:H" & lastComboRow).NumberFormat = "0.00x"
    ws.Range("I4:I" & lastComboRow).NumberFormat = "0.0"
    ws.Range("J4:M" & lastComboRow).NumberFormat = "0%"

    ws.Range("A4:M" & lastComboRow).Sort Key1:=ws.Range("G4"), Order1:=xlAscending, Header:=xlNo

    minVolRow = 4
    minVolValue = ws.Cells(4, 7).Value
    maxRatioRow = 4
    maxRatioValue = ws.Cells(4, 8).Value

    For rowNumber = 4 To lastComboRow
        If ws.Cells(rowNumber, 7).Value < minVolValue Then
            minVolValue = ws.Cells(rowNumber, 7).Value
            minVolRow = rowNumber
        End If

        If ws.Cells(rowNumber, 8).Value > maxRatioValue Then
            maxRatioValue = ws.Cells(rowNumber, 8).Value
            maxRatioRow = rowNumber
        End If
    Next rowNumber

    WriteRow ws.Range("O3"), Array("Portfolio", "ON Weight", "1M Weight", "2M Weight", _
                                     "3M Weight", "6M Weight", "Annualized Return (%)", _
                                     "Annualized Volatility (%)", _
                                     "Weighted Average Maturity (Months)")
    ApplyHeaderStyle ws.Range("O3:W3")

    CopyPortfolioExample ws, 4, "100% ON", FindWeightRow(ws, lastComboRow, 1#, 0#, 0#, 0#, 0#)
    CopyPortfolioExample ws, 5, "Minimum Volatility", minVolRow
    WriteEqualWeightExample ws, 6
    CopyPortfolioExample ws, 7, "Maximum Return / Volatility", maxRatioRow
    CopyPortfolioExample ws, 8, "100% 6M", FindWeightRow(ws, lastComboRow, 0#, 0#, 0#, 0#, 1#)

    ws.Range("P4:T8").NumberFormat = "0%"
    ws.Range("U4:V8").NumberFormat = "0.000%"
    ws.Range("W4:W8").NumberFormat = "0.0"

    WriteRow ws.Range("O11"), Array("Annualized Volatility (%)", "Annualized Return (%)", _
                                      "ON Weight", "1M Weight", "2M Weight", "3M Weight", "6M Weight")
    ApplyHeaderStyle ws.Range("O11:U11")

    rowNumber = 12
    bestReturn = -1E+99

    For sourceRow = 4 To lastComboRow
        If ws.Cells(sourceRow, 6).Value > bestReturn + 0.0000000001 Then
            ws.Cells(rowNumber, 15).Value = ws.Cells(sourceRow, 7).Value
            ws.Cells(rowNumber, 16).Value = ws.Cells(sourceRow, 6).Value
            ws.Cells(rowNumber, 17).Resize(1, 5).Value = ws.Cells(sourceRow, 1).Resize(1, 5).Value
            bestReturn = ws.Cells(sourceRow, 6).Value
            rowNumber = rowNumber + 1
        End If
    Next sourceRow

    ws.Range("O12:P" & rowNumber - 1).NumberFormat = "0.000%"
    ws.Range("Q12:U" & rowNumber - 1).NumberFormat = "0%"
    ws.Columns("A:W").AutoFit

End Sub

Private Sub BuildSwapAnalysis()

    Dim ws As Worksheet
    Dim swapWs As Worksheet
    Dim statusText As String

    Set swapWs = GetOrCreateSheet("Swap_Data")
    EnsureSwapDataLayout swapWs

    Set ws = PrepareOutputSheet("Swap_Analysis", "Long Deposit + Pay Fixed / Receive Floating Swap", "J")

    WriteRow ws.Range("A3"), Array("Assumption", "Value")
    ApplyHeaderStyle ws.Range("A3:B3")
    ws.Range("A4").Value = "Long deposit tenor": ws.Range("B4").Value = "6M"
    ws.Range("A5").Value = "Floating index": ws.Range("B5").Value = "Daily compounded SOFR"
    ws.Range("A6").Value = "Swap direction": ws.Range("B6").Value = "Pay fixed / receive floating"
    ws.Range("A7").Value = "Day count": ws.Range("B7").Value = "ACT/360"
    ws.Range("A8").Value = "Status": ws.Range("B8").Value = "AWAITING SWAP_DATA INPUT"

    WriteRow ws.Range("D3"), Array("Strategy", "Ending Value ($)", "Total Interest ($)", _
                                    "Annualized Return (%)", "Incremental vs ON ($)", _
                                    "Rate Volatility (%)", "Status")
    ApplyHeaderStyle ws.Range("D3:J3")

    ws.Range("D4").Value = "1M rolling"
    ws.Range("E4").Value = gEndingValue(2)
    ws.Range("F4").Value = gTotalInterest(2)
    ws.Range("G4").Value = gAnnualizedReturn(2)
    ws.Range("H4").Value = gTotalInterest(2) - gTotalInterest(1)
    ws.Range("I4").Value = gTenorAnnualVol(2)
    ws.Range("J4").Value = "CALCULATED"

    ws.Range("D5").Value = "6M fixed deposit"
    ws.Range("E5").Value = gEndingValue(5)
    ws.Range("F5").Value = gTotalInterest(5)
    ws.Range("G5").Value = gAnnualizedReturn(5)
    ws.Range("H5").Value = gTotalInterest(5) - gTotalInterest(1)
    ws.Range("I5").Value = gTenorAnnualVol(5)
    ws.Range("J5").Value = "CALCULATED"

    ws.Range("D6").Value = "6M deposit + swap"
    ws.Range("J6").Value = "AWAITING DATA"

    ws.Range("E4:F6").NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Range("G4:G6").NumberFormat = "0.00%"
    ws.Range("H4:H6").NumberFormat = "$#,##0;[Red]($#,##0);-"
    ws.Range("I4:I6").NumberFormat = "0.000%"

    If SwapDataIsComplete(swapWs) Then
        statusText = CalculateSwapOverlay(swapWs, ws)
        ws.Range("B8").Value = statusText
    End If

    ws.Range("A10:J10").Merge
    ws.Range("A10").Value = "No proxy is used. The ON deposit rate is not assumed to equal SOFR."
    ws.Range("A10:J10").Interior.Color = RGB(238, 245, 251)
    ws.Range("A10:J10").WrapText = True
    ws.Columns("A:J").AutoFit

End Sub

Private Function SwapDataIsComplete(ByVal ws As Worksheet) As Boolean

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    If lastRow < 4 Then
        SwapDataIsComplete = False
        Exit Function
    End If

    SwapDataIsComplete = (Application.WorksheetFunction.Count(ws.Range("B4:B" & lastRow)) > 0 And _
                          Application.WorksheetFunction.Count(ws.Range("C4:C" & lastRow)) > 0)

End Function

Private Function CalculateSwapOverlay(ByVal swapWs As Worksheet, ByVal outputWs As Worksheet) As String

    Dim lastSwapRow As Long
    Dim swapDates() As Double, sofrRates() As Double, fixedRates() As Double
    Dim validSOFR() As Boolean, validFixed() As Boolean
    Dim n As Long, r As Long
    Dim dailyRow As Long, transactionID As Long, previousTransactionID As Long
    Dim accrualDate As Double, transactionStart As Double
    Dim principal As Double, fixedRate As Double, sofrRate As Double
    Dim factor As Double, floatingDaily As Double, fixedDaily As Double
    Dim cumulativeSwap As Double
    Dim overlayDaily() As Double
    Dim dayOffset As Long
    Dim overlayEnding As Double, overlayInterest As Double, overlayAnnual As Double
    Dim overlayMonthly() As Double, overlayVol As Double
    Dim i As Long

    lastSwapRow = swapWs.Cells(swapWs.Rows.Count, 1).End(xlUp).Row
    n = lastSwapRow - 3

    ReDim swapDates(1 To n)
    ReDim sofrRates(1 To n)
    ReDim fixedRates(1 To n)
    ReDim validSOFR(1 To n)
    ReDim validFixed(1 To n)

    For r = 4 To lastSwapRow
        i = r - 3
        If IsDate(swapWs.Cells(r, 1).Value) Then
            swapDates(i) = CDbl(CDate(swapWs.Cells(r, 1).Value))
        Else
            CalculateSwapOverlay = "INVALID SWAP DATE"
            Exit Function
        End If

        If IsNumeric(swapWs.Cells(r, 2).Value) And Len(swapWs.Cells(r, 2).Value) > 0 Then
            sofrRates(i) = CDbl(swapWs.Cells(r, 2).Value)
            validSOFR(i) = True
        End If

        If IsNumeric(swapWs.Cells(r, 3).Value) And Len(swapWs.Cells(r, 3).Value) > 0 Then
            fixedRates(i) = CDbl(swapWs.Cells(r, 3).Value)
            validFixed(i) = True
        End If
    Next r

    ReDim overlayDaily(0 To gNumDays - 1)
    cumulativeSwap = 0#
    previousTransactionID = -1
    factor = 1#

    For dailyRow = 1 To gDailyCount
        If CStr(gDaily(dailyRow, 2)) = "6M" Then

            accrualDate = CDbl(CDate(gDaily(dailyRow, 1)))
            transactionID = CLng(gDaily(dailyRow, 3))
            transactionStart = CDbl(CDate(gDaily(dailyRow, 4)))
            principal = CDbl(gDaily(dailyRow, 9))

            If transactionID <> previousTransactionID Then
                factor = 1#
                fixedRate = LookupExternalRate(transactionStart, swapDates, fixedRates, validFixed, n)
                If fixedRate = -1E+99 Then
                    CalculateSwapOverlay = "MISSING FIXED SWAP RATE"
                    Exit Function
                End If
                previousTransactionID = transactionID
            End If

            sofrRate = LookupExternalRate(accrualDate, swapDates, sofrRates, validSOFR, n)
            If sofrRate = -1E+99 Then
                CalculateSwapOverlay = "MISSING SOFR RATE"
                Exit Function
            End If

            floatingDaily = principal * factor * (sofrRate / 100#) / DAY_COUNT
            factor = factor * (1# + (sofrRate / 100#) / DAY_COUNT)
            fixedDaily = principal * (fixedRate / 100#) / DAY_COUNT

            cumulativeSwap = cumulativeSwap + floatingDaily - fixedDaily
            dayOffset = CLng(accrualDate - gStartDate)
            If dayOffset >= 0 And dayOffset < gNumDays Then
                overlayDaily(dayOffset) = gBalance(5, dayOffset) + cumulativeSwap
            End If
        End If
    Next dailyRow

    overlayEnding = overlayDaily(gNumDays - 1)
    overlayInterest = overlayEnding - gNotional
    overlayAnnual = (overlayEnding / gNotional) ^ (DAY_COUNT / gNumDays) - 1#

    ReDim overlayMonthly(1 To gMonthlyCount)

    For i = 1 To gMonthlyCount
        overlayMonthly(i) = overlayDaily(CLng(gMonthEndDates(i + 1) - gStartDate)) / _
                            overlayDaily(CLng(gMonthEndDates(i) - gStartDate)) - 1#
    Next i

    overlayVol = SampleStDevArray(overlayMonthly, gMonthlyCount) * Sqr(12#)

    WriteRow outputWs.Range("D6"), Array("6M deposit + swap", overlayEnding, overlayInterest, _
                                          overlayAnnual, overlayInterest - gTotalInterest(1), _
                                          overlayVol, "CALCULATED")
    outputWs.Range("E6:F6").NumberFormat = "$#,##0;[Red]($#,##0);-"
    outputWs.Range("G6").NumberFormat = "0.00%"
    outputWs.Range("H6").NumberFormat = "$#,##0;[Red]($#,##0);-"
    outputWs.Range("I6").NumberFormat = "0.000%"

    CalculateSwapOverlay = "CALCULATED"

End Function

Private Sub EnsureSwapDataLayout(ByVal ws As Worksheet)

    Dim r As Long
    Dim curveIndex As Long
    Dim outputRow As Long

    If Len(ws.Range("A1").Value) = 0 Then
        ws.Cells.Clear
        ws.Range("A1:E1").Merge
        ws.Range("A1").Value = "Swap Market Data Input"
        ApplyTitleStyle ws.Range("A1:E1")

        WriteRow ws.Range("A3"), Array("Date", "SOFR (%)", "6M Swap Fixed (%)", _
                                        "1Y Swap Fixed (%)", "Source / Notes")
        ApplyHeaderStyle ws.Range("A3:E3")

        outputRow = 4
        For curveIndex = 1 To gCurveRows
            If gCurveDates(curveIndex) >= gStartDate And gCurveDates(curveIndex) <= gEndDate Then
                ws.Cells(outputRow, 1).Value = CDate(gCurveDates(curveIndex))
                outputRow = outputRow + 1
            End If
        Next curveIndex

        ws.Range("A4:A" & outputRow - 1).NumberFormat = "mm/dd/yyyy"
        ws.Range("B4:D" & outputRow - 1).NumberFormat = "0.0000"
        ws.Range("B4:E" & outputRow - 1).Font.Color = RGB(0, 0, 255)
        ws.Columns("A:E").AutoFit
    End If

End Sub


Private Sub BuildChartData()

    Dim ws As Worksheet
    Dim premiumWs As Worksheet
    Dim portfolioWs As Worksheet
    Dim currentKey As String, nextKey As String
    Dim curveStartIndex As Long, curveEndIndex As Long
    Dim lastIndexInMonth As Long
    Dim i As Long, t As Long, outputRow As Long
    Dim d As Date
    Dim finalMonthLabel As String
    Dim frontierLastRow As Long
    Dim onReturn As Double
    Dim volBps As Double, returnDiffBps As Double
    Dim minimumVol As Double, maximumReturn As Double
    Dim minimumVolRow As Long, maximumReturnRow As Long
    Dim r As Long

    Set ws = GetOrCreateSheet("Chart_Data")
    ws.Cells.UnMerge
    ws.Cells.Clear

    Do While ws.ChartObjects.Count > 0
        ws.ChartObjects(1).Delete
    Loop

    WriteRow ws.Range("A1"), Array("Month", "ON", "1M", "2M", "3M", "6M")
    WriteRow ws.Range("H1"), Array("Month", "1M", "2M", "3M", "6M")
    WriteRow ws.Range("N1"), Array("Tenor", "Historical Average", "Current")
    WriteRow ws.Range("R1"), Array("Tenor", "Incremental Interest vs ON ($000)")
    WriteRow ws.Range("U1"), Array("Tenor", "Annualized Volatility (bps)", "Return vs ON (bps)")
    WriteRow ws.Range("Y1"), Array("Annualized Volatility (bps)", "Return vs ON (bps)")
    WriteRow ws.Range("AB1"), Array("Point", "Annualized Volatility (bps)", "Return vs ON (bps)")
    WriteRow ws.Range("AF1"), Array("Tenor", "Total Interest ($MM)", "Annualized Return", _
                                    "Volatility (bps)", "Return vs ON (bps)")

    ' Historical rates: last available curve observation in each month.
    curveStartIndex = LatestCurveIndexLE(gStartDate)
    curveEndIndex = LatestCurveIndexLE(Application.WorksheetFunction.Min(gEndDate, gCurveDates(gCurveRows)))

    outputRow = 2
    i = curveStartIndex

    Do While i <= curveEndIndex

        currentKey = Format(CDate(gCurveDates(i)), "yyyymm")
        lastIndexInMonth = i

        Do While lastIndexInMonth + 1 <= curveEndIndex
            nextKey = Format(CDate(gCurveDates(lastIndexInMonth + 1)), "yyyymm")
            If nextKey <> currentKey Then Exit Do
            lastIndexInMonth = lastIndexInMonth + 1
        Loop

        ws.Cells(outputRow, 1).Value = Format(CDate(gCurveDates(lastIndexInMonth)), "mmm-yy")
        For t = 1 To TENOR_COUNT
            ws.Cells(outputRow, t + 1).Value = gRates(lastIndexInMonth, t)
        Next t

        outputRow = outputRow + 1
        i = lastIndexInMonth + 1
    Loop

    ' Cumulative interest difference versus ON, shown in $000.
    outputRow = 2
    d = DateSerial(Year(CDate(gStartDate)), Month(CDate(gStartDate)) + 1, 0)

    Do While d <= CDate(gEndDate)

        ws.Cells(outputRow, 8).Value = Format(d, "mmm-yy")

        For t = 2 To TENOR_COUNT
            ws.Cells(outputRow, 7 + t).Value = _
                (BalanceOnDate(t, CDbl(d)) - BalanceOnDate(1, CDbl(d))) / 1000#
        Next t

        outputRow = outputRow + 1
        d = DateSerial(Year(d), Month(d) + 2, 0)
    Loop

    finalMonthLabel = Format(CDate(gEndDate), "mmm-yy")

    If outputRow = 2 Or ws.Cells(outputRow - 1, 8).Value <> finalMonthLabel Then
        ws.Cells(outputRow, 8).Value = finalMonthLabel

        For t = 2 To TENOR_COUNT
            ws.Cells(outputRow, 7 + t).Value = _
                (BalanceOnDate(t, gEndDate) - BalanceOnDate(1, gEndDate)) / 1000#
        Next t
    End If

    ' Current term premium versus its historical average.
    Set premiumWs = ThisWorkbook.Worksheets("Premium_Analysis")
    premiumWs.Calculate

    For t = 2 To TENOR_COUNT
        ws.Cells(t, 14).Value = TenorName(t)
        ws.Cells(t, 15).Value = premiumWs.Cells(t + 2, 13).Value
        ws.Cells(t, 16).Value = premiumWs.Cells(t + 2, 18).Value
    Next t

    ' Final incremental interest versus ON.
    For t = 2 To TENOR_COUNT
        ws.Cells(t, 18).Value = TenorName(t)
        ws.Cells(t, 19).Value = (gTotalInterest(t) - gTotalInterest(1)) / 1000#
    Next t

    ' Return and volatility expressed in basis points.
    onReturn = gTenorAnnualReturn(1)

    For t = 1 To TENOR_COUNT
        volBps = gTenorAnnualVol(t) * 10000#
        returnDiffBps = (gTenorAnnualReturn(t) - onReturn) * 10000#

        ws.Cells(t + 1, 21).Value = TenorName(t)
        ws.Cells(t + 1, 22).Value = volBps
        ws.Cells(t + 1, 23).Value = returnDiffBps

        ws.Cells(t + 1, 32).Value = TenorName(t)
        ws.Cells(t + 1, 33).Value = gTotalInterest(t) / 1000000#
        ws.Cells(t + 1, 34).Value = gAnnualizedReturn(t)
        ws.Cells(t + 1, 35).Value = volBps
        ws.Cells(t + 1, 36).Value = returnDiffBps
    Next t

    ' Efficient frontier converted to basis points and measured versus ON.
    Set portfolioWs = ThisWorkbook.Worksheets("Portfolio_Analysis")
    frontierLastRow = portfolioWs.Cells(portfolioWs.Rows.Count, 15).End(xlUp).Row

    outputRow = 2

    For r = 12 To frontierLastRow
        If IsNumeric(portfolioWs.Cells(r, 15).Value) And _
           IsNumeric(portfolioWs.Cells(r, 16).Value) Then

            ws.Cells(outputRow, 25).Value = portfolioWs.Cells(r, 15).Value * 10000#
            ws.Cells(outputRow, 26).Value = _
                (portfolioWs.Cells(r, 16).Value - onReturn) * 10000#
            outputRow = outputRow + 1
        End If
    Next r

    If outputRow <= 2 Then
        Err.Raise vbObjectError + 250, , "No efficient-frontier data was generated."
    End If

    minimumVol = ws.Cells(2, 25).Value
    minimumVolRow = 2
    maximumReturn = ws.Cells(2, 26).Value
    maximumReturnRow = 2

    For r = 3 To outputRow - 1
        If ws.Cells(r, 25).Value < minimumVol Then
            minimumVol = ws.Cells(r, 25).Value
            minimumVolRow = r
        End If

        If ws.Cells(r, 26).Value > maximumReturn Then
            maximumReturn = ws.Cells(r, 26).Value
            maximumReturnRow = r
        End If
    Next r

    WriteRow ws.Range("AB2"), Array("Minimum volatility", _
                                     ws.Cells(minimumVolRow, 25).Value, _
                                     ws.Cells(minimumVolRow, 26).Value)

    WriteRow ws.Range("AB3"), Array("ON", _
                                     gTenorAnnualVol(1) * 10000#, 0#)

    WriteRow ws.Range("AB4"), Array("Highest return", _
                                     ws.Cells(maximumReturnRow, 25).Value, _
                                     ws.Cells(maximumReturnRow, 26).Value)

    ws.Range("A:AJ").Columns.AutoFit

End Sub



Private Sub BuildDashboard()

    Dim ws As Worksheet
    Dim premiumWs As Worksheet
    Dim t As Long
    Dim bestTenorIndex As Long
    Dim current6MPremium As Double
    Dim bestIncrementK As Double
    Dim interpretationText As String

    Set ws = GetOrCreateSheet("Dashboard")

    ws.Cells.UnMerge
    ws.Cells.Clear

    Do While ws.ChartObjects.Count > 0
        ws.ChartObjects(1).Delete
    Loop

    ws.Range("A1:Q1").Merge
    ws.Range("A1").Value = "Historical Cash Investment Analysis | CFO Decision View"
    ApplyTitleStyle ws.Range("A1:Q1")
    ws.Range("A1:Q1").Font.Size = 18
    ws.Rows(1).RowHeight = 30

    ws.Range("A2:Q2").Merge
    ws.Range("A2").Value = _
        "Historical time-deposit outcomes using ACT/360, prior-available-date rolls and full interest reinvestment"
    With ws.Range("A2:Q2")
        .Interior.Color = RGB(18, 59, 93)
        .Font.Color = vbWhite
        .Font.Italic = True
        .Font.Size = 10
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlCenter
    End With
    ws.Rows(2).RowHeight = 20
    ws.Rows(3).RowHeight = 7

    bestTenorIndex = 1
    For t = 2 To TENOR_COUNT
        If gEndingValue(t) > gEndingValue(bestTenorIndex) Then bestTenorIndex = t
    Next t

    Set premiumWs = ThisWorkbook.Worksheets("Premium_Analysis")
    premiumWs.Calculate
    current6MPremium = premiumWs.Cells(7, 18).Value
    bestIncrementK = (gTotalInterest(bestTenorIndex) - gTotalInterest(1)) / 1000#

    WriteDashboardCard ws, "A5:D5", "A6:D7", _
        "Analysis period", _
        Format(CDate(gStartDate), "dd-mmm-yyyy") & " to " & Format(CDate(gEndDate), "dd-mmm-yyyy")

    WriteDashboardCard ws, "E5:H5", "E6:H7", _
        "Initial cash", _
        Format(gNotional / 1000000#, "$#,##0.0") & "MM"

    WriteDashboardCard ws, "J5:M5", "J6:M7", _
        "Highest realized ending value", _
        TenorName(bestTenorIndex) & "  |  " & _
        Format(gEndingValue(bestTenorIndex) / 1000000#, "$#,##0.000") & "MM"

    WriteDashboardCard ws, "N5:Q5", "N6:Q7", _
        "Current 6M premium vs ON", _
        Format(current6MPremium, "+0.0;-0.0;0.0") & " bps"

    WriteSectionTitle ws, "A9:Q9", "1  Curve and premium"
    WriteSectionTitle ws, "A26:Q26", "2  Realized dollar outcome"
    WriteSectionTitle ws, "A43:Q43", "3  Return stability and diversification"

    WriteRow ws.Range("A60"), Array("Tenor", "Total Interest ($MM)", _
                                     "Annualized Return", "Volatility (bps)", _
                                     "Return vs ON (bps)", "Transactions")
    ApplyHeaderStyle ws.Range("A60:F60")

    For t = 1 To TENOR_COUNT
        ws.Cells(t + 60, 1).Value = TenorName(t)
        ws.Cells(t + 60, 2).Value = gTotalInterest(t) / 1000000#
        ws.Cells(t + 60, 3).Value = gAnnualizedReturn(t)
        ws.Cells(t + 60, 4).Value = gTenorAnnualVol(t) * 10000#
        ws.Cells(t + 60, 5).Value = _
            (gTenorAnnualReturn(t) - gTenorAnnualReturn(1)) * 10000#
        ws.Cells(t + 60, 6).Value = gCompletedTransactions(t)
    Next t

    ws.Range("B61:B65").NumberFormat = "$0.000;[Red]($0.000);-"
    ws.Range("C61:C65").NumberFormat = "0.000%"
    ws.Range("D61:E65").NumberFormat = "0.00;[Red](0.00);-"
    ws.Range("F61:F65").NumberFormat = "0"
    ws.Range("A61:F65").Borders(xlEdgeBottom).Color = RGB(216, 225, 232)

    ws.Range("H60:Q60").Merge
    ws.Range("H60").Value = "CFO interpretation"
    ApplyHeaderStyle ws.Range("H60:Q60")
    ws.Range("H60:Q60").HorizontalAlignment = xlLeft

    interpretationText = _
        "• Current term premiums may differ materially from their historical average." & vbLf & _
        "• " & TenorName(bestTenorIndex) & _
        " produced the highest ending value, " & _
        Format(bestIncrementK, "$#,##0.0") & _
        "k versus ON over the full period." & vbLf & _
        "• Return differences should be evaluated after liquidity requirements and counterparty limits." & vbLf & _
        "• The efficient frontier shows the historical trade-off between earnings stability and return."

    ws.Range("H61:Q65").Merge
    ws.Range("H61").Value = interpretationText

    With ws.Range("H61:Q65")
        .Interior.Color = RGB(244, 247, 250)
        .Font.Color = RGB(36, 55, 70)
        .Font.Size = 10
        .WrapText = True
        .VerticalAlignment = xlTop
        .HorizontalAlignment = xlLeft
        .Borders.Color = RGB(216, 225, 232)
    End With

    ws.Range("A67:Q68").Merge
    ws.Range("A67").Value = _
        "Historical analysis only. Results are not a forecast and exclude credit limits, early-withdrawal economics, execution costs and accounting treatment."

    With ws.Range("A67:Q68")
        .Interior.Color = RGB(234, 241, 246)
        .Font.Color = RGB(140, 152, 164)
        .Font.Italic = True
        .Font.Size = 9
        .WrapText = True
        .VerticalAlignment = xlCenter
        .HorizontalAlignment = xlLeft
    End With

    ws.Columns("A:Q").ColumnWidth = 11
    ws.Columns("A").ColumnWidth = 15
    ws.Columns("I").ColumnWidth = 3
    ws.Columns("Q").ColumnWidth = 15

    ws.Rows("5:5").RowHeight = 18
    ws.Rows("6:6").RowHeight = 20
    ws.Rows("7:7").RowHeight = 18

    CreateDashboardCharts ws

End Sub



Private Sub CreateDashboardCharts(ByVal dashboardWs As Worksheet)

    Dim dataWs As Worksheet
    Dim co As ChartObject
    Dim ch As Chart
    Dim seriesItem As Series
    Dim lastRatesRow As Long
    Dim lastExcessRow As Long
    Dim lastFrontierRow As Long
    Dim t As Long, r As Long
    Dim xMinimum As Double, xMaximum As Double
    Dim yMinimum As Double, yMaximum As Double
    Dim pointColor As Long

    Set dataWs = ThisWorkbook.Worksheets("Chart_Data")

    Do While dashboardWs.ChartObjects.Count > 0
        dashboardWs.ChartObjects(1).Delete
    Loop

    lastRatesRow = dataWs.Cells(dataWs.Rows.Count, 1).End(xlUp).Row
    lastExcessRow = dataWs.Cells(dataWs.Rows.Count, 8).End(xlUp).Row
    lastFrontierRow = dataWs.Cells(dataWs.Rows.Count, 25).End(xlUp).Row

    ' 1. Historical deposit rates.
    Set co = AddChartAtRange(dashboardWs, "A10:I24")
    Set ch = co.Chart

    With ch
        .ChartType = xlLine
        .HasTitle = True
        .ChartTitle.Text = "Historical deposit rates"
        .HasLegend = True
        .Legend.Position = xlLegendPositionBottom

        For t = 1 To TENOR_COUNT
            Set seriesItem = .SeriesCollection.NewSeries
            seriesItem.Name = TenorName(t)
            seriesItem.XValues = dataWs.Range(dataWs.Cells(2, 1), dataWs.Cells(lastRatesRow, 1))
            seriesItem.Values = dataWs.Range(dataWs.Cells(2, t + 1), dataWs.Cells(lastRatesRow, t + 1))
            seriesItem.MarkerStyle = xlMarkerStyleNone
            seriesItem.Format.Line.ForeColor.RGB = TenorColor(t)
            seriesItem.Format.Line.Weight = IIf(t = 1 Or t = 5, 2.25, 1.5)
        Next t

        .Axes(xlCategory).TickLabelSpacing = 6
        .Axes(xlValue).TickLabels.NumberFormat = "0.0""%"""
        .Axes(xlValue).HasTitle = True
        .Axes(xlValue).AxisTitle.Text = "Rate (%)"
    End With
    FormatChartBase ch

    ' 2. Current premium versus historical average.
    Set co = AddChartAtRange(dashboardWs, "J10:Q24")
    Set ch = co.Chart

    With ch
        .ChartType = xlColumnClustered
        .HasTitle = True
        .ChartTitle.Text = "Term premium: current vs historical average"
        .HasLegend = True
        .Legend.Position = xlLegendPositionBottom

        Set seriesItem = .SeriesCollection.NewSeries
        seriesItem.Name = "Historical average"
        seriesItem.XValues = dataWs.Range("N2:N5")
        seriesItem.Values = dataWs.Range("O2:O5")
        seriesItem.Format.Fill.ForeColor.RGB = RGB(140, 152, 164)
        seriesItem.ApplyDataLabels
        seriesItem.DataLabels.NumberFormat = "0.0"" bps"""

        Set seriesItem = .SeriesCollection.NewSeries
        seriesItem.Name = "Current"
        seriesItem.XValues = dataWs.Range("N2:N5")
        seriesItem.Values = dataWs.Range("P2:P5")
        seriesItem.Format.Fill.ForeColor.RGB = RGB(47, 117, 181)
        seriesItem.ApplyDataLabels
        seriesItem.DataLabels.NumberFormat = "0.0"" bps"""

        .ChartGroups(1).GapWidth = 70
        .Axes(xlValue).TickLabels.NumberFormat = "0.0"" bps"""
    End With
    FormatChartBase ch

    ' 3. Cumulative incremental interest versus ON.
    Set co = AddChartAtRange(dashboardWs, "A27:I41")
    Set ch = co.Chart

    With ch
        .ChartType = xlLine
        .HasTitle = True
        .ChartTitle.Text = "Cumulative interest versus ON"
        .HasLegend = True
        .Legend.Position = xlLegendPositionBottom

        For t = 2 To TENOR_COUNT
            Set seriesItem = .SeriesCollection.NewSeries
            seriesItem.Name = TenorName(t)
            seriesItem.XValues = dataWs.Range(dataWs.Cells(2, 8), dataWs.Cells(lastExcessRow, 8))
            seriesItem.Values = dataWs.Range(dataWs.Cells(2, t + 7), dataWs.Cells(lastExcessRow, t + 7))
            seriesItem.MarkerStyle = xlMarkerStyleNone
            seriesItem.Format.Line.ForeColor.RGB = TenorColor(t)
            seriesItem.Format.Line.Weight = 2#
        Next t

        .Axes(xlCategory).TickLabelSpacing = 6
        .Axes(xlValue).TickLabels.NumberFormat = "$0""k"";[Red]($0""k"");-"
        .Axes(xlValue).HasTitle = True
        .Axes(xlValue).AxisTitle.Text = "Cumulative excess interest ($000)"
    End With
    FormatChartBase ch

    ' 4. Final incremental interest versus ON.
    Set co = AddChartAtRange(dashboardWs, "J27:Q41")
    Set ch = co.Chart

    With ch
        .ChartType = xlBarClustered
        .HasTitle = True
        .ChartTitle.Text = "Final incremental interest versus ON"
        .HasLegend = False

        Set seriesItem = .SeriesCollection.NewSeries
        seriesItem.Name = "Incremental interest"
        seriesItem.XValues = dataWs.Range("R2:R5")
        seriesItem.Values = dataWs.Range("S2:S5")
        seriesItem.ApplyDataLabels
        seriesItem.DataLabels.NumberFormat = "$0.0""k"";[Red]($0.0""k"");-"

        For r = 1 To 4
            If dataWs.Cells(r + 1, 19).Value >= 0 Then
                pointColor = RGB(58, 141, 93)
            Else
                pointColor = RGB(196, 78, 82)
            End If
            seriesItem.Points(r).Format.Fill.ForeColor.RGB = pointColor
        Next r

        .ChartGroups(1).GapWidth = 50
        .Axes(xlCategory).ReversePlotOrder = True
        .Axes(xlValue).TickLabels.NumberFormat = "$0""k"";[Red]($0""k"");-"
    End With
    FormatChartBase ch

    ' 5. Return versus volatility.
    Set co = AddChartAtRange(dashboardWs, "A44:I58")
    Set ch = co.Chart

    With ch
        .ChartType = xlXYScatter
        .HasTitle = True
        .ChartTitle.Text = "Return versus volatility | basis-point view"
        .HasLegend = False

        For t = 1 To TENOR_COUNT
            Set seriesItem = .SeriesCollection.NewSeries
            seriesItem.Name = TenorName(t)
            seriesItem.XValues = dataWs.Cells(t + 1, 22)
            seriesItem.Values = dataWs.Cells(t + 1, 23)
            seriesItem.MarkerStyle = xlMarkerStyleCircle
            seriesItem.MarkerSize = 8
            seriesItem.MarkerForegroundColor = TenorColor(t)
            seriesItem.MarkerBackgroundColor = TenorColor(t)
            seriesItem.Points(1).ApplyDataLabels
            seriesItem.Points(1).DataLabel.Text = TenorName(t)
            seriesItem.Points(1).DataLabel.Position = xlLabelPositionRight
        Next t

        .Axes(xlCategory).HasTitle = True
        .Axes(xlCategory).AxisTitle.Text = "Annualized monthly-return volatility (bps)"
        .Axes(xlCategory).TickLabels.NumberFormat = "0.00"" bps"""

        .Axes(xlValue).HasTitle = True
        .Axes(xlValue).AxisTitle.Text = "Annualized return vs ON (bps)"
        .Axes(xlValue).TickLabels.NumberFormat = "0.00"" bps"""
    End With

    xMinimum = Application.WorksheetFunction.Min(dataWs.Range("V2:V6"))
    xMaximum = Application.WorksheetFunction.Max(dataWs.Range("V2:V6"))
    yMinimum = Application.WorksheetFunction.Min(dataWs.Range("W2:W6"))
    yMaximum = Application.WorksheetFunction.Max(dataWs.Range("W2:W6"))

    SetAxisBounds ch.Axes(xlCategory), xMinimum, xMaximum, 0.18
    SetAxisBounds ch.Axes(xlValue), yMinimum, yMaximum, 0.22
    FormatChartBase ch

    ' 6. Efficient frontier.
    Set co = AddChartAtRange(dashboardWs, "J44:Q58")
    Set ch = co.Chart

    With ch
        .ChartType = xlXYScatterLinesNoMarkers
        .HasTitle = True
        .ChartTitle.Text = "Historical efficient frontier | narrow trade-off"
        .HasLegend = False

        Set seriesItem = .SeriesCollection.NewSeries
        seriesItem.Name = "Frontier"
        seriesItem.XValues = dataWs.Range("Y2:Y" & lastFrontierRow)
        seriesItem.Values = dataWs.Range("Z2:Z" & lastFrontierRow)
        seriesItem.Format.Line.ForeColor.RGB = RGB(18, 59, 93)
        seriesItem.Format.Line.Weight = 2.5

        For r = 2 To 4
            Set seriesItem = .SeriesCollection.NewSeries
            seriesItem.Name = dataWs.Cells(r, 28).Value
            seriesItem.XValues = dataWs.Cells(r, 29)
            seriesItem.Values = dataWs.Cells(r, 30)
            seriesItem.MarkerStyle = xlMarkerStyleCircle
            seriesItem.MarkerSize = 8

            Select Case r
                Case 2: pointColor = RGB(126, 87, 194)
                Case 3: pointColor = RGB(140, 152, 164)
                Case 4: pointColor = RGB(58, 141, 93)
            End Select

            seriesItem.MarkerForegroundColor = pointColor
            seriesItem.MarkerBackgroundColor = pointColor
            seriesItem.Points(1).ApplyDataLabels
            seriesItem.Points(1).DataLabel.Text = CStr(dataWs.Cells(r, 28).Value)
            seriesItem.Points(1).DataLabel.Position = xlLabelPositionRight
        Next r

        .Axes(xlCategory).HasTitle = True
        .Axes(xlCategory).AxisTitle.Text = "Annualized volatility (bps)"
        .Axes(xlCategory).TickLabels.NumberFormat = "0.00"" bps"""

        .Axes(xlValue).HasTitle = True
        .Axes(xlValue).AxisTitle.Text = "Annualized return vs ON (bps)"
        .Axes(xlValue).TickLabels.NumberFormat = "0.00"" bps"""
    End With

    xMinimum = Application.WorksheetFunction.Min(dataWs.Range("Y2:Y" & lastFrontierRow))
    xMaximum = Application.WorksheetFunction.Max(dataWs.Range("Y2:Y" & lastFrontierRow))
    yMinimum = Application.WorksheetFunction.Min(dataWs.Range("Z2:Z" & lastFrontierRow))
    yMaximum = Application.WorksheetFunction.Max(dataWs.Range("Z2:Z" & lastFrontierRow))

    SetAxisBounds ch.Axes(xlCategory), xMinimum, xMaximum, 0.12
    SetAxisBounds ch.Axes(xlValue), yMinimum, yMaximum, 0.15
    FormatChartBase ch

End Sub


Private Sub BuildMethodology()

    Dim ws As Worksheet
    Set ws = PrepareOutputSheet("Methodology", "Methodology, Definitions and Limitations", "H")

    WriteSectionTitle ws, "A3:H3", "1. Daily accrual engine"
    WriteMergedText ws, 4, "All investments use ACT/360 simple interest. Rates are entered and displayed as percentage points: 1.54 means 1.54%."
    WriteMergedText ws, 5, "Interest accrues for every calendar day from transaction start through the day before maturity. The maturity date begins the next transaction."
    WriteMergedText ws, 6, "Interest is always reinvested. The daily economic balance equals opening principal plus cumulative accrued interest."
    WriteMergedText ws, 7, "The daily ledger is the source for all subsequent modules."

    WriteSectionTitle ws, "A9:H9", "2. Roll-date mechanics"
    WriteMergedText ws, 10, "Monthly target dates remain anchored to the original requested start-date day. Month-end starts remain month-end."
    WriteMergedText ws, 11, "When a target date is unavailable, the latest prior curve date is used. No future rate observation is used."
    WriteMergedText ws, 12, "For ON, each transaction runs to the next available curve date, so Friday rates accrue through weekends and holidays."
    WriteMergedText ws, 13, "Target dates, actual dates and adjustment flags are retained."

    WriteSectionTitle ws, "A15:H15", "3. Return and volatility"
    WriteMergedText ws, 16, "Ending values include accrued interest through the analysis end date. Open transactions are not assumed to be terminated."
    WriteMergedText ws, 17, "Monthly returns use month-end economic balances. Partial first and last months are excluded from volatility."
    WriteMergedText ws, 18, "Annualized volatility is the sample standard deviation of monthly returns multiplied by the square root of 12."
    WriteMergedText ws, 19, "Historical outcomes are not forecasts and exclude credit, concentration, operational and early-withdrawal costs."

    WriteSectionTitle ws, "A22:H22", "4. Efficient frontier"
    WriteMergedText ws, 23, "Portfolio weights are long-only, non-leveraged and sum to 100%. The allocation increment is controlled in Inputs."
    WriteMergedText ws, 24, "Portfolio monthly return is the weighted sum of tenor monthly returns."
    WriteMergedText ws, 25, "Liquidity is measured contractually by maturity bucket, not by assumed secondary-market liquidation."
    WriteMergedText ws, 26, "The model reports historical allocations rather than a universally optimal tenor mix."

    WriteSectionTitle ws, "A28:H28", "5. Swap overlay"
    WriteMergedText ws, 29, "The client pays fixed and receives daily compounded SOFR while retaining the fixed deposit return."
    WriteMergedText ws, 30, "Net economics are deposit accrual plus floating receipt minus fixed swap payment."
    WriteMergedText ws, 31, "Historical SOFR and fixed swap rates are mandatory. The ON deposit rate is not used as a SOFR proxy."
    WriteMergedText ws, 32, "Credit valuation, collateral, discounting, payment lags, execution spreads and accounting treatment require separate review."

    WriteSectionTitle ws, "A35:H35", "6. Interpretation"
    WriteMergedText ws, 36, "The analysis is designed for a corporate CFO and treasury audience. Dollar earnings, liquidity and rate-reset exposure should be considered together."
    WriteMergedText ws, 37, "A higher historical return does not by itself establish suitability. Liquidity needs and counterparty limits must be applied first."

    ws.Columns("A:H").ColumnWidth = 14

End Sub

' ============================================================================
' Calculations and helper functions
' ============================================================================

Private Function LatestCurveIndexLE(ByVal targetDate As Double) As Long

    Dim low As Long, high As Long, mid As Long, answer As Long

    low = 1
    high = gCurveRows
    answer = 0

    Do While low <= high
        mid = (low + high) \ 2

        If gCurveDates(mid) <= targetDate Then
            answer = mid
            low = mid + 1
        Else
            high = mid - 1
        End If
    Loop

    If answer = 0 Then Err.Raise vbObjectError + 200, , "No curve date exists on or before " & Format(CDate(targetDate), "mm/dd/yyyy") & "."
    LatestCurveIndexLE = answer

End Function

Private Function NextCurveIndexAfter(ByVal currentDate As Double) As Long

    Dim indexValue As Long
    indexValue = LatestCurveIndexLE(currentDate)

    If indexValue < gCurveRows Then
        NextCurveIndexAfter = indexValue + 1
    Else
        NextCurveIndexAfter = 0
    End If

End Function

Private Function LatestValidRateIndexLE(ByVal targetDate As Double, ByVal tenorIndex As Long) As Long

    Dim indexValue As Long
    indexValue = LatestCurveIndexLE(targetDate)

    Do While indexValue >= 1
        If gRateValid(indexValue, tenorIndex) Then
            LatestValidRateIndexLE = indexValue
            Exit Function
        End If
        indexValue = indexValue - 1
    Loop

    Err.Raise vbObjectError + 201, , "No valid " & TenorName(tenorIndex) & " rate exists on or before " & Format(CDate(targetDate), "mm/dd/yyyy") & "."

End Function

Private Function AddMonthsAnchored(ByVal anchorDate As Date, ByVal monthsToAdd As Long) As Date

    Dim targetYear As Long, targetMonth As Long
    Dim lastTargetDay As Long, targetDay As Long
    Dim anchorIsMonthEnd As Boolean

    targetYear = Year(DateAdd("m", monthsToAdd, DateSerial(Year(anchorDate), Month(anchorDate), 1)))
    targetMonth = Month(DateAdd("m", monthsToAdd, DateSerial(Year(anchorDate), Month(anchorDate), 1)))
    lastTargetDay = Day(DateSerial(targetYear, targetMonth + 1, 0))
    anchorIsMonthEnd = (Day(anchorDate) = Day(DateSerial(Year(anchorDate), Month(anchorDate) + 1, 0)))

    If anchorIsMonthEnd Then
        targetDay = lastTargetDay
    ElseIf Day(anchorDate) > lastTargetDay Then
        targetDay = lastTargetDay
    Else
        targetDay = Day(anchorDate)
    End If

    AddMonthsAnchored = DateSerial(targetYear, targetMonth, targetDay)

End Function

Private Function AddFlag(ByVal existingFlag As String, ByVal newFlag As String) As String

    If Len(existingFlag) = 0 Then
        AddFlag = newFlag
    Else
        AddFlag = existingFlag & "; " & newFlag
    End If

End Function

Private Function TenorName(ByVal tenorIndex As Long) As String

    Select Case tenorIndex
        Case 1: TenorName = "ON"
        Case 2: TenorName = "1M"
        Case 3: TenorName = "2M"
        Case 4: TenorName = "3M"
        Case 5: TenorName = "6M"
        Case Else: TenorName = ""
    End Select

End Function

Private Function TenorMaturityMonths(ByVal tenorIndex As Long) As Double

    Select Case tenorIndex
        Case 1: TenorMaturityMonths = 0#
        Case 2: TenorMaturityMonths = 1#
        Case 3: TenorMaturityMonths = 2#
        Case 4: TenorMaturityMonths = 3#
        Case 5: TenorMaturityMonths = 6#
    End Select

End Function

Private Function CountMissingRates(ByVal tenorIndex As Long) As Long

    Dim i As Long, countValue As Long

    For i = 1 To gCurveRows
        If Not gRateValid(i, tenorIndex) Then countValue = countValue + 1
    Next i

    CountMissingRates = countValue

End Function

Private Function SumDailyInterestBetween(ByVal tenorIndex As Long, ByVal startDate As Double, ByVal endDate As Double) As Double

    Dim firstOffset As Long, lastOffset As Long, i As Long
    Dim totalValue As Double

    If startDate < gStartDate Then startDate = gStartDate
    If endDate > gEndDate Then endDate = gEndDate

    firstOffset = CLng(startDate - gStartDate)
    lastOffset = CLng(endDate - gStartDate)

    For i = firstOffset To lastOffset
        If i >= 0 And i < gNumDays Then totalValue = totalValue + gDailyInterest(tenorIndex, i)
    Next i

    SumDailyInterestBetween = totalValue

End Function

Private Function BalanceOnDate(ByVal tenorIndex As Long, ByVal targetDate As Double) As Double

    Dim offsetValue As Long
    offsetValue = CLng(targetDate - gStartDate)

    If offsetValue < 0 Or offsetValue >= gNumDays Then
        Err.Raise vbObjectError + 210, , "Requested balance date is outside the analysis period."
    End If

    BalanceOnDate = gBalance(tenorIndex, offsetValue)

End Function

Private Function GeometricAnnualReturnForTenor(ByVal tenorIndex As Long) As Double

    Dim i As Long
    Dim growthFactor As Double

    growthFactor = 1#

    For i = 1 To gMonthlyCount
        growthFactor = growthFactor * (1# + gMonthlyReturns(i, tenorIndex))
    Next i

    GeometricAnnualReturnForTenor = growthFactor ^ (12# / gMonthlyCount) - 1#

End Function

Private Function SampleStDevForTenor(ByVal tenorIndex As Long) As Double

    Dim values() As Double
    Dim i As Long

    ReDim values(1 To gMonthlyCount)
    For i = 1 To gMonthlyCount
        values(i) = gMonthlyReturns(i, tenorIndex)
    Next i

    SampleStDevForTenor = SampleStDevArray(values, gMonthlyCount)

End Function

Private Function SampleStDevArray(ByRef values() As Double, ByVal countValue As Long) As Double

    Dim i As Long
    Dim averageValue As Double
    Dim varianceSum As Double

    If countValue <= 1 Then
        SampleStDevArray = 0#
        Exit Function
    End If

    For i = 1 To countValue
        averageValue = averageValue + values(i)
    Next i
    averageValue = averageValue / countValue

    For i = 1 To countValue
        varianceSum = varianceSum + (values(i) - averageValue) ^ 2
    Next i

    SampleStDevArray = Sqr(varianceSum / (countValue - 1))

End Function

Private Sub CalculatePortfolioStats(ByRef weights() As Double, ByRef annualReturn As Double, ByRef annualVol As Double)

    Dim portfolioReturns() As Double
    Dim i As Long, t As Long
    Dim growthFactor As Double

    ReDim portfolioReturns(1 To gMonthlyCount)
    growthFactor = 1#

    For i = 1 To gMonthlyCount
        For t = 1 To TENOR_COUNT
            portfolioReturns(i) = portfolioReturns(i) + weights(t) * gMonthlyReturns(i, t)
        Next t
        growthFactor = growthFactor * (1# + portfolioReturns(i))
    Next i

    annualReturn = growthFactor ^ (12# / gMonthlyCount) - 1#
    annualVol = SampleStDevArray(portfolioReturns, gMonthlyCount) * Sqr(12#)

End Sub

Private Function FindWeightRow(ByVal ws As Worksheet, ByVal lastRow As Long, _
                               ByVal w0 As Double, ByVal w1 As Double, ByVal w2 As Double, _
                               ByVal w3 As Double, ByVal w4 As Double) As Long

    Dim r As Long

    For r = 4 To lastRow
        If Abs(ws.Cells(r, 1).Value - w0) < 0.0000001 And _
           Abs(ws.Cells(r, 2).Value - w1) < 0.0000001 And _
           Abs(ws.Cells(r, 3).Value - w2) < 0.0000001 And _
           Abs(ws.Cells(r, 4).Value - w3) < 0.0000001 And _
           Abs(ws.Cells(r, 5).Value - w4) < 0.0000001 Then
            FindWeightRow = r
            Exit Function
        End If
    Next r

    Err.Raise vbObjectError + 220, , "Required portfolio allocation was not found."

End Function

Private Sub CopyPortfolioExample(ByVal ws As Worksheet, ByVal targetRow As Long, _
                                 ByVal portfolioName As String, ByVal sourceRow As Long)

    ws.Cells(targetRow, 15).Value = portfolioName
    ws.Cells(targetRow, 16).Resize(1, 5).Value = ws.Cells(sourceRow, 1).Resize(1, 5).Value
    ws.Cells(targetRow, 21).Value = ws.Cells(sourceRow, 6).Value
    ws.Cells(targetRow, 22).Value = ws.Cells(sourceRow, 7).Value
    ws.Cells(targetRow, 23).Value = ws.Cells(sourceRow, 9).Value

End Sub

Private Sub WriteEqualWeightExample(ByVal ws As Worksheet, ByVal targetRow As Long)

    Dim weights(1 To TENOR_COUNT) As Double
    Dim annualReturn As Double, annualVol As Double
    Dim t As Long

    For t = 1 To TENOR_COUNT
        weights(t) = 0.2
    Next t

    CalculatePortfolioStats weights, annualReturn, annualVol

    ws.Cells(targetRow, 15).Value = "Equal Weight"
    For t = 1 To TENOR_COUNT
        ws.Cells(targetRow, 15 + t).Value = weights(t)
    Next t
    ws.Cells(targetRow, 21).Value = annualReturn
    ws.Cells(targetRow, 22).Value = annualVol
    ws.Cells(targetRow, 23).Value = 2.4

End Sub

Private Function LookupExternalRate(ByVal targetDate As Double, ByRef dates() As Double, _
                                    ByRef rates() As Double, ByRef validRates() As Boolean, _
                                    ByVal n As Long) As Double

    Dim i As Long

    For i = n To 1 Step -1
        If dates(i) <= targetDate And validRates(i) Then
            LookupExternalRate = rates(i)
            Exit Function
        End If
    Next i

    LookupExternalRate = -1E+99

End Function

' ============================================================================
' Worksheet and formatting utilities
' ============================================================================

Private Function GetOrCreateSheet(ByVal sheetName As String) As Worksheet

    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0

    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        GetOrCreateSheet.Name = sheetName
    End If

End Function

Private Function PrepareOutputSheet(ByVal sheetName As String, ByVal titleText As String, _
                                    ByVal lastColumn As String) As Worksheet

    Dim ws As Worksheet
    Set ws = GetOrCreateSheet(sheetName)

    ws.Cells.UnMerge
    ws.Cells.Clear
    Do While ws.ChartObjects.Count > 0
        ws.ChartObjects(1).Delete
    Loop

    ws.Range("A1:" & lastColumn & "1").Merge
    ws.Range("A1").Value = titleText
    ApplyTitleStyle ws.Range("A1:" & lastColumn & "1")
    ws.Rows(1).RowHeight = 30

    On Error Resume Next
    ws.Activate
    ActiveWindow.FreezePanes = False
    ws.Range("A4").Select
    ActiveWindow.FreezePanes = True
    On Error GoTo 0

    Set PrepareOutputSheet = ws

End Function

Private Sub WriteTrimmedArray(ByVal startCell As Range, ByRef sourceArray As Variant, _
                              ByVal rowCount As Long, ByVal columnCount As Long)

    Dim outputArray() As Variant
    Dim r As Long, c As Long

    ReDim outputArray(1 To rowCount, 1 To columnCount)

    For r = 1 To rowCount
        For c = 1 To columnCount
            outputArray(r, c) = sourceArray(r, c)
        Next c
    Next r

    startCell.Resize(rowCount, columnCount).Value = outputArray

End Sub


Private Sub WriteRow(ByVal startCell As Range, ByVal valuesArray As Variant)

    Dim outputArray() As Variant
    Dim i As Long
    Dim itemCount As Long

    itemCount = UBound(valuesArray) - LBound(valuesArray) + 1
    ReDim outputArray(1 To 1, 1 To itemCount)

    For i = LBound(valuesArray) To UBound(valuesArray)
        outputArray(1, i - LBound(valuesArray) + 1) = valuesArray(i)
    Next i

    startCell.Resize(1, itemCount).Value = outputArray

End Sub

Private Function TenorColor(ByVal tenorIndex As Long) As Long

    Select Case tenorIndex
        Case 1: TenorColor = RGB(18, 59, 93)
        Case 2: TenorColor = RGB(47, 117, 181)
        Case 3: TenorColor = RGB(42, 157, 143)
        Case 4: TenorColor = RGB(217, 154, 43)
        Case 5: TenorColor = RGB(126, 87, 194)
        Case Else: TenorColor = RGB(140, 152, 164)
    End Select

End Function

Private Sub SetAxisBounds(ByVal targetAxis As Axis, ByVal minimumValue As Double, _
                          ByVal maximumValue As Double, ByVal paddingPercentage As Double)

    Dim spanValue As Double
    Dim paddingValue As Double

    spanValue = maximumValue - minimumValue

    If Abs(spanValue) < 0.0000001 Then
        spanValue = Application.WorksheetFunction.Max(Abs(maximumValue), 1#)
    End If

    paddingValue = spanValue * paddingPercentage

    targetAxis.MinimumScale = minimumValue - paddingValue
    targetAxis.MaximumScale = maximumValue + paddingValue

End Sub

Private Sub FormatChartBase(ByVal targetChart As Chart)

    On Error Resume Next

    targetChart.ChartArea.Format.Fill.ForeColor.RGB = RGB(255, 255, 255)
    targetChart.ChartArea.Format.Line.Visible = msoFalse
    targetChart.PlotArea.Format.Fill.ForeColor.RGB = RGB(255, 255, 255)
    targetChart.PlotArea.Format.Line.Visible = msoFalse

    targetChart.ChartTitle.Format.TextFrame2.TextRange.Font.Name = "Aptos"
    targetChart.ChartTitle.Format.TextFrame2.TextRange.Font.Size = 12
    targetChart.ChartTitle.Format.TextFrame2.TextRange.Font.Bold = msoTrue
    targetChart.ChartTitle.Format.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(36, 55, 70)

    If targetChart.HasLegend Then
        targetChart.Legend.Format.TextFrame2.TextRange.Font.Name = "Aptos"
        targetChart.Legend.Format.TextFrame2.TextRange.Font.Size = 9
    End If

    targetChart.Axes(xlCategory).TickLabels.Font.Name = "Aptos"
    targetChart.Axes(xlCategory).TickLabels.Font.Size = 9
    targetChart.Axes(xlValue).TickLabels.Font.Name = "Aptos"
    targetChart.Axes(xlValue).TickLabels.Font.Size = 9

    targetChart.Axes(xlValue).MajorGridlines.Format.Line.ForeColor.RGB = RGB(225, 231, 236)
    targetChart.Axes(xlValue).MajorGridlines.Format.Line.Weight = 0.75

    On Error GoTo 0

End Sub

Private Sub WriteDashboardCard(ByVal ws As Worksheet, ByVal labelAddress As String, _
                               ByVal valueAddress As String, ByVal labelText As String, _
                               ByVal valueText As String)

    ws.Range(labelAddress).Merge
    ws.Range(valueAddress).Merge

    ws.Range(labelAddress).Cells(1, 1).Value = labelText
    ws.Range(valueAddress).Cells(1, 1).Value = valueText

    With ws.Range(labelAddress)
        .Interior.Color = RGB(234, 241, 246)
        .Font.Bold = True
        .Font.Color = RGB(140, 152, 164)
        .Font.Size = 9
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlBottom
        .Borders(xlEdgeTop).Color = RGB(201, 215, 227)
        .Borders(xlEdgeLeft).Color = RGB(201, 215, 227)
        .Borders(xlEdgeRight).Color = RGB(201, 215, 227)
    End With

    With ws.Range(valueAddress)
        .Interior.Color = RGB(234, 241, 246)
        .Font.Bold = True
        .Font.Color = RGB(36, 55, 70)
        .Font.Size = 12
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlTop
        .Borders(xlEdgeBottom).Color = RGB(201, 215, 227)
        .Borders(xlEdgeLeft).Color = RGB(201, 215, 227)
        .Borders(xlEdgeRight).Color = RGB(201, 215, 227)
    End With

End Sub


Private Function FindHeaderRow(ByVal ws As Worksheet, ByVal headerText As String, _
                               ByVal maximumRows As Long) As Long

    Dim r As Long, c As Long
    Dim lastColumn As Long

    For r = 1 To maximumRows
        lastColumn = ws.Cells(r, ws.Columns.Count).End(xlToLeft).Column

        For c = 1 To lastColumn
            If UCase$(Trim$(CStr(ws.Cells(r, c).Value))) = UCase$(headerText) Then
                FindHeaderRow = r
                Exit Function
            End If
        Next c
    Next r

    FindHeaderRow = 0

End Function

Private Function FindHeaderColumn(ByVal ws As Worksheet, ByVal headerRow As Long, _
                                  ByVal headerText As String) As Long

    Dim c As Long, lastColumn As Long
    lastColumn = ws.Cells(headerRow, ws.Columns.Count).End(xlToLeft).Column

    For c = 1 To lastColumn
        If UCase$(Trim$(CStr(ws.Cells(headerRow, c).Value))) = UCase$(headerText) Then
            FindHeaderColumn = c
            Exit Function
        End If
    Next c

    FindHeaderColumn = 0

End Function

Private Sub ApplyTitleStyle(ByVal targetRange As Range)

    With targetRange
        .Interior.Color = RGB(11, 31, 58)
        .Font.Color = vbWhite
        .Font.Bold = True
        .Font.Size = 16
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlCenter
    End With

End Sub

Private Sub ApplyHeaderStyle(ByVal targetRange As Range)

    With targetRange
        .Interior.Color = RGB(31, 78, 121)
        .Font.Color = vbWhite
        .Font.Bold = True
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .WrapText = True
    End With

End Sub

Private Sub WriteSectionTitle(ByVal ws As Worksheet, ByVal addressText As String, _
                              ByVal titleText As String)

    ws.Range(addressText).Merge
    ws.Range(addressText).Cells(1, 1).Value = titleText

    With ws.Range(addressText)
        .Interior.Color = RGB(11, 31, 58)
        .Font.Color = vbWhite
        .Font.Bold = True
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlCenter
    End With

End Sub

Private Sub WriteDashboardKPI(ByVal ws As Worksheet, ByVal addressText As String, _
                              ByVal labelText As String, ByVal valueText As String)

    ws.Range(addressText).Merge
    ws.Range(addressText).Cells(1, 1).Value = labelText & ": " & valueText

    With ws.Range(addressText)
        .Interior.Color = RGB(11, 31, 58)
        .Font.Color = vbWhite
        .Font.Bold = True
        .Font.Size = 9
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With

End Sub

Private Sub FormatSummaryBox(ByVal targetRange As Range)

    With targetRange
        .Interior.Color = RGB(238, 245, 251)
        .Font.Color = RGB(11, 31, 58)
        .WrapText = True
        .VerticalAlignment = xlCenter
        .HorizontalAlignment = xlLeft
        .Borders.Color = RGB(47, 117, 181)
    End With

End Sub

Private Sub WriteMergedText(ByVal ws As Worksheet, ByVal rowNumber As Long, _
                            ByVal textValue As String)

    ws.Range("A" & rowNumber & ":H" & rowNumber).Merge
    ws.Range("A" & rowNumber).Value = textValue
    ws.Range("A" & rowNumber & ":H" & rowNumber).WrapText = True
    ws.Rows(rowNumber).RowHeight = 30

End Sub

Private Function AddChartAtRange(ByVal ws As Worksheet, ByVal rangeAddress As String) As ChartObject

    Dim targetRange As Range
    Set targetRange = ws.Range(rangeAddress)

    Set AddChartAtRange = ws.ChartObjects.Add( _
        Left:=targetRange.Left, _
        Top:=targetRange.Top, _
        Width:=targetRange.Width, _
        Height:=targetRange.Height)

End Function

Private Function DivideRangeByMillion(ByVal inputValues As Variant) As Variant

    Dim outputValues As Variant
    Dim r As Long, c As Long

    outputValues = inputValues

    If IsArray(outputValues) Then
        For r = LBound(outputValues, 1) To UBound(outputValues, 1)
            For c = LBound(outputValues, 2) To UBound(outputValues, 2)
                If IsNumeric(outputValues(r, c)) And Len(outputValues(r, c)) > 0 Then
                    outputValues(r, c) = outputValues(r, c) / 1000000#
                End If
            Next c
        Next r
    End If

    DivideRangeByMillion = outputValues

End Function


' ============================================================================
' VERSION 3 CURVE-BASED POST PROCESSING
' Rebuilds daily rolling reinvestment analysis, frontier descriptions,
' chart data and dashboard strictly from the current Curve sheet.
' ============================================================================

Private Sub PostProcessActualCurveV3()
    Application.StatusBar = "Building daily rolling reinvestment analysis..."
    BuildDailyRollingResetV3
    Application.StatusBar = "Describing efficient-frontier points..."
    DescribeFrontierV3
    Application.StatusBar = "Rebuilding chart data from current curve..."
    BuildChartDataV3
    Application.StatusBar = "Rebuilding corrected dashboard..."
    BuildDashboardV3
    Application.StatusBar = False
End Sub

Private Sub BuildDailyRollingResetV3()

    Dim ws As Worksheet
    Dim detail() As Variant, summary() As Variant
    Dim changes() As Double, impacts() As Double
    Dim starts() As Double, ends() As Double

    Dim r As Long, t As Long, outRow As Long, count As Long
    Dim startRateIndex As Long, maturityRateIndex As Long
    Dim maturityIndex As Long, tenorMonths As Long

    Dim scenarioStart As Double
    Dim targetDate As Double, actualDate As Double
    Dim startRate As Double, maturityRate As Double
    Dim changeBps As Double, dollarImpact As Double
    Dim actualDays As Long

    Set ws = PrepareOutputSheet("Daily_Rolling_Reset", _
                                "Daily Rolling Reinvestment Analysis", "AB")

    ReDim detail(1 To gCurveRows * TENOR_COUNT, 1 To 12)
    ReDim summary(1 To TENOR_COUNT, 1 To 14)
    outRow = 0

    For t = 1 To TENOR_COUNT

        ReDim changes(1 To gCurveRows)
        ReDim impacts(1 To gCurveRows)
        ReDim starts(1 To gCurveRows)
        ReDim ends(1 To gCurveRows)

        count = 0
        tenorMonths = CLng(TenorMaturityMonths(t))

        For r = 1 To gCurveRows

            scenarioStart = gCurveDates(r)

            If scenarioStart >= gRequestedStartDate And _
               scenarioStart <= gEndDate Then

                If t = 1 Then
                    maturityIndex = NextCurveIndexAfter(scenarioStart)
                    If maturityIndex = 0 Then Exit For

                    targetDate = scenarioStart + 1#
                    actualDate = gCurveDates(maturityIndex)

                    If actualDate > gEndDate Then Exit For
                Else
                    targetDate = CDbl(AddMonthsAnchored(CDate(scenarioStart), _
                                                       tenorMonths))

                    If targetDate > gEndDate Then Exit For

                    maturityIndex = LatestCurveIndexLE(targetDate)
                    If maturityIndex <= r Then GoTo NextResetScenario
                    actualDate = gCurveDates(maturityIndex)
                End If

                startRateIndex = LatestValidRateIndexLE(scenarioStart, t)
                maturityRateIndex = LatestValidRateIndexLE(actualDate, t)

                startRate = gRates(startRateIndex, t)
                maturityRate = gRates(maturityRateIndex, t)
                changeBps = (maturityRate - startRate) * 100#
                actualDays = CLng(actualDate - scenarioStart)

                dollarImpact = gNotional * changeBps / 10000# * _
                               actualDays / DAY_COUNT

                count = count + 1
                changes(count) = changeBps
                impacts(count) = dollarImpact
                starts(count) = startRate
                ends(count) = maturityRate

                outRow = outRow + 1
                detail(outRow, 1) = TenorName(t)
                detail(outRow, 2) = CDate(scenarioStart)
                detail(outRow, 3) = CDate(gCurveDates(startRateIndex))
                detail(outRow, 4) = startRate
                detail(outRow, 5) = CDate(targetDate)
                detail(outRow, 6) = CDate(actualDate)
                detail(outRow, 7) = CDate(gCurveDates(maturityRateIndex))
                detail(outRow, 8) = maturityRate
                detail(outRow, 9) = changeBps
                detail(outRow, 10) = actualDays
                detail(outRow, 11) = dollarImpact

                If changeBps > 0 Then
                    detail(outRow, 12) = "Higher"
                ElseIf changeBps < 0 Then
                    detail(outRow, 12) = "Lower"
                Else
                    detail(outRow, 12) = "Unchanged"
                End If
            End If

NextResetScenario:
        Next r

        summary(t, 1) = TenorName(t)
        summary(t, 2) = count
        summary(t, 3) = AverageArrayV3(starts, count)
        summary(t, 4) = AverageArrayV3(ends, count)
        summary(t, 5) = AverageArrayV3(changes, count)
        summary(t, 6) = StDevArrayV3(changes, count)
        summary(t, 7) = PercentileArrayV3(changes, count, 0.5)
        summary(t, 8) = PercentileArrayV3(changes, count, 0.05)
        summary(t, 9) = PercentileArrayV3(changes, count, 0.95)
        summary(t, 10) = MinArrayV3(changes, count)
        summary(t, 11) = MaxArrayV3(changes, count)
        summary(t, 12) = PositiveShareV3(changes, count)
        summary(t, 13) = AverageArrayV3(impacts, count)
        summary(t, 14) = MinArrayV3(impacts, count)
    Next t

    WriteRow ws.Range("A3"), _
        Array("Tenor", "Start Date", "Start Rate Date", "Start Rate (%)", _
              "Target Maturity", "Actual Maturity", "Maturity Rate Date", _
              "Maturity Rate (%)", "Reset Change (bps)", "Actual Days", _
              "Next-Cycle Dollar Impact ($)", "Direction")
    ApplyHeaderStyle ws.Range("A3:L3")

    If outRow > 0 Then
        ws.Range("A4").Resize(outRow, 12).Value = detail
    End If

    WriteRow ws.Range("O3"), _
        Array("Tenor", "Daily Starting Scenarios", "Average Start Rate (%)", _
              "Average Maturity Rate (%)", "Average Reset (bps)", _
              "Reset Volatility (bps)", "Median Reset (bps)", _
              "5th Percentile (bps)", "95th Percentile (bps)", _
              "Worst Decline (bps)", "Largest Increase (bps)", _
              "Positive Resets (%)", "Average Dollar Impact ($)", _
              "Worst Dollar Impact ($)")
    ApplyHeaderStyle ws.Range("O3:AB3")
    ws.Range("O4").Resize(TENOR_COUNT, 14).Value = summary

    If outRow > 0 Then
        ws.Range("B4:C" & outRow + 3).NumberFormat = "mm/dd/yyyy"
        ws.Range("E4:G" & outRow + 3).NumberFormat = "mm/dd/yyyy"
        ws.Range("D4:D" & outRow + 3).NumberFormat = "0.0000"
        ws.Range("H4:H" & outRow + 3).NumberFormat = "0.0000"
        ws.Range("I4:I" & outRow + 3).NumberFormat = _
            "0.0;[Red](0.0);-"
        ws.Range("K4:K" & outRow + 3).NumberFormat = _
            "$#,##0;[Red]($#,##0);-"
        ws.Range("A3:L" & outRow + 3).AutoFilter
    End If

    ws.Range("Q4:R8").NumberFormat = "0.0000"
    ws.Range("S4:Y8").NumberFormat = "0.0;[Red](0.0);-"
    ws.Range("Z4:Z8").NumberFormat = "0%"
    ws.Range("AA4:AB8").NumberFormat = "$#,##0;[Red]($#,##0);-"

    ws.Columns("A:AB").AutoFit
    ws.Columns("AA:AB").ColumnWidth = 18

    On Error Resume Next
    ws.Activate
    ActiveWindow.FreezePanes = False
    ws.Range("A4").Select
    ActiveWindow.FreezePanes = True
    On Error GoTo 0

End Sub

Private Sub DescribeFrontierV3()
    Dim ws As Worksheet, lastRow As Long, r As Long, rank As Long, total As Long
    Dim w0 As Double, w1 As Double, w2 As Double, w3 As Double, w6 As Double
    Dim wam As Double, liq30 As Double, liq60 As Double, liq90 As Double
    Dim segmentName As String, descriptionText As String, allocationText As String

    Set ws = ThisWorkbook.Worksheets("Portfolio_Analysis")
    lastRow = ws.Cells(ws.Rows.Count, 15).End(xlUp).Row
    If lastRow < 12 Then Exit Sub
    total = lastRow - 11

    WriteRow ws.Range("O11"), Array("Annualized Volatility", "Annualized Return", "ON Weight", "1M Weight", "2M Weight", "3M Weight", "6M Weight", "WAM (Months)", "Available <=30D", "Available <=60D", "Available <=90D", "Frontier Rank", "Frontier Segment", "Description", "Allocation Summary")
    ApplyHeaderStyle ws.Range("O11:AC11")

    ' Rebuild descriptions from the frontier values retained in columns A:M.
    Dim frontierData As Variant, frontierRows As Collection, item As Variant
    Set frontierRows = New Collection
    For r = 4 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        If IsNumeric(ws.Cells(r, 6).Value) And IsNumeric(ws.Cells(r, 7).Value) Then
            frontierRows.Add r
        End If
    Next r

    ' Existing frontier rows O:P and weights Q:U are generated by the core model.
    lastRow = ws.Cells(ws.Rows.Count, 15).End(xlUp).Row
    total = lastRow - 11
    For r = 12 To lastRow
        rank = r - 11
        w0 = CDbl(ws.Cells(r, 17).Value)
        w1 = CDbl(ws.Cells(r, 18).Value)
        w2 = CDbl(ws.Cells(r, 19).Value)
        w3 = CDbl(ws.Cells(r, 20).Value)
        w6 = CDbl(ws.Cells(r, 21).Value)
        wam = w1 + 2# * w2 + 3# * w3 + 6# * w6
        liq30 = w0 + w1
        liq60 = liq30 + w2
        liq90 = liq60 + w3
        segmentName = FrontierSegmentV3(rank, total)
        descriptionText = FrontierDescriptionV3(segmentName)
        allocationText = Format(w0, "0%") & " ON / " & Format(w1, "0%") & " 1M / " & Format(w2, "0%") & " 2M / " & Format(w3, "0%") & " 3M / " & Format(w6, "0%") & " 6M; WAM " & Format(wam, "0.0") & " months; " & Format(liq30, "0%") & " available within 30 days."
        ws.Cells(r, 22).Value = wam
        ws.Cells(r, 23).Value = liq30
        ws.Cells(r, 24).Value = liq60
        ws.Cells(r, 25).Value = liq90
        ws.Cells(r, 26).Value = rank
        ws.Cells(r, 27).Value = segmentName
        ws.Cells(r, 28).Value = descriptionText
        ws.Cells(r, 29).Value = allocationText
    Next r

    ws.Range("O12:P" & lastRow).NumberFormat = "0.000%"
    ws.Range("Q12:U" & lastRow).NumberFormat = "0%"
    ws.Range("V12:V" & lastRow).NumberFormat = "0.0"
    ws.Range("W12:Y" & lastRow).NumberFormat = "0%"
    ws.Columns("AB:AC").ColumnWidth = 46
    ws.Range("AB12:AC" & lastRow).WrapText = True
End Sub

Private Sub BuildChartDataV3()

    Dim ws As Worksheet
    Dim premiumWs As Worksheet
    Dim resetWs As Worksheet
    Dim portfolioWs As Worksheet

    Dim curveStartIndex As Long, curveEndIndex As Long
    Dim lastIndexInMonth As Long
    Dim frontierLastRow As Long
    Dim outputRow As Long
    Dim i As Long, r As Long, t As Long
    Dim currentKey As String, nextKey As String
    Dim observationDate As Double
    Dim lastMonthlyDate As Double

    Set ws = PrepareOutputSheet("Chart_Data", "Chart Data", "AO")
    Set premiumWs = ThisWorkbook.Worksheets("Premium_Analysis")
    Set resetWs = ThisWorkbook.Worksheets("Daily_Rolling_Reset")
    Set portfolioWs = ThisWorkbook.Worksheets("Portfolio_Analysis")

    ws.Cells.UnMerge
    ws.Cells.Clear

    WriteRow ws.Range("A1"), _
        Array("Month", "ON", "1M", "2M", "3M", "6M")
    WriteRow ws.Range("H1"), _
        Array("Month", "1M", "2M", "3M", "6M")
    WriteRow ws.Range("N1"), _
        Array("Tenor", "Historical Average", "Current")
    WriteRow ws.Range("R1"), _
        Array("Tenor", "Incremental Interest vs ON ($000)")
    WriteRow ws.Range("U1"), _
        Array("Tenor", "Annualized Volatility (bps)", _
              "Return vs ON (bps)")
    WriteRow ws.Range("Y1"), _
        Array("Annualized Volatility (bps)", "Return vs ON (bps)")
    WriteRow ws.Range("AB1"), _
        Array("Tenor", "Reset Volatility (bps)")
    WriteRow ws.Range("AE1"), _
        Array("Tenor", "5th Percentile", "Median", "95th Percentile")
    WriteRow ws.Range("AJ1"), _
        Array("Tenor", "Total Interest ($MM)", "Annualized Return", _
              "Earnings Volatility (bps)", "Reset Volatility (bps)", _
              "Reset Observations")

    ' Actual Excel dates are retained so chart category axes remain chronological.
    curveStartIndex = LatestCurveIndexLE(gStartDate)
    curveEndIndex = LatestCurveIndexLE( _
                    Application.WorksheetFunction.Min( _
                    gEndDate, gCurveDates(gCurveRows)))

    outputRow = 2
    i = curveStartIndex

    Do While i <= curveEndIndex

        currentKey = Format(CDate(gCurveDates(i)), "yyyymm")
        lastIndexInMonth = i

        Do While lastIndexInMonth + 1 <= curveEndIndex
            nextKey = Format(CDate(gCurveDates(lastIndexInMonth + 1)), _
                             "yyyymm")
            If nextKey <> currentKey Then Exit Do
            lastIndexInMonth = lastIndexInMonth + 1
        Loop

        ws.Cells(outputRow, 1).Value = _
            CDate(gCurveDates(lastIndexInMonth))

        For t = 1 To TENOR_COUNT
            ws.Cells(outputRow, t + 1).Value = _
                gRates(lastIndexInMonth, t)
        Next t

        outputRow = outputRow + 1
        i = lastIndexInMonth + 1
    Loop

    If outputRow > 2 Then
        ws.Range("A2:A" & outputRow - 1).NumberFormat = "mmm-yy"
    End If

    ' Cumulative interest difference versus ON at aligned month ends.
    outputRow = 2

    For i = 1 To gMonthlyCount + 1
        observationDate = gMonthEndDates(i)

        If observationDate >= gStartDate And _
           observationDate <= gEndDate Then

            ws.Cells(outputRow, 8).Value = CDate(observationDate)

            For t = 2 To TENOR_COUNT
                ws.Cells(outputRow, t + 7).Value = _
                    (BalanceOnDate(t, observationDate) - _
                     BalanceOnDate(1, observationDate)) / 1000#
            Next t

            lastMonthlyDate = observationDate
            outputRow = outputRow + 1
        End If
    Next i

    If lastMonthlyDate < gEndDate Then
        ws.Cells(outputRow, 8).Value = CDate(gEndDate)

        For t = 2 To TENOR_COUNT
            ws.Cells(outputRow, t + 7).Value = _
                (BalanceOnDate(t, gEndDate) - _
                 BalanceOnDate(1, gEndDate)) / 1000#
        Next t

        outputRow = outputRow + 1
    End If

    If outputRow > 2 Then
        ws.Range("H2:H" & outputRow - 1).NumberFormat = "mmm-yy"
    End If

    ' Term-premium statistics.
    For r = 4 To 7
        ws.Cells(r - 2, 14).Value = premiumWs.Cells(r, 12).Value
        ws.Cells(r - 2, 15).Value = premiumWs.Cells(r, 13).Value
        ws.Cells(r - 2, 16).Value = premiumWs.Cells(r, 18).Value
    Next r

    ' Final incremental interest versus ON.
    For t = 2 To TENOR_COUNT
        ws.Cells(t, 18).Value = TenorName(t)
        ws.Cells(t, 19).Value = _
            (gTotalInterest(t) - gTotalInterest(1)) / 1000#
    Next t

    ' Earnings return and volatility use aligned month-end returns.
    For t = 1 To TENOR_COUNT
        ws.Cells(t + 1, 21).Value = TenorName(t)
        ws.Cells(t + 1, 22).Value = gTenorAnnualVol(t) * 10000#
        ws.Cells(t + 1, 23).Value = _
            (gTenorAnnualReturn(t) - gTenorAnnualReturn(1)) * 10000#
    Next t

    ' Efficient frontier.
    frontierLastRow = portfolioWs.Cells( _
                      portfolioWs.Rows.Count, 15).End(xlUp).Row

    outputRow = 2
    For r = 12 To frontierLastRow
        If IsNumeric(portfolioWs.Cells(r, 15).Value) And _
           IsNumeric(portfolioWs.Cells(r, 16).Value) Then

            ws.Cells(outputRow, 25).Value = _
                CDbl(portfolioWs.Cells(r, 15).Value) * 10000#
            ws.Cells(outputRow, 26).Value = _
                (CDbl(portfolioWs.Cells(r, 16).Value) - _
                 gTenorAnnualReturn(1)) * 10000#
            outputRow = outputRow + 1
        End If
    Next r

    ' Full-horizon reset-risk charts exclude ON, which is a next-curve-date horizon.
    For r = 5 To 8
        ws.Cells(r - 3, 28).Value = resetWs.Cells(r, 15).Value
        ws.Cells(r - 3, 29).Value = resetWs.Cells(r, 20).Value

        ws.Cells(r - 3, 31).Value = resetWs.Cells(r, 15).Value
        ws.Cells(r - 3, 32).Value = resetWs.Cells(r, 22).Value
        ws.Cells(r - 3, 33).Value = resetWs.Cells(r, 21).Value
        ws.Cells(r - 3, 34).Value = resetWs.Cells(r, 23).Value
    Next r

    ' Dashboard summary.
    For t = 1 To TENOR_COUNT
        ws.Cells(t + 1, 36).Value = TenorName(t)
        ws.Cells(t + 1, 37).Value = gTotalInterest(t) / 1000000#
        ws.Cells(t + 1, 38).Value = gAnnualizedReturn(t)
        ws.Cells(t + 1, 39).Value = gTenorAnnualVol(t) * 10000#
        ws.Cells(t + 1, 40).Value = resetWs.Cells(t + 3, 20).Value
        ws.Cells(t + 1, 41).Value = resetWs.Cells(t + 3, 16).Value
    Next t

    ws.Range("B:F").NumberFormat = "0.0000"
    ws.Range("I:L").NumberFormat = _
        "$0.0""k"";[Red]($0.0""k"");-"
    ws.Range("O:P").NumberFormat = "0.0"" bps"""
    ws.Range("S:S").NumberFormat = _
        "$0.0""k"";[Red]($0.0""k"");-"
    ws.Range("V:W").NumberFormat = "0.00"" bps"""
    ws.Range("Y:Z").NumberFormat = "0.00"" bps"""
    ws.Range("AC:AH").NumberFormat = "0.0"" bps"""
    ws.Range("AK:AK").NumberFormat = _
        "$0.000;[Red]($0.000);-"
    ws.Range("AL:AL").NumberFormat = "0.000%"
    ws.Range("AM:AN").NumberFormat = "0.00"" bps"""
    ws.Range("AO:AO").NumberFormat = "0"

    ws.Columns("A:AO").AutoFit

End Sub

Private Sub BuildDashboardV3()

    Dim ws As Worksheet
    Dim dataWs As Worksheet
    Dim rollWs As Worksheet
    Dim resetWs As Worksheet
    Dim portfolioWs As Worksheet

    Dim co As ChartObject
    Dim ch As Chart
    Dim s As Series

    Dim lastRatesRow As Long, lastExcessRow As Long
    Dim lastFrontierRow As Long
    Dim frontierSheetLastRow As Long
    Dim bestRow As Long, resetMaxRow As Long
    Dim bestValue As Double, resetMaxValue As Double
    Dim selectedRows As Variant, selectedLabels As Variant
    Dim blockIndex As Long, selectedRow As Long, outputRow As Long
    Dim interpretationText As String
    Dim t As Long, r As Long

    Set ws = PrepareOutputSheet("Dashboard", _
             "Historical Cash Investment Analysis | Actual Curve Results", "Q")
    Set dataWs = ThisWorkbook.Worksheets("Chart_Data")
    Set rollWs = ThisWorkbook.Worksheets("Rolling_Results")
    Set resetWs = ThisWorkbook.Worksheets("Daily_Rolling_Reset")
    Set portfolioWs = ThisWorkbook.Worksheets("Portfolio_Analysis")

    Do While ws.ChartObjects.Count > 0
        ws.ChartObjects(1).Delete
    Loop

    ws.Cells.UnMerge
    ws.Cells.Clear

    WriteSectionTitle ws, "A1:Q1", _
        "Historical Cash Investment Analysis | Actual Curve Results"
    WriteMergedTextRangeV3 ws, "A2:Q2", _
        "Daily accrual, daily rolling reinvestment risk and historical maturity diversification"

    WriteSectionTitle ws, "A9:Q9", "1  Curve and term premium"
    WriteSectionTitle ws, "A26:Q26", "2  Realized dollar outcome"
    WriteSectionTitle ws, "A43:Q43", _
        "3  Daily rolling reinvestment risk"
    WriteSectionTitle ws, "A60:Q60", _
        "4  Earnings stability and efficient frontier"

    bestRow = 4
    bestValue = CDbl(rollWs.Cells(4, 9).Value)

    For r = 5 To 8
        If CDbl(rollWs.Cells(r, 9).Value) > bestValue Then
            bestValue = CDbl(rollWs.Cells(r, 9).Value)
            bestRow = r
        End If
    Next r

    resetMaxRow = 5
    resetMaxValue = CDbl(resetWs.Cells(5, 20).Value)

    For r = 6 To 8
        If CDbl(resetWs.Cells(r, 20).Value) > resetMaxValue Then
            resetMaxValue = CDbl(resetWs.Cells(r, 20).Value)
            resetMaxRow = r
        End If
    Next r

    WriteDashboardCard ws, "A5:D5", "A6:D7", _
        "Analysis period", _
        Format(CDate(gStartDate), "dd-mmm-yyyy") & " to " & _
        Format(CDate(gEndDate), "dd-mmm-yyyy")

    WriteDashboardCard ws, "E5:H5", "E6:H7", _
        "Initial cash", Format(gNotional / 1000000#, "$0.0") & "MM"

    WriteDashboardCard ws, "J5:M5", "J6:M7", _
        "Highest realized ending value", _
        CStr(rollWs.Cells(bestRow, 8).Value) & " | " & _
        Format(bestValue / 1000000#, "$0.000") & "MM"

    WriteDashboardCard ws, "N5:Q5", "N6:Q7", _
        "Highest tenor reset volatility", _
        CStr(resetWs.Cells(resetMaxRow, 15).Value) & " | " & _
        Format(resetMaxValue, "0.0") & " bps"

    lastRatesRow = dataWs.Cells(dataWs.Rows.Count, 1).End(xlUp).Row
    lastExcessRow = dataWs.Cells(dataWs.Rows.Count, 8).End(xlUp).Row
    lastFrontierRow = dataWs.Cells(dataWs.Rows.Count, 25).End(xlUp).Row

    ' Historical rates.
    Set co = AddChartAtRange(ws, "A10:I24")
    Set ch = co.Chart

    ch.ChartType = xlLine
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Historical deposit rates | month-end observations"
    ch.HasLegend = True
    ch.Legend.Position = xlLegendPositionBottom

    For t = 1 To TENOR_COUNT
        Set s = ch.SeriesCollection.NewSeries
        s.Name = TenorName(t)
        s.XValues = dataWs.Range(dataWs.Cells(2, 1), _
                                 dataWs.Cells(lastRatesRow, 1))
        s.Values = dataWs.Range(dataWs.Cells(2, t + 1), _
                                dataWs.Cells(lastRatesRow, t + 1))
        s.Format.Line.ForeColor.RGB = TenorColor(t)
        s.Format.Line.Weight = 2
    Next t

    With ch.Axes(xlCategory)
        .CategoryType = xlTimeScale
        .BaseUnit = xlMonths
        .MajorUnit = 3
        .TickLabels.NumberFormat = "mmm-yy"
    End With

    ch.Axes(xlValue).TickLabels.NumberFormat = "0.0""%"""
    FormatChartBase ch

    ' Term premium.
    Set co = AddChartAtRange(ws, "J10:Q24")
    Set ch = co.Chart

    ch.ChartType = xlColumnClustered
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Term premium: current vs historical average"
    ch.HasLegend = True
    ch.Legend.Position = xlLegendPositionBottom

    Set s = ch.SeriesCollection.NewSeries
    s.Name = "Historical average"
    s.XValues = dataWs.Range("N2:N5")
    s.Values = dataWs.Range("O2:O5")
    s.Format.Fill.ForeColor.RGB = RGB(140, 152, 164)

    Set s = ch.SeriesCollection.NewSeries
    s.Name = "Current"
    s.XValues = dataWs.Range("N2:N5")
    s.Values = dataWs.Range("P2:P5")
    s.Format.Fill.ForeColor.RGB = RGB(47, 117, 181)

    ch.Axes(xlValue).TickLabels.NumberFormat = "0.0"" bps"""
    FormatChartBase ch

    ' Cumulative interest versus ON.
    Set co = AddChartAtRange(ws, "A27:I41")
    Set ch = co.Chart

    ch.ChartType = xlLine
    ch.HasTitle = True
    ch.ChartTitle.Text = "Cumulative interest versus ON"
    ch.HasLegend = True
    ch.Legend.Position = xlLegendPositionBottom

    For t = 2 To TENOR_COUNT
        Set s = ch.SeriesCollection.NewSeries
        s.Name = TenorName(t)
        s.XValues = dataWs.Range(dataWs.Cells(2, 8), _
                                 dataWs.Cells(lastExcessRow, 8))
        s.Values = dataWs.Range(dataWs.Cells(2, t + 7), _
                                dataWs.Cells(lastExcessRow, t + 7))
        s.Format.Line.ForeColor.RGB = TenorColor(t)
        s.Format.Line.Weight = 2
    Next t

    With ch.Axes(xlCategory)
        .CategoryType = xlTimeScale
        .BaseUnit = xlMonths
        .MajorUnit = 3
        .TickLabels.NumberFormat = "mmm-yy"
    End With

    ch.Axes(xlValue).TickLabels.NumberFormat = _
        "$0""k"";[Red]($0""k"");-"
    FormatChartBase ch

    ' Final incremental interest.
    Set co = AddChartAtRange(ws, "J27:Q41")
    Set ch = co.Chart

    ch.ChartType = xlBarClustered
    ch.HasTitle = True
    ch.ChartTitle.Text = "Final incremental interest versus ON"
    ch.HasLegend = False

    Set s = ch.SeriesCollection.NewSeries
    s.XValues = dataWs.Range("R2:R5")
    s.Values = dataWs.Range("S2:S5")
    s.Format.Fill.ForeColor.RGB = RGB(47, 117, 181)
    s.ApplyDataLabels
    s.DataLabels.NumberFormat = _
        "$0.0""k"";[Red]($0.0""k"");-"

    ch.Axes(xlValue).TickLabels.NumberFormat = _
        "$0""k"";[Red]($0""k"");-"
    FormatChartBase ch

    ' Reset volatility.
    Set co = AddChartAtRange(ws, "A44:I58")
    Set ch = co.Chart

    ch.ChartType = xlColumnClustered
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Daily rolling reset volatility | full tenor horizon"
    ch.HasLegend = False

    Set s = ch.SeriesCollection.NewSeries
    s.XValues = dataWs.Range("AB2:AB5")
    s.Values = dataWs.Range("AC2:AC5")
    s.Format.Fill.ForeColor.RGB = RGB(47, 117, 181)
    s.ApplyDataLabels
    s.DataLabels.NumberFormat = "0.0"" bps"""

    ch.Axes(xlValue).TickLabels.NumberFormat = "0.0"" bps"""
    FormatChartBase ch

    ' Reset distribution.
    Set co = AddChartAtRange(ws, "J44:Q58")
    Set ch = co.Chart

    ch.ChartType = xlColumnClustered
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Reset distribution | 5th, median and 95th percentile"
    ch.HasLegend = True
    ch.Legend.Position = xlLegendPositionBottom

    For r = 32 To 34
        Set s = ch.SeriesCollection.NewSeries
        s.Name = dataWs.Cells(1, r).Value
        s.XValues = dataWs.Range("AE2:AE5")
        s.Values = dataWs.Range(dataWs.Cells(2, r), _
                                dataWs.Cells(5, r))
    Next r

    ch.SeriesCollection(1).Format.Fill.ForeColor.RGB = RGB(196, 78, 82)
    ch.SeriesCollection(2).Format.Fill.ForeColor.RGB = RGB(140, 152, 164)
    ch.SeriesCollection(3).Format.Fill.ForeColor.RGB = RGB(58, 141, 93)

    ch.Axes(xlValue).TickLabels.NumberFormat = "0.0"" bps"""
    FormatChartBase ch

    ' Earnings return versus volatility.
    Set co = AddChartAtRange(ws, "A61:I75")
    Set ch = co.Chart

    ch.ChartType = xlXYScatter
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Earnings return versus volatility | aligned month ends"
    ch.HasLegend = True
    ch.Legend.Position = xlLegendPositionBottom

    For t = 1 To TENOR_COUNT
        Set s = ch.SeriesCollection.NewSeries
        s.Name = TenorName(t)
        s.XValues = dataWs.Cells(t + 1, 22)
        s.Values = dataWs.Cells(t + 1, 23)
        s.MarkerStyle = xlMarkerStyleCircle
        s.MarkerSize = 8
        s.MarkerForegroundColor = TenorColor(t)
        s.MarkerBackgroundColor = TenorColor(t)
    Next t

    ch.Axes(xlCategory).HasTitle = True
    ch.Axes(xlCategory).AxisTitle.Text = _
        "Annualized earnings volatility (bps)"
    ch.Axes(xlCategory).TickLabels.NumberFormat = "0.00"" bps"""

    ch.Axes(xlValue).HasTitle = True
    ch.Axes(xlValue).AxisTitle.Text = _
        "Annualized return vs ON (bps)"
    ch.Axes(xlValue).TickLabels.NumberFormat = "0.00"" bps"""
    FormatChartBase ch

    ' Efficient frontier.
    Set co = AddChartAtRange(ws, "J61:Q75")
    Set ch = co.Chart

    ch.ChartType = xlXYScatterLinesNoMarkers
    ch.HasTitle = True
    ch.ChartTitle.Text = _
        "Historical efficient frontier | actual curve"
    ch.HasLegend = False

    Set s = ch.SeriesCollection.NewSeries
    s.Name = "Frontier"
    s.XValues = dataWs.Range("Y2:Y" & lastFrontierRow)
    s.Values = dataWs.Range("Z2:Z" & lastFrontierRow)
    s.Format.Line.ForeColor.RGB = RGB(18, 59, 93)
    s.Format.Line.Weight = 2.5

    ch.Axes(xlCategory).HasTitle = True
    ch.Axes(xlCategory).AxisTitle.Text = _
        "Annualized earnings volatility (bps)"
    ch.Axes(xlCategory).TickLabels.NumberFormat = "0.00"" bps"""

    ch.Axes(xlValue).HasTitle = True
    ch.Axes(xlValue).AxisTitle.Text = _
        "Annualized return vs ON (bps)"
    ch.Axes(xlValue).TickLabels.NumberFormat = "0.00"" bps"""
    FormatChartBase ch

    ' Summary table.
    WriteRow ws.Range("A77"), _
        Array("Tenor", "Total Interest ($MM)", "Annualized Return", _
              "Earnings Volatility (bps)", "Reset Volatility (bps)", _
              "Reset Scenarios")
    ApplyHeaderStyle ws.Range("A77:F77")

    For t = 1 To TENOR_COUNT
        ws.Cells(t + 77, 1).Value = TenorName(t)
        ws.Cells(t + 77, 2).Value = gTotalInterest(t) / 1000000#
        ws.Cells(t + 77, 3).Value = gAnnualizedReturn(t)
        ws.Cells(t + 77, 4).Value = gTenorAnnualVol(t) * 10000#
        ws.Cells(t + 77, 5).Value = resetWs.Cells(t + 3, 20).Value
        ws.Cells(t + 77, 6).Value = resetWs.Cells(t + 3, 16).Value
    Next t

    ws.Range("B78:B82").NumberFormat = _
        "$0.000;[Red]($0.000);-"
    ws.Range("C78:C82").NumberFormat = "0.000%"
    ws.Range("D78:E82").NumberFormat = "0.00"" bps"""
    ws.Range("F78:F82").NumberFormat = "0"

    ' Frontier descriptions.
    WriteSectionTitle ws, "H77:Q77", _
        "Efficient-frontier point descriptions"

    frontierSheetLastRow = portfolioWs.Cells( _
                           portfolioWs.Rows.Count, 15).End(xlUp).Row

    selectedRows = Array(12, _
                         12 + (frontierSheetLastRow - 12) \ 2, _
                         frontierSheetLastRow)
    selectedLabels = Array("Minimum volatility", _
                           "Balanced frontier", _
                           "Maximum historical return")

    For blockIndex = 0 To 2
        selectedRow = CLng(selectedRows(blockIndex))
        outputRow = 78 + blockIndex * 2

        ws.Range("H" & outputRow & ":I" & outputRow + 1).Merge
        ws.Range("J" & outputRow & ":Q" & outputRow + 1).Merge

        ws.Cells(outputRow, 8).Value = selectedLabels(blockIndex)
        ws.Cells(outputRow, 10).Value = _
            CStr(portfolioWs.Cells(selectedRow, 28).Value) & " " & _
            CStr(portfolioWs.Cells(selectedRow, 29).Value)

        FormatSummaryBox ws.Range("H" & outputRow & _
                                  ":I" & outputRow + 1)
        ws.Range("H" & outputRow & ":I" & outputRow + 1).Font.Bold = True
        FormatSummaryBox ws.Range("J" & outputRow & _
                                  ":Q" & outputRow + 1)
    Next blockIndex

    WriteSectionTitle ws, "A85:Q85", "Model interpretation"

    interpretationText = _
        "Daily rolling reset analysis uses every eligible curve date as a real " & _
        "investment start and compares the same-tenor rate at actual maturity." & _
        vbLf & vbLf & _
        CStr(rollWs.Cells(bestRow, 8).Value) & _
        " produced the highest ending value, " & _
        Format(CDbl(rollWs.Cells(bestRow, 15).Value) / 1000#, _
               "$0.0""k"";[Red]($0.0""k"")") & _
        " versus ON over the selected period." & vbLf & vbLf & _
        "Earnings volatility uses aligned month-end economic returns and is " & _
        "the input for covariance and the efficient frontier. Reset volatility " & _
        "measures reinvestment risk and is not substituted into the frontier."

    WriteMergedTextRangeV3 ws, "A86:Q91", interpretationText
    ws.Range("A86:Q91").Interior.Color = RGB(244, 247, 250)
    ws.Range("A86:Q91").VerticalAlignment = xlTop

    WriteMergedTextRangeV3 ws, "A93:Q94", _
        "Historical analysis only. Reset scenarios overlap by design because " & _
        "every eligible curve date is a valid investment start. Results are " & _
        "not a forecast."
    ws.Range("A93:Q94").Interior.Color = RGB(234, 241, 246)
    ws.Range("A93:Q94").Font.Italic = True
    ws.Range("A93:Q94").Font.Color = RGB(140, 152, 164)

    ws.Columns("A:Q").ColumnWidth = 11
    ws.Columns("A").ColumnWidth = 15
    ws.Columns("I").ColumnWidth = 3
    ws.Columns("Q").ColumnWidth = 15

    On Error Resume Next
    ws.Activate
    ActiveWindow.FreezePanes = False
    ws.Range("A4").Select
    ActiveWindow.FreezePanes = True
    On Error GoTo 0

End Sub

Private Function LatestCurveIndexInArrayV3(ByVal data As Variant, ByVal n As Long, ByVal targetDate As Double) As Long
    Dim lo As Long, hi As Long, mid As Long, result As Long
    lo = 1: hi = n: result = 0
    Do While lo <= hi
        mid = (lo + hi) \ 2
        If CDbl(CDate(data(mid, 1))) <= targetDate Then result = mid: lo = mid + 1 Else hi = mid - 1
    Loop
    LatestCurveIndexInArrayV3 = result
End Function

Private Function AverageArrayV3(ByRef values() As Double, ByVal count As Long) As Double
    Dim i As Long, total As Double: For i = 1 To count: total = total + values(i): Next i
    If count > 0 Then AverageArrayV3 = total / count
End Function
Private Function MinArrayV3(ByRef values() As Double, ByVal count As Long) As Double
    Dim i As Long, result As Double: If count = 0 Then Exit Function
    result = values(1): For i = 2 To count: If values(i) < result Then result = values(i): Next i: MinArrayV3 = result
End Function
Private Function MaxArrayV3(ByRef values() As Double, ByVal count As Long) As Double
    Dim i As Long, result As Double: If count = 0 Then Exit Function
    result = values(1): For i = 2 To count: If values(i) > result Then result = values(i): Next i: MaxArrayV3 = result
End Function
Private Function StDevArrayV3(ByRef values() As Double, ByVal count As Long) As Double
    Dim i As Long, avg As Double, ss As Double: If count < 2 Then Exit Function
    avg = AverageArrayV3(values, count): For i = 1 To count: ss = ss + (values(i) - avg) ^ 2: Next i
    StDevArrayV3 = Sqr(ss / (count - 1))
End Function
Private Function PercentileArrayV3(ByRef values() As Double, ByVal count As Long, ByVal percentileValue As Double) As Double
    Dim copyValues() As Double, i As Long: If count = 0 Then Exit Function
    ReDim copyValues(1 To count): For i = 1 To count: copyValues(i) = values(i): Next i
    PercentileArrayV3 = Application.WorksheetFunction.Percentile_Inc(copyValues, percentileValue)
End Function
Private Function PositiveShareV3(ByRef values() As Double, ByVal count As Long) As Double
    Dim i As Long, positives As Long: For i = 1 To count: If values(i) > 0 Then positives = positives + 1: Next i
    If count > 0 Then PositiveShareV3 = positives / count
End Function
Private Function FrontierSegmentV3(ByVal rank As Long, ByVal total As Long) As String
    Dim position As Double
    If rank = 1 Or total <= 1 Then FrontierSegmentV3 = "Minimum Volatility": Exit Function
    position = (rank - 1) / (total - 1)
    If position <= 0.25 Then
        FrontierSegmentV3 = "Defensive"
    ElseIf position <= 0.5 Then
        FrontierSegmentV3 = "Conservative"
    ElseIf position <= 0.75 Then
        FrontierSegmentV3 = "Balanced"
    ElseIf position < 1 Then
        FrontierSegmentV3 = "Return Oriented"
    Else
        FrontierSegmentV3 = "Maximum Historical Return"
    End If
End Function
Private Function FrontierDescriptionV3(ByVal segmentName As String) As String
    Select Case segmentName
        Case "Minimum Volatility": FrontierDescriptionV3 = "Lowest historical earnings volatility on the efficient frontier; accepts the lowest frontier return."
        Case "Defensive": FrontierDescriptionV3 = "Small increase in volatility from the minimum-risk point in exchange for incremental historical return."
        Case "Conservative": FrontierDescriptionV3 = "Moderate maturity extension and return improvement while remaining in the lower half of frontier volatility."
        Case "Balanced": FrontierDescriptionV3 = "Middle of the efficient frontier; balances historical return, earnings volatility and contractual liquidity."
        Case "Return Oriented": FrontierDescriptionV3 = "Higher historical return with greater volatility and/or reduced short-term liquidity."
        Case Else: FrontierDescriptionV3 = "Highest historical return on the efficient frontier; no tested efficient allocation earned more."
    End Select
End Function
Private Sub WriteMergedTextRangeV3(ByVal ws As Worksheet, ByVal address As String, ByVal textValue As String)
    ws.Range(address).Merge: ws.Range(address).Cells(1, 1).Value = textValue: ws.Range(address).WrapText = True
End Sub
Private Sub StyleDashboardCardsV3(ByVal target As Range)
    target.Interior.Color = RGB(234, 241, 246): target.Font.Color = RGB(36, 55, 70): target.VerticalAlignment = xlCenter
End Sub
