Attribute VB_Name = "modSetup"
'==============================================================================
' modSetup  -  builds the whole workbook template from scratch.
'
'   BuildTemplate    creates Home / Config / Curve / Audit sheets, headers,
'                    named cells, formatting and a one-click control panel.
'   LoadSampleCurve  fills Curve with a synthetic upward curve so you can test
'                    the engine immediately, before pasting your own data.
'
' Workflow:  Import all .bas modules  ->  run BuildTemplate  ->  paste your
' daily curve on the Curve sheet  ->  click RUN ALL.
'==============================================================================
Option Explicit


Public Sub BuildTemplate()
    Dim ans As VbMsgBoxResult
    ans = MsgBox("Build / reset the template sheets (Home, Config, Curve, Audit)?" & vbCrLf & _
                 "Your existing curve data on 'Curve' will be cleared.", vbOKCancel + vbQuestion, "Build template")
    If ans <> vbOK Then Exit Sub

    Application.ScreenUpdating = False
    BuildConfig
    BuildCurve
    BuildAuditInput
    BuildHome                  ' built last so it ends up first / active
    Application.ScreenUpdating = True
    Sheets("Home").Activate
    MsgBox "Template ready." & vbCrLf & _
           "1) (optional) click LOAD SAMPLE to test" & vbCrLf & _
           "2) paste your daily curve on the Curve sheet" & vbCrLf & _
           "3) click RUN ALL", vbInformation, "Done"
End Sub

'------------------------------------------------------------------ Home panel
Private Sub BuildHome()
    Dim ws As Worksheet: Set ws = FreshSheet("Home")
    ws.Tab.Color = RGB(200, 132, 30)
    ws.Cells.Font.Name = "Consolas"
    Title ws, "B2", "DEPOSIT LADDER OPTIMISER", 18
    Sub2 ws, "B3", "Fixed-rate time deposits  ·  ON / 1M / 2M / 3M  ·  easy input, precise output"

    ws.Range("B5").Value = "HOW TO USE"
    ws.Range("B5").Font.Bold = True: ws.Range("B5").Font.Color = RGB(200, 132, 30)
    Dim steps As Variant, i As Long
    steps = Array("1.  (optional) LOAD SAMPLE to test the engine right away", _
                  "2.  Go to the Curve sheet and paste your daily curve (date + ON,1M,2M,3M in %)", _
                  "3.  Set parameters on Config if the defaults don't suit you", _
                  "4.  Click RUN ALL  ->  reads Results, VBA_Frontier, VBA_Window, VBA_Scenario", _
                  "5.  For a single mix, type weights on Audit and click AUDIT for the cash-flow ledger")
    For i = 0 To UBound(steps)
        ws.Cells(6 + i, 2).Value = steps(i): ws.Cells(6 + i, 2).Font.Color = RGB(70, 70, 70)
    Next i

    ' control buttons
    AddBtn ws, "B13", "BUILD / RESET", "BuildTemplate"
    AddBtn ws, "D13", "LOAD SAMPLE", "LoadSampleCurve"
    AddBtn ws, "B15", "RUN ALL", "RunEverything"
    AddBtn ws, "D15", "DASHBOARD", "RunDashboardMacro"
    AddBtn ws, "B17", "FRONTIER", "RunFrontierOnly"
    AddBtn ws, "D17", "ROLLING 1Y", "RunWindowMacro"
    AddBtn ws, "B19", "SCENARIOS", "RunScenarioOnly"
    AddBtn ws, "D19", "AUDIT MIX", "RunAuditMacro"

    ws.Range("B22").Value = "OUTPUTS"
    ws.Range("B22").Font.Bold = True: ws.Range("B22").Font.Color = RGB(200, 132, 30)
    Dim outs As Variant
    outs = Array("Results       one-look summary: best mix, per-tenor return, income vol, recommendation", _
                 "VBA_Frontier  every mix: carry vs liquidity (WAM) and income volatility", _
                 "VBA_Window    rolling 1-year window: which tenor won, over time", _
                 "VBA_Scenario  forward reinvestment risk under +/- curve shocks", _
                 "VBA_Audit     granular cash-flow ledger for one chosen mix")
    For i = 0 To UBound(outs)
        ws.Cells(23 + i, 2).Value = outs(i): ws.Cells(23 + i, 2).Font.Color = RGB(70, 70, 70)
    Next i

    ws.Columns("A").ColumnWidth = 2
    GridOff ws
