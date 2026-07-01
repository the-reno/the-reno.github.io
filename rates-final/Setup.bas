Option Explicit

Sub SetupWorkbook()
    Dim ws As Worksheet

    On Error Resume Next
    Set ws = Sheets("Input")
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = Sheets.Add
        ws.Name = "Input"
    End If

    ws.Range("A1").Value = "Final End Date"
    ws.Range("B1").Value = Date
    ws.Range("A2").Value = "Analysis Years"
    ws.Range("B2").Value = 1
    ws.Columns("A:B").AutoFit

    Set ws = Nothing

    On Error Resume Next
    Set ws = Sheets("Output")
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = Sheets.Add
        ws.Name = "Output"
    End If

    ws.Cells.Clear
    ws.Range("A1:H1").Value = Array("Month", "Start", "End", "ON Factor", "1M Factor", "2M Factor", "3M Factor", "6M Factor")
    ws.Columns.AutoFit

    MsgBox "Input and Output sheets are ready."
End Sub
