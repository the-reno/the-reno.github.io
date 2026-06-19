Attribute VB_Name = "modMain"
'==============================================================================
' modMain  -  entry points. Assigned to the buttons on the Home sheet, or run
' from the macro list (Alt+F8).
'
'   BuildTemplate      build / reset the workbook (modSetup)
'   LoadSampleCurve    fill Curve with a test series (modSetup)
'   RunEverything      frontier + rolling window + scenarios + dashboard
'   RunDashboardMacro  one-look Results sheet
'   RunFrontierOnly / RunWindowMacro / RunScenarioOnly / RunAuditMacro
'==============================================================================
Option Explicit

Public Sub RunEverything()
    If Not HaveCurve Then Exit Sub
    LoadCurve
    modFrontier.BuildFrontier
    modScenario.BuildScenarioFrontier
    modWindow.RunRollingWindow
    modDashboard.RunDashboard
    Sheets("Results").Activate
End Sub

Public Sub RunDashboardMacro()
    If Not HaveCurve Then Exit Sub
    modDashboard.RunDashboard
End Sub

Public Sub RunFrontierOnly()
    If Not HaveCurve Then Exit Sub
    LoadCurve
    modFrontier.BuildFrontier
End Sub

Public Sub RunWindowMacro()
    If Not HaveCurve Then Exit Sub
    modWindow.RunRollingWindow
End Sub

Public Sub RunScenarioOnly()
    If Not HaveCurve Then Exit Sub
    LoadCurve
    modScenario.BuildScenarioFrontier
End Sub

Public Sub RunAuditMacro()
    If Not HaveCurve Then Exit Sub
    LoadCurve
    modAudit.RunAudit
End Sub

' guard: make sure a curve exists before running anything
Private Function HaveCurve() As Boolean
    Dim ws As Worksheet
    On Error Resume Next: Set ws = ThisWorkbook.Sheets("Curve"): On Error GoTo 0
    If ws Is Nothing Then
        MsgBox "No Curve sheet. Run BuildTemplate first.", vbExclamation: Exit Function
    End If
    If ws.Cells(5, 2).Value = "" Then
        MsgBox "Curve is empty. Paste your data (or click LOAD SAMPLE) first.", vbExclamation: Exit Function
    End If
    HaveCurve = True
End Function
