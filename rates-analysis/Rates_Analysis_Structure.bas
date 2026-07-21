Attribute VB_Name = "RatesAnalysisStructure"
Option Explicit

' ============================================================================
' Historical Cash Investment Analysis - Workbook Structure
'
' Import this module together with Rates_Analysis_Model.bas.
'
' Public procedures:
'   CreateRatesAnalysisStructure          Reset and create the complete workbook
'   EnsureRatesAnalysisStructure          Create missing sheets without clearing data
'   ResetRatesAnalysisStructureSilently   Used by the simulation self-test
'
' User inputs:
'   Inputs!B5  Analysis start date
'   Inputs!B6  Analysis end date
'   Inputs!B7  Initial notional
'   Inputs!B8  Efficient-frontier weight step
'
' Required curve headers:
'   Date | ON | 1M | 2M | 3M | 6M
' ============================================================================

Private Const TITLE_NAVY As Long = 3809035      ' RGB(11, 31, 58)
Private Const HEADER_BLUE As Long = 7949855     ' RGB(31, 78, 121)
Private Const INPUT_PALE As Long = 16512494     ' RGB(238, 245, 251)

Public Sub CreateRatesAnalysisStructure()
    BuildRatesAnalysisStructure True, True
End Sub

' Backward-compatible macro name used by earlier versions.
Public Sub CreateBlankRatesModel()
    CreateRatesAnalysisStructure
End Sub

Public Sub EnsureRatesAnalysisStructure()
    BuildRatesAnalysisStructure False, False
End Sub

Public Sub ResetRatesAnalysisStructureSilently()
    BuildRatesAnalysisStructure True, False
End Sub

Private Sub BuildRatesAnalysisStructure(ByVal resetWorkbook As Boolean, _
                                        ByVal showCompletionMessage As Boolean)

    Dim oldCalculation As XlCalculation

    On Error GoTo CleanFail

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    oldCalculation = Application.Calculation
    Application.Calculation = xlCalculationManual

    CreateOrFormatInputs resetWorkbook
    CreateOrFormatCurve resetWorkbook

    CreateOutputSheet "Data_Quality", "Data Quality and Model Controls", "C", _
        Array("Check", "Result", "Status"), resetWorkbook

    CreateOutputSheet "Transactions", "Transaction Schedule", "N", _
        Array("Tenor", "Transaction ID", "Target Start Date", "Actual Start Date", _
              "Rate Observation Date", "Rate Used (%)", "Target Roll Date", _
              "Actual Roll Date", "Transaction Days", "Opening Notional ($)", _
              "Period Interest ($)", "Closing Notional ($)", "Status", _
              "Adjustment Flag"), resetWorkbook

    CreateOutputSheet "Daily_Accrual", "Daily Accrual Ledger", "T", _
        Array("Accrual Date", "Tenor", "Transaction ID", "Transaction Start Date", _
              "Target Roll Date", "Actual Roll Date", "Rate Observation Date", _
              "Rate Used (%)", "Opening Notional ($)", "Daily Interest ($)", _
              "Cumulative Period Interest ($)", "Full Period Interest ($)", _
              "Interest Paid Today ($)", "Economic Balance ($)", "Days Accrued", _
              "Transaction Days", "Days to Roll", "Roll Flag", "Status", _
              "Adjustment Flag"), resetWorkbook

    CreateOutputSheet "Premium_Analysis", "Historical Curve and Term Premium", "T", _
        Array("Date", "ON", "1M", "2M", "3M", "6M", "1M Premium (bps)", _
              "2M Premium (bps)", "3M Premium (bps)", "6M Premium (bps)"), _
              resetWorkbook

    CreateOutputSheet "Rolling_Results", "Rolling Investment Results", "O", _
        Array("Date", "ON", "1M", "2M", "3M", "6M"), resetWorkbook

    CreateOutputSheet "Monthly_Returns", "Monthly Economic Returns", "K", _
        Array("Month End", "ON", "1M", "2M", "3M", "6M"), resetWorkbook

    CreateOutputSheet "Portfolio_Analysis", "Historical Maturity Diversification", "AC", _
        Array("ON Weight", "1M Weight", "2M Weight", "3M Weight", "6M Weight", _
              "Annualized Return", "Annualized Volatility", "Return / Volatility", _
              "WAM (Months)", "Available <=30D", "Available <=60D", _
              "Available <=90D", "Available <=180D"), resetWorkbook

    CreateSwapDataSheet resetWorkbook

    CreateOutputSheet "Swap_Analysis", "Swap Overlay Analysis", "J", _
        Array("Strategy", "Ending Value ($)", "Total Interest ($)", _
              "Annualized Return", "Incremental vs ON ($)", _
              "Annualized Volatility", "Status"), resetWorkbook

    CreateOutputSheet "Chart_Data", "Chart Data", "AO", Empty, resetWorkbook
    CreateOutputSheet "Dashboard", "Historical Cash Investment Analysis", "Q", Empty, resetWorkbook
    CreateOutputSheet "Methodology", "Methodology, Definitions and Limitations", "H", Empty, resetWorkbook

    CreateOutputSheet "Test_Results", "Model Test Results", "D", _
        Array("Test", "Actual", "Expected / Tolerance", "Status"), resetWorkbook

    CreateDailyResetSheet resetWorkbook
    OrderRatesAnalysisSheets

    ThisWorkbook.Worksheets("Inputs").Activate

