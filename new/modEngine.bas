Attribute VB_Name = "modEngine"
'==============================================================================
' modEngine  -  path-accurate laddered deposit simulator.
'
' Model: $Notional split across tenors by weights w(). Each tenor runs as a
' rolling "sleeve": when a sleeve matures it is reinvested IN FULL into the same
' tenor at the then-prevailing rate (correct hold-to-maturity behaviour for
' fixed-rate deposits - no early break). Interest = P * rate/100 * calDays/basis,
' on ACTUAL calendar days between curve dates (so overnight earns weekends too).
' At most one open deposit per tenor at any time, so state is just dep(1..4).
'
' Returns daily NAV path + annualised return, WAM, and IncomeVol (the monthly
' volatility of the earned book-yield - the risk-management metric for mixes).
' Pass a worksheet in auditWs to log every cash-flow for the granular audit.
'==============================================================================
Option Explicit

Public Type TDeposit
    active As Boolean
    tenor As Long
    principal As Double
    rateLk As Double        ' locked annual rate (%)
    startIdx As Long
    matIdx As Long
End Type

Public Type TSimResult
    annReturn As Double      ' annualised total return (%)
    incomeVol As Double      ' vol of monthly change in earned book-yield (bp)
    wam As Double            ' weighted-avg maturity (days) at inception
    finalNav As Double
    nav() As Double          ' 1..gN
End Type

