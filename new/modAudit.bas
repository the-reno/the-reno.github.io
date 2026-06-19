Attribute VB_Name = "modAudit"
'==============================================================================
' modAudit  -  runs ONE strategy with full cash-flow logging.
' Reads target weights from the Audit sheet (cells C7:F7 = ON,1M,2M,3M),
' the same blue input cells used by the Lite decomposition, and writes the
' granular ledger to VBA_Audit: every PLACE / MATURE / REINVEST with interest.
'==============================================================================
Option Explicit

Public Sub RunAudit()
    Dim cfg As TConfig: cfg = LoadConfig
    Dim src As Worksheet, aud As Worksheet
    Set src = ThisWorkbook.Sheets("Audit")
    Set aud = EnsureSheet("VBA_Audit")

    Dim w(1 To 4) As Double, t As Long, tot As Double
    For t = 1 To 4
        w(t) = src.Cells(7, 2 + t).Value     ' C7..F7
        tot = tot + w(t)
    Next t
    If Abs(tot - 1#) > 0.0001 Then
        MsgBox "Weights in Audit!C7:F7 must sum to 100% (currently " _
               & Format(tot, "0%") & ").", vbExclamation
        Exit Sub
    End If

    Dim res As TSimResult
    res = SimulateStrategy(w, cfg, 0, 0, aud)
    aud.Activate
    MsgBox "Audit ledger written. Final NAV $" & Format(res.finalNav, "0.0000") _
           & "  |  Ann. return " & Format(res.annReturn, "0.000") & "%", vbInformation
End Sub