End Sub

'---------------------------------------------------------------------- Config
Private Sub BuildConfig()
    Dim ws As Worksheet: Set ws = FreshSheet("Config")
    ws.Cells.Font.Name = "Consolas": GridOff ws
    Title ws, "B2", "CONFIG  ·  set once", 15
    ws.Range("B4").Value = "Parameter": ws.Range("C4").Value = "Value"
    HeaderRow ws, "B4:C4"
    Dim rows As Variant, i As Long
    rows = Array(Array("Notional ($)", 100, "0"), _
                 Array("Day-count basis", 360, "0"), _
                 Array("Annualisation (days/yr)", 252, "0"), _
                 Array("Grid step (%)", 10, "0"), _
                 Array("Risk-free = avg ON (%)", "=IFERROR(AVERAGE(Curve!C5:C100000),0)", "0.000"), _
                 Array("ON  tenor (days)", 1, "0"), _
                 Array("1M  tenor (days)", 30, "0"), _
                 Array("2M  tenor (days)", 60, "0"), _
                 Array("3M  tenor (days)", 90, "0"))
    For i = 0 To UBound(rows)
        ws.Cells(5 + i, 2).Value = rows(i)(0)
        ws.Cells(5 + i, 3).Value = rows(i)(1)
        ws.Cells(5 + i, 3).NumberFormat = rows(i)(2)
        ws.Cells(5 + i, 3).HorizontalAlignment = xlCenter
        If Left(CStr(rows(i)(1)), 1) = "=" Then
            ws.Cells(5 + i, 3).Font.Color = RGB(0, 128, 0)        ' formula
        Else
            ws.Cells(5 + i, 3).Font.Color = RGB(0, 0, 255)        ' your input
        End If
        Border ws.Range(ws.Cells(5 + i, 2), ws.Cells(5 + i, 3))
    Next i
    ws.Columns("B").ColumnWidth = 26: ws.Columns("C").ColumnWidth = 30
End Sub

'----------------------------------------------------------------------- Curve
Private Sub BuildCurve()
    Dim ws As Worksheet: Set ws = FreshSheet("Curve")
    ws.Cells.Font.Name = "Consolas": GridOff ws
    Title ws, "B2", "DAILY DEPOSIT CURVE  ·  paste your data here (rates in %)", 13
    Sub2 ws, "B3", "Column B = date, then ON / 1M / 2M / 3M.  Newest or oldest first - both fine."
    Dim h As Variant, j As Long
    h = Array("Date", "ON (%)", "1M (%)", "2M (%)", "3M (%)")
    For j = 0 To UBound(h): ws.Cells(4, 2 + j).Value = h(j): Next j
    HeaderRow ws, "B4:F4"
    ws.Columns("B").ColumnWidth = 12
    For j = 3 To 6: ws.Columns(j).ColumnWidth = 10: Next j
    ws.Range(ws.Cells(5, 3), ws.Cells(100000, 6)).NumberFormat = "0.000"
    ws.Range("C5:F100000").Font.Color = RGB(0, 0, 255)
    ws.Activate: ws.Range("B5").Select
    ActiveWindow.FreezePanes = False
    ws.Range("B5").Select: ActiveWindow.FreezePanes = True
End Sub

