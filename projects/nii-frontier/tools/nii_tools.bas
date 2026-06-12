Attribute VB_Name = "NIITools"
' =====================================================================
' NII FRONTIER LITE v4.0 - optional VBA helpers
' Workbook is fully functional WITHOUT macros. Two ways to add:
'   Import: Alt+F11 > File > Import File > nii_tools.bas
'   Paste:  use nii_tools.txt (this file minus the Attribute line)
' Save as .xlsm afterwards. Alt+F8 to run. Sheet: "MODEL".
' Layout v4.0: scales H37:O37 - weights H38:O38 - results R9:Y9
' =====================================================================
Option Explicit

Sub ScaleAllScenarios()
    Dim f As Variant
    f = Application.InputBox("Scale factor for ALL scenario paths (e.g. 2 = double):", _
                             "Scale scenarios", 1#, Type:=1)
    If f = False Then Exit Sub
    Worksheets("MODEL").Range("H37:O37").Value = f
End Sub

Sub ResetScales()
    Worksheets("MODEL").Range("H37:O37").Value = 1#
End Sub

Sub SnapshotResults()
    Dim ws As Worksheet, rs As Worksheet, r As Long, j As Long
    Set ws = Worksheets("MODEL")
    On Error Resume Next
    Set rs = Worksheets("RUNS")
    On Error GoTo 0
    If rs Is Nothing Then
        Set rs = Worksheets.Add(After:=ws): rs.Name = "RUNS"
        rs.Cells(1, 1).Value = "Timestamp": rs.Cells(1, 2).Value = "Fixed %"
        rs.Cells(1, 3).Value = "Notional %": rs.Cells(1, 4).Value = "Tenor m"
        For j = 0 To 7
            rs.Cells(1, 5 + j).Value = ws.Cells(5, 18 + j).Value
        Next j
        rs.Cells(1, 13).Value = "Expected": rs.Cells(1, 14).Value = "Vol"
        rs.Cells(1, 15).Value = "Worst": rs.Cells(1, 16).Value = "Fair %"
        rs.Rows(1).Font.Bold = True
    End If
    r = rs.Cells(rs.Rows.Count, 1).End(xlUp).Row + 1
    rs.Cells(r, 1).Value = Now
    rs.Cells(r, 2).Value = ws.Range("B12").Value
    rs.Cells(r, 3).Value = ws.Range("B14").Value
    rs.Cells(r, 4).Value = ws.Range("B6").Value
    For j = 0 To 7
        rs.Cells(r, 5 + j).Value = ws.Cells(9, 18 + j).Value
    Next j
    rs.Cells(r, 13).Value = ws.Range("R12").Value
    rs.Cells(r, 14).Value = ws.Range("R13").Value
    rs.Cells(r, 15).Value = ws.Range("R14").Value
    rs.Cells(r, 16).Value = ws.Range("R15").Value
    MsgBox "Snapshot saved to RUNS row " & r, vbInformation
End Sub
