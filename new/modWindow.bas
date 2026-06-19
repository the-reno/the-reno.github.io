Attribute VB_Name = "modWindow"
'==============================================================================
' modWindow  -  expand the analysis across a long history.
'   RunFullPeriod    : best single tenor + mixes over the WHOLE loaded curve.
'   RunRollingWindow : steps a 1-year window through the history and records,
'                      for each window, the realised return of each tenor and
'                      the winning tenor -> shows how the best choice rotates
'                      with the rate regime (short in hikes, long into cuts).
'
' Self-contained windowed sim (reuses gRate/gDate, NextMatIdx, DaysBetween)
' so it stays consistent with modEngine but can run on any [lo,hi] sub-range.
'==============================================================================
Option Explicit

Private Const WIN_BD As Long = 252     ' window length in business days (~1y)
Private Const STEP_BD As Long = 21     ' step between windows (~1m)

' Annualised realised return (%) of a weight vector over curve indices [lo,hi].
Public Function WindowReturn(w() As Double, cfg As TConfig, _
                             ByVal lo As Long, ByVal hi As Long) As Double
    Dim dep(1 To 4) As TDeposit, t As Long, i As Long
    Dim interest As Double, navi As Double, yrs As Double
    For t = 1 To TENORS
        If w(t) > 0.0000001 Then
            dep(t).active = True: dep(t).principal = cfg.Notional * w(t)
            dep(t).rateLk = RateAt(lo, t): dep(t).startIdx = lo
            dep(t).matIdx = NextMatIdx(lo, cfg.CalDays(t))
        End If
    Next t
    For i = lo To hi
        For t = 1 To TENORS
            If dep(t).active Then
                If dep(t).matIdx = i And i < hi Then
                    interest = dep(t).principal * dep(t).rateLk / 100# * DaysBetween(dep(t).startIdx, i) / cfg.Basis
                    dep(t).principal = dep(t).principal + interest
                    dep(t).rateLk = RateAt(i, t): dep(t).startIdx = i
                    dep(t).matIdx = NextMatIdx(i, cfg.CalDays(t))
                End If
            End If
        Next t
    Next i
    navi = 0#
    For t = 1 To TENORS
        If dep(t).active Then
            navi = navi + dep(t).principal + dep(t).principal * dep(t).rateLk / 100# _
                   * DaysBetween(dep(t).startIdx, hi) / cfg.Basis
        End If
    Next t
    yrs = DaysBetween(lo, hi) / 365#
    If yrs > 0 Then WindowReturn = ((navi / cfg.Notional) ^ (1# / yrs) - 1#) * 100#
End Function

Public Sub RunFullPeriod()
    LoadCurve
    Dim cfg As TConfig: cfg = LoadConfig
    Dim ws As Worksheet: Set ws = EnsureSheet("VBA_FullPeriod")
    ws.Cells.Clear
    ws.Range("B2").Value = "FULL-PERIOD RESULT  " & Format(gDate(1), "yyyy-mm-dd") & "  to  " & Format(gDate(gN), "yyyy-mm-dd")
    ws.Range("B2").Font.Bold = True
    ws.Range("B4").Value = "Tenor": ws.Range("C4").Value = "Ann.Return %"
    ws.Range("B4:C4").Font.Bold = True
    Dim t As Long, w(1 To 4) As Double, nm As Variant
    nm = Array("ON", "1M", "2M", "3M")
    For t = 1 To 4
        Erase w: w(t) = 1#
        ws.Cells(4 + t, 2).Value = nm(t - 1)
        ws.Cells(4 + t, 3).Value = WindowReturn(w, cfg, 1, gN)
        ws.Cells(4 + t, 3).NumberFormat = "0.000"
    Next t
    ws.Columns("B:C").AutoFit
    MsgBox "Full-period returns written to VBA_FullPeriod.", vbInformation
End Sub

Public Sub RunRollingWindow()
    LoadCurve
    Dim cfg As TConfig: cfg = LoadConfig
    Dim ws As Worksheet: Set ws = EnsureSheet("VBA_Window")
    ws.Cells.Clear
    ws.Range("B2").Value = "ROLLING 1-YEAR WINDOW · realised return by tenor + winner"
    ws.Range("B2").Font.Bold = True
    Dim h As Variant, j As Long
    h = Array("Window end", "ON %", "1M %", "2M %", "3M %", "Winner")
    For j = 0 To UBound(h)
        ws.Cells(4, 2 + j).Value = h(j): ws.Cells(4, 2 + j).Font.Bold = True
    Next j
    Dim lo As Long, hi As Long, r As Long, t As Long, w(1 To 4) As Double
    Dim best As Double, bestT As Long, rr As Double
    Dim nm As Variant: nm = Array("ON", "1M", "2M", "3M")
    r = 5: lo = 1
    Application.ScreenUpdating = False
    Do While lo + WIN_BD <= gN
        hi = lo + WIN_BD
        ws.Cells(r, 2).Value = gDate(hi): ws.Cells(r, 2).NumberFormat = "yyyy-mm-dd"
        best = -1E+30: bestT = 1
        For t = 1 To 4
            Erase w: w(t) = 1#
            rr = WindowReturn(w, cfg, lo, hi)
            ws.Cells(r, 2 + t).Value = rr: ws.Cells(r, 2 + t).NumberFormat = "0.000"
            If rr > best Then best = rr: bestT = t
        Next t
        ws.Cells(r, 7).Value = nm(bestT - 1)
        r = r + 1: lo = lo + STEP_BD
    Loop
    Application.ScreenUpdating = True
    ws.Columns("B:G").AutoFit
    MakeScatter ws, "Rolling 1y · winning tenor over time (encode Winner as 1-4 to plot)", 2, 3, r - 1, "I4"
    MsgBox "Rolling window written to VBA_Window (" & (r - 5) & " windows).", vbInformation
End Sub