Public Function SimulateStrategy(w() As Double, cfg As TConfig, _
        Optional ByVal parallel As Double = 0, _
        Optional ByVal twist As Double = 0, _
        Optional auditWs As Worksheet = Nothing) As TSimResult

    Dim res As TSimResult
    Dim dep(1 To 4) As TDeposit
    Dim byld() As Double          ' daily earned book-yield (%)
    Dim i As Long, t As Long
    Dim interest As Double, proceeds As Double, accr As Double
    Dim navi As Double, tp As Double, ry As Double
    Dim aRow As Long

    ReDim res.nav(1 To gN)
    ReDim byld(1 To gN)
    If Not auditWs Is Nothing Then aRow = AuditHeader(auditWs)

    ' ---- inception (day 1): place each sleeve -------------------------------
    For t = 1 To TENORS
        If w(t) > 0.0000001 Then
            dep(t).active = True
            dep(t).tenor = t
            dep(t).principal = cfg.Notional * w(t)
            dep(t).rateLk = RateAt(1, t, ShiftFor(t, parallel, twist, cfg))
            dep(t).startIdx = 1
            dep(t).matIdx = NextMatIdx(1, cfg.CalDays(t))
            If Not auditWs Is Nothing Then _
                aRow = LogRow(auditWs, aRow, gDate(1), "PLACE", t, dep(t).principal, dep(t).rateLk, 0, 0, dep(t).principal)
        End If
        res.wam = res.wam + w(t) * cfg.CalDays(t)
    Next t

    ' ---- daily loop ----------------------------------------------------------
    For i = 1 To gN
        For t = 1 To TENORS
            If dep(t).active Then
                If dep(t).matIdx = i Then
                    interest = dep(t).principal * dep(t).rateLk / 100# * DaysBetween(dep(t).startIdx, i) / cfg.Basis
                    proceeds = dep(t).principal + interest
                    If Not auditWs Is Nothing Then _
                        aRow = LogRow(auditWs, aRow, gDate(i), "MATURE", t, dep(t).principal, dep(t).rateLk, _
                                      DaysBetween(dep(t).startIdx, i), interest, proceeds)
                    dep(t).principal = proceeds
                    dep(t).rateLk = RateAt(i, t, ShiftFor(t, parallel, twist, cfg))
                    dep(t).startIdx = i
                    dep(t).matIdx = NextMatIdx(i, cfg.CalDays(t))
                    If Not auditWs Is Nothing Then _
                        aRow = LogRow(auditWs, aRow, gDate(i), "REINVEST", t, dep(t).principal, dep(t).rateLk, 0, 0, dep(t).principal)
                End If
            End If
        Next t

        navi = 0#: tp = 0#: ry = 0#
        For t = 1 To TENORS
            If dep(t).active Then
                accr = dep(t).principal * dep(t).rateLk / 100# * DaysBetween(dep(t).startIdx, i) / cfg.Basis
                navi = navi + dep(t).principal + accr
                tp = tp + dep(t).principal
                ry = ry + dep(t).principal * dep(t).rateLk
            End If
        Next t
        res.nav(i) = navi
        If tp > 0 Then byld(i) = ry / tp
    Next i

    ' ---- summary -------------------------------------------------------------
    res.finalNav = res.nav(gN)
    res.annReturn = ((res.finalNav / cfg.Notional) ^ (cfg.AnnDays / gN) - 1#) * 100#
    res.incomeVol = MonthlyChangeVol(byld)

    If Not auditWs Is Nothing Then AuditSummary auditWs, res
    SimulateStrategy = res
End Function

' Volatility (bp) of the ~monthly change in earned book-yield. Mixes/ladders
' smooth the curve and so score lower here than a lumpy single-tenor bullet.
Private Function MonthlyChangeVol(byld() As Double) As Double
    Dim i As Long, prev As Double, havePrev As Boolean
    Dim cnt As Long, s As Double, m As Double
    Dim diffs() As Double
    ReDim diffs(1 To gN)
    For i = LBound(byld) To UBound(byld) Step 21
        If havePrev Then
            cnt = cnt + 1: diffs(cnt) = byld(i) - prev
        End If
        prev = byld(i): havePrev = True
    Next i
    If cnt < 2 Then Exit Function
    For i = 1 To cnt: m = m + diffs(i): Next i
    m = m / cnt
    For i = 1 To cnt: s = s + (diffs(i) - m) ^ 2: Next i
    MonthlyChangeVol = Sqr(s / cnt) * 100#      ' to basis points
End Function

'------------------------------- audit helpers --------------------------------
Private Function AuditHeader(ws As Worksheet) As Long
    ws.Cells.Clear
    ws.Range("B2").Value = "GRANULAR CASH-FLOW LEDGER"
    ws.Range("B2").Font.Bold = True
    Dim h As Variant, j As Long
    h = Array("Date", "Action", "Tenor", "Principal", "Rate %", "Days", "Interest", "Proceeds", "Balance")
    For j = 0 To UBound(h)
        ws.Cells(7, 2 + j).Value = h(j): ws.Cells(7, 2 + j).Font.Bold = True
    Next j
    AuditHeader = 8
End Function

Private Function LogRow(ws As Worksheet, ByVal r As Long, ByVal d As Date, ByVal act As String, _
        ByVal t As Long, ByVal prin As Double, ByVal rate As Double, ByVal cd As Double, _
        ByVal intr As Double, ByVal proc As Double) As Long
    Dim nm As Variant: nm = Array("ON", "1M", "2M", "3M")
    ws.Cells(r, 2).Value = d: ws.Cells(r, 2).NumberFormat = "yyyy-mm-dd"
    ws.Cells(r, 3).Value = act
    ws.Cells(r, 4).Value = nm(t - 1)
    ws.Cells(r, 5).Value = prin
    ws.Cells(r, 6).Value = rate
    ws.Cells(r, 7).Value = cd
    ws.Cells(r, 8).Value = intr
    ws.Cells(r, 9).Value = proc
    LogRow = r + 1
End Function

Private Sub AuditSummary(ws As Worksheet, res As TSimResult)
    ws.Range("L7").Value = "SUMMARY": ws.Range("L7").Font.Bold = True
    ws.Range("L8").Value = "Final NAV": ws.Range("M8").Value = res.finalNav
    ws.Range("L9").Value = "Ann. return %": ws.Range("M9").Value = res.annReturn
    ws.Range("L10").Value = "WAM days": ws.Range("M10").Value = res.wam
    ws.Range("L11").Value = "Income vol bp": ws.Range("M11").Value = res.incomeVol
    ws.Range("M8:M11").NumberFormat = "0.0000"
    ws.Columns("B:M").AutoFit
End Sub