'----------------------------------------------------------------- Audit input
Private Sub BuildAuditInput()
    Dim ws As Worksheet: Set ws = FreshSheet("Audit")
    ws.Cells.Font.Name = "Consolas": GridOff ws
    Title ws, "B2", "SINGLE-MIX AUDIT INPUT", 13
    Sub2 ws, "B3", "Type weights (sum to 100%), then click AUDIT on Home for the cash-flow ledger."
    ws.Range("B5").Value = "Weights": ws.Range("B5").Font.Bold = True
    Dim h As Variant, j As Long: h = Array("ON", "1M", "2M", "3M")
    For j = 0 To 3: ws.Cells(6, 3 + j).Value = h(j): Next j
    HeaderRow ws, "C6:F6"
    For j = 0 To 3
        ws.Cells(7, 3 + j).Value = 0.25
        ws.Cells(7, 3 + j).NumberFormat = "0%"
        ws.Cells(7, 3 + j).Font.Color = RGB(0, 0, 255)
        ws.Cells(7, 3 + j).HorizontalAlignment = xlCenter
        Border ws.Cells(7, 3 + j)
    Next j
    ws.Range("B7").Value = "mix:"
    ws.Range("G7").Formula = "=SUM(C7:F7)": ws.Range("G7").NumberFormat = "0%"
    ws.Range("H7").Formula = "=IF(G7=1,""OK"",""must = 100%"")"
    ws.Columns("B").ColumnWidth = 8
End Sub

'================================================================ sample loader
Public Sub LoadSampleCurve()
    Dim ws As Worksheet
    On Error Resume Next: Set ws = ThisWorkbook.Sheets("Curve"): On Error GoTo 0
    If ws Is Nothing Then MsgBox "Run BuildTemplate first.", vbExclamation: Exit Sub
    ws.Range("B5:F100000").ClearContents
    Dim n As Long, i As Long, dt As Date, onr As Double
    n = 252: dt = DateSerial(2025, 1, 2)
    For i = 1 To n
        Do While Weekday(dt, vbMonday) > 5: dt = dt + 1: Loop
        onr = 4.3 + 0.6 * Sin(i / 60)                       ' gentle wave
        ws.Cells(4 + i, 2).Value = dt: ws.Cells(4 + i, 2).NumberFormat = "yyyy-mm-dd"
        ws.Cells(4 + i, 3).Value = Round(onr, 3)
        ws.Cells(4 + i, 4).Value = Round(onr + 0.06, 3)
        ws.Cells(4 + i, 5).Value = Round(onr + 0.11, 3)
        ws.Cells(4 + i, 6).Value = Round(onr + 0.18, 3)
        dt = dt + 1
    Next i
    MsgBox n & " sample days loaded on Curve. Click RUN ALL.", vbInformation
End Sub

'====================================================================== helpers
Private Function FreshSheet(nm As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next: Set ws = ThisWorkbook.Sheets(nm): On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(1))
        ws.Name = nm
    Else
        ws.Cells.Clear
        Dim s As Shape
        For Each s In ws.Shapes: s.Delete: Next s
    End If
    Set FreshSheet = ws
End Function

Private Sub Title(ws As Worksheet, addr As String, txt As String, sz As Long)
    With ws.Range(addr): .Value = txt: .Font.Bold = True: .Font.Size = sz
        .Font.Color = RGB(28, 24, 19): End With
End Sub
Private Sub Sub2(ws As Worksheet, addr As String, txt As String)
    With ws.Range(addr): .Value = txt: .Font.Italic = True: .Font.Size = 9
        .Font.Color = RGB(107, 100, 89): End With
End Sub
Private Sub HeaderRow(ws As Worksheet, addr As String)
    With ws.Range(addr)
        .Font.Bold = True: .Font.Color = RGB(255, 255, 255)
        .Interior.Color = RGB(28, 24, 19): .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous: .Borders.Color = RGB(200, 200, 200)
    End With
End Sub
Private Sub Border(rng As Range)
    rng.Borders.LineStyle = xlContinuous: rng.Borders.Color = RGB(210, 210, 210)
End Sub
Private Sub AddBtn(ws As Worksheet, anchor As String, caption As String, macro As String)
    Dim b As Object, rng As Range
    Set rng = ws.Range(anchor)
    Set b = ws.Buttons.Add(rng.Left, rng.Top, 150, 26)
    b.Caption = caption
    b.OnAction = macro
    b.Font.Bold = True
End Sub