CleanExit:
    Application.Calculation = oldCalculation
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Application.StatusBar = False

    If showCompletionMessage Then
        MsgBox "Rates-analysis workbook structure created." & vbCrLf & _
               "Enter the Inputs values and paste the curve before running BuildRatesAnalysisModel.", _
               vbInformation
    End If
    Exit Sub

CleanFail:
    Application.StatusBar = False
    Application.Calculation = oldCalculation
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "Unable to create the workbook structure: " & Err.Description, vbCritical

End Sub

Private Sub CreateOrFormatInputs(ByVal resetSheet As Boolean)

    Dim ws As Worksheet
    Set ws = GetOrCreateStructureSheet("Inputs")

    If resetSheet Then
        ClearStructureSheet ws
    End If

    If Len(Trim$(CStr(ws.Range("A1").Value))) = 0 Then
        ws.Range("A1:H1").Merge
        ws.Range("A1").Value = "Rates Analysis Model - Control Panel"
        ApplyStructureTitle ws.Range("A1:H1")

        WriteStructureRow ws.Range("A4"), Array("Model Input", "Value")
        ApplyStructureHeader ws.Range("A4:B4")

        ws.Range("A5").Value = "Analysis Start Date"
        ws.Range("A6").Value = "Analysis End Date"
        ws.Range("A7").Value = "Initial Notional ($)"
        ws.Range("A8").Value = "Efficient Frontier Weight Step"
        ws.Range("A9").Value = "Day Count Basis"
        ws.Range("A10").Value = "Roll Convention"
        ws.Range("A11").Value = "Rate Input Convention"

        ws.Range("B5:B6").ClearContents
        ws.Range("B7").Value = 100000000#
        ws.Range("B8").Value = 0.1
        ws.Range("B9").Value = "ACT/360"
        ws.Range("B10").Value = "Latest curve date on or before target"
        ws.Range("B11").Value = "1.54 means 1.54%"

        ws.Range("B5:B8").Font.Color = RGB(0, 0, 255)
        ws.Range("B5:B6").NumberFormat = "mm/dd/yyyy"
        ws.Range("B7").NumberFormat = "$#,##0;[Red]($#,##0);-"
        ws.Range("B8").NumberFormat = "0%"

        ws.Range("D4:H4").Merge
        ws.Range("D4").Value = "Required Curve Structure"
        ApplyStructureHeader ws.Range("D4:H4")

        WriteMergedStructureText ws, "D5:H5", _
            "Enter the requested analysis dates in Inputs!B5:B6."
        WriteMergedStructureText ws, "D6:H6", _
            "Curve headers: Date | ON | 1M | 2M | 3M | 6M"
        WriteMergedStructureText ws, "D7:H7", _
            "Rates are percentage points: 4.31 means 4.31%."
        WriteMergedStructureText ws, "D8:H8", _
            "Every eligible curve date is used as a daily reinvestment scenario."
        WriteMergedStructureText ws, "D9:H9", _
            "Import both BAS modules, then run BuildRatesAnalysisModel."
        WriteMergedStructureText ws, "D10:H10", _
            "Efficient-frontier points include allocation and liquidity descriptions."

        ws.Range("D5:H10").Interior.Color = INPUT_PALE
        ws.Range("D5:H10").WrapText = True
        ws.Range("D5:H10").VerticalAlignment = xlCenter

        ws.Columns("A").ColumnWidth = 31
        ws.Columns("B").ColumnWidth = 28
        ws.Columns("C").ColumnWidth = 3
        ws.Columns("D:H").ColumnWidth = 15
        ws.Rows("5:11").RowHeight = 22
        ws.Rows(1).RowHeight = 30
    End If

End Sub

Private Sub CreateOrFormatCurve(ByVal resetSheet As Boolean)

    Dim ws As Worksheet
    Set ws = GetOrCreateStructureSheet("Curve")

    If resetSheet Then
        ClearStructureSheet ws
    End If

    If Len(Trim$(CStr(ws.Range("A1").Value))) = 0 Then
        WriteStructureRow ws.Range("A1"), Array("Date", "ON", "1M", "2M", "3M", "6M")
        ApplyStructureHeader ws.Range("A1:F1")

        ws.Range("A2:F10000").Font.Color = RGB(0, 0, 255)
        ws.Range("A:A").NumberFormat = "mm/dd/yyyy"
        ws.Range("B:F").NumberFormat = "0.0000"

        ws.Columns("A").ColumnWidth = 13
        ws.Columns("B:F").ColumnWidth = 11
        ws.Rows(1).RowHeight = 24

        FreezeStructurePane ws, "A2"
    End If

End Sub

Private Sub CreateOutputSheet(ByVal sheetName As String, ByVal titleText As String, _
                              ByVal finalColumn As String, ByVal headers As Variant, _
                              ByVal resetSheet As Boolean)

    Dim ws As Worksheet
    Dim headerCount As Long

    Set ws = GetOrCreateStructureSheet(sheetName)

    If resetSheet Then
        ClearStructureSheet ws
    End If

    If Len(Trim$(CStr(ws.Range("A1").Value))) = 0 Then
        ws.Range("A1:" & finalColumn & "1").Merge
        ws.Range("A1").Value = titleText
        ApplyStructureTitle ws.Range("A1:" & finalColumn & "1")
        ws.Rows(1).RowHeight = 30

        If Not IsEmpty(headers) Then
            headerCount = UBound(headers) - LBound(headers) + 1
            WriteStructureRow ws.Range("A3"), headers
            ApplyStructureHeader ws.Range("A3").Resize(1, headerCount)
            ws.Rows(3).RowHeight = 32
            FreezeStructurePane ws, "A4"
        End If

        ws.Columns("A:" & finalColumn).ColumnWidth = 12
        ws.Columns("A").ColumnWidth = 15
    End If

End Sub

Private Sub CreateSwapDataSheet(ByVal resetSheet As Boolean)

    Dim ws As Worksheet
    Set ws = GetOrCreateStructureSheet("Swap_Data")

    If resetSheet Then
        ClearStructureSheet ws
    End If

    If Len(Trim$(CStr(ws.Range("A1").Value))) = 0 Then
        ws.Range("A1:E1").Merge
        ws.Range("A1").Value = "Swap Market Data Input"
        ApplyStructureTitle ws.Range("A1:E1")

        WriteStructureRow ws.Range("A3"), _
            Array("Date", "SOFR (%)", "6M Swap Fixed (%)", "1Y Swap Fixed (%)", _
                  "Source / Notes")
        ApplyStructureHeader ws.Range("A3:E3")

        ws.Range("A4:E10000").Font.Color = RGB(0, 0, 255)
        ws.Range("A:A").NumberFormat = "mm/dd/yyyy"
        ws.Range("B:D").NumberFormat = "0.0000"

        ws.Columns("A").ColumnWidth = 13
        ws.Columns("B:D").ColumnWidth = 17
        ws.Columns("E").ColumnWidth = 32

        FreezeStructurePane ws, "A4"
    End If

End Sub

Private Sub CreateDailyResetSheet(ByVal resetSheet As Boolean)

    Dim ws As Worksheet
    Set ws = GetOrCreateStructureSheet("Daily_Rolling_Reset")

    If resetSheet Then
        ClearStructureSheet ws
    End If

    If Len(Trim$(CStr(ws.Range("A1").Value))) = 0 Then
        ws.Range("A1:AB1").Merge
        ws.Range("A1").Value = "Daily Rolling Reinvestment Analysis"
        ApplyStructureTitle ws.Range("A1:AB1")

        WriteStructureRow ws.Range("A3"), _
            Array("Tenor", "Start Date", "Start Rate Date", "Start Rate (%)", _
                  "Target Maturity", "Actual Maturity", "Maturity Rate Date", _
                  "Maturity Rate (%)", "Reset Change (bps)", "Actual Days", _
                  "Next-Cycle Dollar Impact ($)", "Direction")
        ApplyStructureHeader ws.Range("A3:L3")

        WriteStructureRow ws.Range("O3"), _
            Array("Tenor", "Daily Starting Scenarios", "Average Start Rate (%)", _
                  "Average Maturity Rate (%)", "Average Reset (bps)", _
                  "Reset Volatility (bps)", "Median Reset (bps)", _
                  "5th Percentile (bps)", "95th Percentile (bps)", _
                  "Worst Decline (bps)", "Largest Increase (bps)", _
                  "Positive Resets (%)", "Average Dollar Impact ($)", _
                  "Worst Dollar Impact ($)")
        ApplyStructureHeader ws.Range("O3:AB3")

        ws.Columns("A:AB").ColumnWidth = 12
        ws.Columns("B:C").ColumnWidth = 13
        ws.Columns("E:G").ColumnWidth = 13
        ws.Columns("K").ColumnWidth = 20
        ws.Columns("P:AB").ColumnWidth = 16

        FreezeStructurePane ws, "A4"
    End If

End Sub

Private Function GetOrCreateStructureSheet(ByVal sheetName As String) As Worksheet

    On Error Resume Next
    Set GetOrCreateStructureSheet = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0

    If GetOrCreateStructureSheet Is Nothing Then
        Set GetOrCreateStructureSheet = _
            ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        GetOrCreateStructureSheet.Name = sheetName
    End If

End Function

Private Sub ClearStructureSheet(ByVal ws As Worksheet)

    On Error Resume Next
    ws.Cells.UnMerge
    ws.Cells.Clear
    Do While ws.ChartObjects.Count > 0
        ws.ChartObjects(1).Delete
    Loop
    ws.AutoFilterMode = False
    On Error GoTo 0

End Sub

Private Sub OrderRatesAnalysisSheets()

    Dim names As Variant
    Dim i As Long
    Dim ws As Worksheet

    names = Array("Inputs", "Curve", "Data_Quality", "Transactions", "Daily_Accrual", _
                  "Premium_Analysis", "Rolling_Results", "Monthly_Returns", _
                  "Portfolio_Analysis", "Swap_Data", "Swap_Analysis", "Chart_Data", _
                  "Dashboard", "Methodology", "Test_Results", "Daily_Rolling_Reset")

    For i = UBound(names) To LBound(names) Step -1
        Set ws = ThisWorkbook.Worksheets(CStr(names(i)))
        ws.Move Before:=ThisWorkbook.Worksheets(1)
    Next i

End Sub

Private Sub WriteStructureRow(ByVal firstCell As Range, ByVal values As Variant)

    Dim output() As Variant
    Dim i As Long
    Dim count As Long

    count = UBound(values) - LBound(values) + 1
    ReDim output(1 To 1, 1 To count)

    For i = 1 To count
        output(1, i) = values(LBound(values) + i - 1)
    Next i

    firstCell.Resize(1, count).Value = output

End Sub

Private Sub WriteMergedStructureText(ByVal ws As Worksheet, ByVal addressText As String, _
                                     ByVal textValue As String)

    ws.Range(addressText).Merge
    ws.Range(addressText).Cells(1, 1).Value = textValue

End Sub

Private Sub ApplyStructureTitle(ByVal targetRange As Range)

    With targetRange
        .Interior.Color = TITLE_NAVY
        .Font.Color = vbWhite
        .Font.Bold = True
        .Font.Size = 16
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlCenter
    End With

End Sub

Private Sub ApplyStructureHeader(ByVal targetRange As Range)

    With targetRange
        .Interior.Color = HEADER_BLUE
        .Font.Color = vbWhite
        .Font.Bold = True
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .WrapText = True
    End With

End Sub

Private Sub FreezeStructurePane(ByVal ws As Worksheet, ByVal activeCellAddress As String)

    On Error Resume Next
    ws.Activate
    ActiveWindow.FreezePanes = False
    ws.Range(activeCellAddress).Select
    ActiveWindow.FreezePanes = True
    On Error GoTo 0

End Sub
