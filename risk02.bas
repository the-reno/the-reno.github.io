Attribute VB_Name = "risk02"
Option Explicit

' risk02.bas
' CFO presentation engine for interest-rate risk exposure.
' Source data must be in a worksheet named "Detail".
' Main macro: RunRisk02CFOAnalysis

Private Const SRC_SHEET As String = "Detail"
Private Const CLEAN_SHEET As String = "CFO_01_CleanRolls"
Private Const RATE_SHEET As String = "CFO_02_RatePanel"
Private Const VALUE_SHEET As String = "CFO_03_ValuePanel"
Private Const RETURN_SHEET As String = "CFO_04_ReturnPanel"
Private Const EXCESS_SHEET As String = "CFO_05_ExcessVsON"
Private Const RISK_SHEET As String = "CFO_06_RiskSummary"
Private Const FRONTIER_SHEET As String = "CFO_07_Frontier"
Private Const DASH_SHEET As String = "CFO_08_Dashboard"
Private Const README_SHEET As String = "CFO_00_ReadMe"

Public Sub RunRisk02CFOAnalysis()
    Dim wb As Workbook
    Dim wsD As Worksheet
    
    Set wb = ActiveWorkbook
    If Not SheetExists(wb, SRC_SHEET) Then
        MsgBox "Missing required tab: Detail", vbCritical
        Exit Sub
    End If
    
    Set wsD = wb.Worksheets(SRC_SHEET)
    
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    Application.Calculation = xlCalculationManual
    
    DeleteOutputSheets wb
    
    BuildReadMe wb
    BuildCleanRolls wb, wsD
    BuildRatePanel wb
    BuildValuePanel wb
    BuildReturnPanel wb
    BuildExcessPanel wb
    BuildRiskSummary wb
    BuildFrontier wb
    BuildDashboard wb
    
    Application.Calculation = xlCalculationAutomatic
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    
    MsgBox "risk02 CFO analysis completed.", vbInformation
End Sub

Private Sub DeleteOutputSheets(ByVal wb As Workbook)
    Dim names As Variant
    Dim i As Long
    
    names = Array(README_SHEET, CLEAN_SHEET, RATE_SHEET, VALUE_SHEET, _
                  RETURN_SHEET, EXCESS_SHEET, RISK_SHEET, _
                  FRONTIER_SHEET, DASH_SHEET)
    
    For i = LBound(names) To UBound(names)
        If SheetExists(wb, CStr(names(i))) Then
            wb.Worksheets(CStr(names(i))).Delete
        End If
    Next i
End Sub

Private Sub BuildReadMe(ByVal wb As Workbook)
    Dim ws As Worksheet
    
    Set ws = AddSheet(wb, README_SHEET)
    ws.Range("A1").Value = "risk02 CFO interest-rate risk analysis"
    ws.Range("A3").Value = "Objective"
    ws.Range("B3").Value = "Transform roll-level cash investment data into CFO-ready interest-rate risk tables and charts."
    ws.Range("A5").Value = "Source"
    ws.Range("B5").Value = "The macro reads from tab Detail. It expects roll-level fields such as tenor, dates, rate, accrual days, starting cash, interest earned, and ending cash."
    ws.Range("A7").Value = "Unbiased approach"
    ws.Range("B7").Value = "The code infers available tenors from the data and does not assume that a specific tenor should win. ON is used as benchmark only when present."
    ws.Range("A9").Value = "Important note"
    ws.Range("B9").Value = "The value panel uses realized or last matured cash values. It is not a mark-to-market valuation. A true MTM approach would require full curve revaluation for each date."
    ws.Range("A11").Value = "Main output"
    ws.Range("B11").Value = "CFO_08_Dashboard contains the presentation-ready tables, comments, and charts."
    FormatBasic ws
End Sub

Private Sub BuildCleanRolls(ByVal wb As Workbook, ByVal wsD As Worksheet)
    Dim ws As Worksheet
    Dim h As Object
    Dim r As Long
    Dim outRow As Long
    Dim lastRow As Long
    Dim cTenor As Long
    Dim cRoll As Long
    Dim cStart As Long
    Dim cRateDate As Long
    Dim cTarget As Long
    Dim cEnd As Long
    Dim cRate As Long
    Dim cDays As Long
    Dim cSC As Long
    Dim cInt As Long
    Dim cEC As Long
    Dim tenor As String
    Dim ds As Date
    Dim de As Date
    Dim rateVal As Double
    Dim daysVal As Double
    Dim sc As Double
    Dim ec As Double
    Dim it As Double
    
    Set ws = AddSheet(wb, CLEAN_SHEET)
    Set h = HeaderMap(wsD, 1)
    
    cTenor = FindCol(h, "tenor")
    cRoll = FindCol(h, "roll number", "roll_number", "roll")
    cStart = FindCol(h, "investment start date", "investment_start_date")
    cRateDate = FindCol(h, "rate date used", "rate_date_used", "rate date")
    cTarget = FindCol(h, "maturity target date", "maturity_target_date")
    cEnd = FindCol(h, "actual end date", "actual_end_date", "end date")
    cRate = FindCol(h, "rate")
    cDays = FindCol(h, "accrual days", "accrual_days", "days")
    cSC = FindCol(h, "starting cash", "starting_cash")
    cInt = FindCol(h, "interest earned", "interest_earned", "interest")
    cEC = FindCol(h, "ending cash", "ending_cash")
    
    If cTenor = 0 Or cStart = 0 Or cEnd = 0 Or cRate = 0 Then
        Err.Raise vbObjectError + 101, , "Detail tab is missing required columns."
    End If
    If cDays = 0 Or cSC = 0 Or cInt = 0 Or cEC = 0 Then
        Err.Raise vbObjectError + 102, , "Detail tab is missing cash/accrual columns."
    End If
    
    ws.Range("A1:O1").Value = Array("tenor", "roll_number", _
        "investment_start_date", "rate_date_used", "maturity_target_date", _
        "actual_end_date", "rate", "accrual_days", "starting_cash", _
        "interest_earned", "ending_cash", "roll_return", _
        "annualized_roll_return", "tenor_days", "bucket")
    
    lastRow = wsD.Cells(wsD.Rows.Count, cTenor).End(xlUp).Row
    outRow = 2
    
    For r = 2 To lastRow
        tenor = UCase$(Trim$(CStr(wsD.Cells(r, cTenor).Value)))
        If Len(tenor) > 0 Then
            ds = DateValueSafe(wsD.Cells(r, cStart).Value)
            de = DateValueSafe(wsD.Cells(r, cEnd).Value)
            rateVal = NumVal(wsD.Cells(r, cRate).Value)
            daysVal = NumVal(wsD.Cells(r, cDays).Value)
            sc = NumVal(wsD.Cells(r, cSC).Value)
            it = NumVal(wsD.Cells(r, cInt).Value)
            ec = NumVal(wsD.Cells(r, cEC).Value)
            
            If ds > 0 And de > 0 And sc > 0 And ec > 0 Then
                ws.Cells(outRow, 1).Value = tenor
                If cRoll > 0 Then ws.Cells(outRow, 2).Value = wsD.Cells(r, cRoll).Value
                ws.Cells(outRow, 3).Value = ds
                If cRateDate > 0 Then
                    ws.Cells(outRow, 4).Value = DateValueSafe(wsD.Cells(r, cRateDate).Value)
                End If
                If cTarget > 0 Then
                    ws.Cells(outRow, 5).Value = DateValueSafe(wsD.Cells(r, cTarget).Value)
                End If
                ws.Cells(outRow, 6).Value = de
                ws.Cells(outRow, 7).Value = rateVal
                ws.Cells(outRow, 8).Value = daysVal
                ws.Cells(outRow, 9).Value = sc
                ws.Cells(outRow, 10).Value = it
                ws.Cells(outRow, 11).Value = ec
                ws.Cells(outRow, 12).Value = ec / sc - 1
                If daysVal > 0 Then
                    ws.Cells(outRow, 13).Value = (1 + ec / sc - 1) ^ (365 / daysVal) - 1
                End If
                ws.Cells(outRow, 14).Value = TenorDays(tenor)
                ws.Cells(outRow, 15).Value = TenorBucket(tenor)
                outRow = outRow + 1
            End If
        End If
    Next r
    
    ws.Columns("C:F").NumberFormat = "yyyy-mm-dd"
    ws.Columns("G:G").NumberFormat = "0.0000%"
    ws.Columns("I:K").NumberFormat = "$#,##0.00"
    ws.Columns("L:M").NumberFormat = "0.0000%"
    FormatBasic ws
End Sub

Private Sub BuildRatePanel(ByVal wb As Workbook)
    Dim wsC As Worksheet
    Dim ws As Worksheet
    Dim tenors As Variant
    Dim sumD As Object
    Dim cntD As Object
    Dim minDt As Date
    Dim maxDt As Date
    Dim lastRow As Long
    Dim r As Long
    Dim i As Long
    Dim outRow As Long
    Dim m As Date
    Dim key As String
    Dim tenor As String
    Dim rateVal As Double
    
    Set wsC = wb.Worksheets(CLEAN_SHEET)
    Set ws = AddSheet(wb, RATE_SHEET)
    tenors = GetTenors(wsC)
    
    Set sumD = CreateObject("Scripting.Dictionary")
    Set cntD = CreateObject("Scripting.Dictionary")
    
    lastRow = wsC.Cells(wsC.Rows.Count, 1).End(xlUp).Row
    minDt = wsC.Cells(2, 4).Value
    maxDt = wsC.Cells(2, 4).Value
    
    For r = 2 To lastRow
        If IsDate(wsC.Cells(r, 4).Value) Then
            m = DateSerial(Year(wsC.Cells(r, 4).Value), Month(wsC.Cells(r, 4).Value), 1)
            If m < minDt Then minDt = m
            If m > maxDt Then maxDt = m
            tenor = CStr(wsC.Cells(r, 1).Value)
            key = Format$(m, "yyyymm") & "|" & tenor
            rateVal = CDbl(wsC.Cells(r, 7).Value)
            If Not sumD.Exists(key) Then
                sumD.Add key, 0#
                cntD.Add key, 0#
            End If
            sumD(key) = sumD(key) + rateVal
            cntD(key) = cntD(key) + 1#
        End If
    Next r
    
    ws.Cells(1, 1).Value = "month"
    For i = LBound(tenors) To UBound(tenors)
        ws.Cells(1, i + 2).Value = tenors(i)
    Next i
    
    outRow = 2
    m = DateSerial(Year(minDt), Month(minDt), 1)
    Do While m <= maxDt
        ws.Cells(outRow, 1).Value = WorksheetFunction.EoMonth(m, 0)
        For i = LBound(tenors) To UBound(tenors)
            key = Format$(m, "yyyymm") & "|" & CStr(tenors(i))
            If sumD.Exists(key) Then
                ws.Cells(outRow, i + 2).Value = sumD(key) / cntD(key)
            End If
        Next i
        outRow = outRow + 1
        m = DateAdd("m", 1, m)
    Loop
    
    ws.Columns("A:A").NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(outRow, UBound(tenors) + 2)).NumberFormat = "0.0000%"
    FormatBasic ws
End Sub

Private Sub BuildValuePanel(ByVal wb As Workbook)
    Dim wsC As Worksheet
    Dim ws As Worksheet
    Dim tenors As Variant
    Dim minDt As Date
    Dim maxDt As Date
    Dim m As Date
    Dim obs As Date
    Dim outRow As Long
    Dim i As Long
    
    Set wsC = wb.Worksheets(CLEAN_SHEET)
    Set ws = AddSheet(wb, VALUE_SHEET)
    tenors = GetTenors(wsC)
    
    minDt = WorksheetFunction.Min(wsC.Range("F:F"))
    maxDt = WorksheetFunction.Max(wsC.Range("F:F"))
    
    ws.Cells(1, 1).Value = "observation_date"
    For i = LBound(tenors) To UBound(tenors)
        ws.Cells(1, i + 2).Value = tenors(i)
    Next i
    
    outRow = 2
    m = DateSerial(Year(minDt), Month(minDt), 1)
    Do While m <= maxDt
        obs = WorksheetFunction.EoMonth(m, 0)
        If obs > maxDt Then obs = maxDt
        ws.Cells(outRow, 1).Value = obs
        For i = LBound(tenors) To UBound(tenors)
            ws.Cells(outRow, i + 2).Value = LastCashByDate(wsC, CStr(tenors(i)), obs)
        Next i
        outRow = outRow + 1
        m = DateAdd("m", 1, m)
    Loop
    
    ws.Columns("A:A").NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(outRow, UBound(tenors) + 2)).NumberFormat = "$#,##0.00"
    FormatBasic ws
End Sub

Private Sub BuildReturnPanel(ByVal wb As Workbook)
    Dim wsV As Worksheet
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim lastCol As Long
    Dim r As Long
    Dim c As Long
    Dim v0 As Double
    Dim v1 As Double
    
    Set wsV = wb.Worksheets(VALUE_SHEET)
    Set ws = AddSheet(wb, RETURN_SHEET)
    
    lastRow = wsV.Cells(wsV.Rows.Count, 1).End(xlUp).Row
    lastCol = wsV.Cells(1, wsV.Columns.Count).End(xlToLeft).Column
    
    ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).Value = _
        wsV.Range(wsV.Cells(1, 1), wsV.Cells(1, lastCol)).Value
    
    For r = 2 To lastRow
        ws.Cells(r, 1).Value = wsV.Cells(r, 1).Value
        For c = 2 To lastCol
            If r > 2 Then
                v0 = NumVal(wsV.Cells(r - 1, c).Value)
                v1 = NumVal(wsV.Cells(r, c).Value)
                If v0 > 0 And v1 > 0 Then
                    ws.Cells(r, c).Value = v1 / v0 - 1
                End If
            End If
        Next c
    Next r
    
    ws.Columns("A:A").NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, lastCol)).NumberFormat = "0.0000%"
    FormatBasic ws
End Sub

Private Sub BuildExcessPanel(ByVal wb As Workbook)
    Dim wsR As Worksheet
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim lastCol As Long
    Dim onCol As Long
    Dim r As Long
    Dim c As Long
    Dim outCol As Long
    Dim retVal As Double
    Dim onVal As Double
    
    Set wsR = wb.Worksheets(RETURN_SHEET)
    Set ws = AddSheet(wb, EXCESS_SHEET)
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    lastCol = wsR.Cells(1, wsR.Columns.Count).End(xlToLeft).Column
    onCol = FindHeaderInRow(wsR, "ON", 1)
    
    ws.Cells(1, 1).Value = "observation_date"
    If onCol = 0 Then
        ws.Cells(1, 2).Value = "comment"
        ws.Cells(2, 2).Value = "ON benchmark not found."
        FormatBasic ws
        Exit Sub
    End If
    
    outCol = 2
    For c = 2 To lastCol
        If c <> onCol Then
            ws.Cells(1, outCol).Value = wsR.Cells(1, c).Value & "_excess_vs_ON"
            outCol = outCol + 1
        End If
    Next c
    
    For r = 2 To lastRow
        ws.Cells(r, 1).Value = wsR.Cells(r, 1).Value
        outCol = 2
        onVal = NumVal(wsR.Cells(r, onCol).Value)
        For c = 2 To lastCol
            If c <> onCol Then
                retVal = NumVal(wsR.Cells(r, c).Value)
                If Len(wsR.Cells(r, c).Value) > 0 Then
                    If Len(wsR.Cells(r, onCol).Value) > 0 Then
                        ws.Cells(r, outCol).Value = retVal - onVal
                    End If
                End If
                outCol = outCol + 1
            End If
        Next c
    Next r
    
    ws.Columns("A:A").NumberFormat = "yyyy-mm-dd"
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, outCol)).NumberFormat = "0.0000%"
    FormatBasic ws
End Sub

Private Sub BuildRiskSummary(ByVal wb As Workbook)
    Dim wsR As Worksheet
    Dim wsV As Worksheet
    Dim wsC As Worksheet
    Dim ws As Worksheet
    Dim lastCol As Long
    Dim c As Long
    Dim outRow As Long
    Dim tenor As String
    Dim onCol As Long
    Dim annRet As Double
    Dim volVal As Double
    Dim annExc As Double
    Dim excVol As Double
    Dim irVal As Double
    Dim hit As Double
    Dim worstExc As Double
    Dim mdd As Double
    Dim wam As Double
    Dim resetVol As Double
    Dim worstReset As Double
    
    Set wsR = wb.Worksheets(RETURN_SHEET)
    Set wsV = wb.Worksheets(VALUE_SHEET)
    Set wsC = wb.Worksheets(CLEAN_SHEET)
    Set ws = AddSheet(wb, RISK_SHEET)
    
    ws.Range("A1:L1").Value = Array("tenor", "annualized_return", _
        "annualized_volatility", "annualized_excess_vs_ON", _
        "excess_volatility", "information_ratio", "hit_ratio_vs_ON", _
        "worst_month_vs_ON", "max_relative_drawdown_vs_ON", _
        "weighted_average_maturity_days", "reset_volatility", _
        "worst_reset_change")
    
    lastCol = wsR.Cells(1, wsR.Columns.Count).End(xlToLeft).Column
    onCol = FindHeaderInRow(wsR, "ON", 1)
    outRow = 2
    
    For c = 2 To lastCol
        tenor = CStr(wsR.Cells(1, c).Value)
        annRet = AnnualReturnFromValues(wsV, c)
        volVal = AnnualVolFromReturns(wsR, c)
        wam = TenorDays(tenor)
        resetVol = ResetVolatility(wsC, tenor)
        worstReset = WorstResetChange(wsC, tenor)
        
        annExc = 0
        excVol = 0
        irVal = 0
        hit = 0
        worstExc = 0
        mdd = 0
        
        If onCol > 0 And c <> onCol Then
            annExc = AnnualExcess(wsR, c, onCol)
            excVol = ExcessVol(wsR, c, onCol)
            If excVol <> 0 Then irVal = annExc / excVol
            hit = HitRatio(wsR, c, onCol)
            worstExc = WorstExcess(wsR, c, onCol)
            mdd = RelativeDrawdown(wsV, c, onCol)
        End If
        
        ws.Cells(outRow, 1).Value = tenor
        ws.Cells(outRow, 2).Value = annRet
        ws.Cells(outRow, 3).Value = volVal
        ws.Cells(outRow, 4).Value = annExc
        ws.Cells(outRow, 5).Value = excVol
        ws.Cells(outRow, 6).Value = irVal
        ws.Cells(outRow, 7).Value = hit
        ws.Cells(outRow, 8).Value = worstExc
        ws.Cells(outRow, 9).Value = mdd
        ws.Cells(outRow, 10).Value = wam
        ws.Cells(outRow, 11).Value = resetVol
        ws.Cells(outRow, 12).Value = worstReset
        outRow = outRow + 1
    Next c
    
    ws.Range("B:E").NumberFormat = "0.0000%"
    ws.Range("F:F").NumberFormat = "0.00"
    ws.Range("G:H").NumberFormat = "0.0000%"
    ws.Range("I:I").NumberFormat = "$#,##0.00"
    ws.Range("J:J").NumberFormat = "0"
    ws.Range("K:L").NumberFormat = "0.0000%"
    FormatBasic ws
End Sub

Private Sub BuildFrontier(ByVal wb As Workbook)
    Dim wsR As Worksheet
    Dim wsS As Worksheet
    Dim ws As Worksheet
    Dim tenors As Variant
    Dim n As Long
    Dim i As Long
    Dim k As Long
    Dim rowOut As Long
    Dim weights() As Double
    Dim pRet As Double
    Dim pVol As Double
    Dim pWam As Double
    Dim pExc As Double
    
    Set wsR = wb.Worksheets(RETURN_SHEET)
    Set wsS = wb.Worksheets(RISK_SHEET)
    Set ws = AddSheet(wb, FRONTIER_SHEET)
    
    tenors = GetTenorsFromHeader(wsR)
    n = UBound(tenors) - LBound(tenors) + 1
    ReDim weights(1 To n)
    
    ws.Cells(1, 1).Value = "portfolio"
    For i = 1 To n
        ws.Cells(1, i + 1).Value = "w_" & tenors(i - 1)
    Next i
    ws.Cells(1, n + 2).Value = "annualized_return"
    ws.Cells(1, n + 3).Value = "annualized_volatility"
    ws.Cells(1, n + 4).Value = "annualized_excess_vs_ON"
    ws.Cells(1, n + 5).Value = "wam_days"
    ws.Cells(1, n + 6).Value = "cfo_comment"
    
    rowOut = 2
    AddFrontierCase ws, wsR, rowOut, tenors, "Conservative", _
        Array(0.5, 0.3, 0.2, 0, 0)
    rowOut = rowOut + 1
    AddFrontierCase ws, wsR, rowOut, tenors, "Balanced ladder", _
        Array(0.25, 0.25, 0.2, 0.2, 0.1)
    rowOut = rowOut + 1
    AddFrontierCase ws, wsR, rowOut, tenors, "Yield focus", _
        Array(0.1, 0.15, 0.2, 0.35, 0.2)
    rowOut = rowOut + 1
    
    Randomize 7
    For k = 1 To 150
        RandomWeights weights
        pRet = PortfolioAnnReturn(wsR, tenors, weights)
        pVol = PortfolioAnnVol(wsR, tenors, weights)
        pWam = PortfolioWAM(tenors, weights)
        pExc = PortfolioExcess(wsR, tenors, weights)
        
        ws.Cells(rowOut, 1).Value = "Sim " & Format$(k, "000")
        For i = 1 To n
            ws.Cells(rowOut, i + 1).Value = weights(i)
        Next i
        ws.Cells(rowOut, n + 2).Value = pRet
        ws.Cells(rowOut, n + 3).Value = pVol
        ws.Cells(rowOut, n + 4).Value = pExc
        ws.Cells(rowOut, n + 5).Value = pWam
        ws.Cells(rowOut, n + 6).Value = FrontierComment(pExc, pVol, pWam)
        rowOut = rowOut + 1
    Next k
    
    ws.Range(ws.Cells(2, 2), ws.Cells(rowOut, n + 4)).NumberFormat = "0.0000%"
    ws.Range(ws.Cells(2, n + 5), ws.Cells(rowOut, n + 5)).NumberFormat = "0"
    FormatBasic ws
End Sub

Private Sub AddFrontierCase(ByVal ws As Worksheet, ByVal wsR As Worksheet, _
    ByVal rowOut As Long, ByVal tenors As Variant, ByVal nameVal As String, _
    ByVal wIn As Variant)
    
    Dim n As Long
    Dim i As Long
    Dim weights() As Double
    
    n = UBound(tenors) - LBound(tenors) + 1
    ReDim weights(1 To n)
    
    For i = 1 To n
        If i - 1 <= UBound(wIn) Then
            weights(i) = CDbl(wIn(i - 1))
        Else
            weights(i) = 0#
        End If
    Next i
    NormalizeWeights weights
    
    ws.Cells(rowOut, 1).Value = nameVal
    For i = 1 To n
        ws.Cells(rowOut, i + 1).Value = weights(i)
    Next i
    ws.Cells(rowOut, n + 2).Value = PortfolioAnnReturn(wsR, tenors, weights)
    ws.Cells(rowOut, n + 3).Value = PortfolioAnnVol(wsR, tenors, weights)
    ws.Cells(rowOut, n + 4).Value = PortfolioExcess(wsR, tenors, weights)
    ws.Cells(rowOut, n + 5).Value = PortfolioWAM(tenors, weights)
    ws.Cells(rowOut, n + 6).Value = FrontierComment(ws.Cells(rowOut, n + 4).Value, _
        ws.Cells(rowOut, n + 3).Value, ws.Cells(rowOut, n + 5).Value)
End Sub

Private Sub BuildDashboard(ByVal wb As Workbook)
    Dim ws As Worksheet
    Dim wsRisk As Worksheet
    Dim wsFront As Worksheet
    Dim lastRisk As Long
    Dim lastFront As Long
    
    Set ws = AddSheet(wb, DASH_SHEET)
    Set wsRisk = wb.Worksheets(RISK_SHEET)
    Set wsFront = wb.Worksheets(FRONTIER_SHEET)
    
    ws.Range("A1").Value = "CFO dashboard - interest-rate risk exposure"
    ws.Range("A3").Value = "Executive framing"
    ws.Range("B3").Value = "The analysis compares rolling cash strategies as interest-rate exposures, not as a single return ranking."
    ws.Range("A4").Value = "Benchmark"
    ws.Range("B4").Value = "ON is treated as the neutral cash benchmark when available."
    ws.Range("A5").Value = "Risk lens"
    ws.Range("B5").Value = "The key metrics are excess carry, excess volatility, hit ratio, reset risk, WAM, and liquidity-constrained frontier."
    ws.Range("A6").Value = "CFO use"
    ws.Range("B6").Value = "Use the charts below to decide the allocation range, liquidity reserve, and maximum maturity exposure."
    
    ws.Range("A8").Value = "Risk summary"
    lastRisk = wsRisk.Cells(wsRisk.Rows.Count, 1).End(xlUp).Row
    wsRisk.Range("A1:L" & lastRisk).Copy ws.Range("A9")
    
    ws.Range("N8").Value = "Frontier sample"
    lastFront = WorksheetFunction.Min(25, wsFront.Cells(wsFront.Rows.Count, 1).End(xlUp).Row)
    wsFront.Range("A1:H" & lastFront).Copy ws.Range("N9")
    
    FormatBasic ws
    AddCFOCharts wb, ws
End Sub

Private Sub AddCFOCharts(ByVal wb As Workbook, ByVal wsDash As Worksheet)
    Dim wsRate As Worksheet
    Dim wsValue As Worksheet
    Dim wsRisk As Worksheet
    Dim wsFront As Worksheet
    
    Set wsRate = wb.Worksheets(RATE_SHEET)
    Set wsValue = wb.Worksheets(VALUE_SHEET)
    Set wsRisk = wb.Worksheets(RISK_SHEET)
    Set wsFront = wb.Worksheets(FRONTIER_SHEET)
    
    AddLineChart wsDash, wsRate, "Historical rate panel", 20, 360, 620, 260
    AddLineChart wsDash, wsValue, "Cash value by strategy", 660, 360, 620, 260
    AddRiskBarChart wsDash, wsRisk, "Risk summary by tenor", 20, 650, 620, 260
    AddFrontierChart wsDash, wsFront, "Efficient frontier sample", 660, 650, 620, 260
End Sub

Private Sub AddLineChart(ByVal wsDash As Worksheet, ByVal wsData As Worksheet, _
    ByVal titleText As String, ByVal x As Double, ByVal y As Double, _
    ByVal w As Double, ByVal h As Double)
    
    Dim co As ChartObject
    Dim lastRow As Long
    Dim lastCol As Long
    Dim rng As Range
    
    lastRow = wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row
    lastCol = wsData.Cells(1, wsData.Columns.Count).End(xlToLeft).Column
    Set rng = wsData.Range(wsData.Cells(1, 1), wsData.Cells(lastRow, lastCol))
    
    Set co = wsDash.ChartObjects.Add(x, y, w, h)
    co.Chart.ChartType = xlLine
    co.Chart.SetSourceData rng
    co.Chart.HasTitle = True
    co.Chart.ChartTitle.Text = titleText
    co.Chart.Legend.Position = xlLegendPositionBottom
End Sub

Private Sub AddRiskBarChart(ByVal wsDash As Worksheet, ByVal wsRisk As Worksheet, _
    ByVal titleText As String, ByVal x As Double, ByVal y As Double, _
    ByVal w As Double, ByVal h As Double)
    
    Dim co As ChartObject
    Dim lastRow As Long
    Dim rng As Range
    
    lastRow = wsRisk.Cells(wsRisk.Rows.Count, 1).End(xlUp).Row
    Set rng = Union(wsRisk.Range("A1:A" & lastRow), _
        wsRisk.Range("B1:D" & lastRow), wsRisk.Range("J1:J" & lastRow))
    
    Set co = wsDash.ChartObjects.Add(x, y, w, h)
    co.Chart.ChartType = xlColumnClustered
    co.Chart.SetSourceData rng
    co.Chart.HasTitle = True
    co.Chart.ChartTitle.Text = titleText
    co.Chart.Legend.Position = xlLegendPositionBottom
End Sub

Private Sub AddFrontierChart(ByVal wsDash As Worksheet, ByVal wsFront As Worksheet, _
    ByVal titleText As String, ByVal x As Double, ByVal y As Double, _
    ByVal w As Double, ByVal h As Double)
    
    Dim co As ChartObject
    Dim lastRow As Long
    Dim xCol As Long
    Dim yCol As Long
    
    lastRow = wsFront.Cells(wsFront.Rows.Count, 1).End(xlUp).Row
    xCol = FindHeaderInRow(wsFront, "annualized_volatility", 1)
    yCol = FindHeaderInRow(wsFront, "annualized_return", 1)
    
    Set co = wsDash.ChartObjects.Add(x, y, w, h)
    co.Chart.ChartType = xlXYScatter
    co.Chart.SeriesCollection.NewSeries
    co.Chart.SeriesCollection(1).XValues = wsFront.Range(wsFront.Cells(2, xCol), wsFront.Cells(lastRow, xCol))
    co.Chart.SeriesCollection(1).Values = wsFront.Range(wsFront.Cells(2, yCol), wsFront.Cells(lastRow, yCol))
    co.Chart.SeriesCollection(1).Name = "Portfolios"
    co.Chart.HasTitle = True
    co.Chart.ChartTitle.Text = titleText
    co.Chart.Legend.Position = xlLegendPositionBottom
End Sub

Private Function HeaderMap(ByVal ws As Worksheet, ByVal hRow As Long) As Object
    Dim d As Object
    Dim lastCol As Long
    Dim c As Long
    Dim k As String
    
    Set d = CreateObject("Scripting.Dictionary")
    lastCol = ws.Cells(hRow, ws.Columns.Count).End(xlToLeft).Column
    
    For c = 1 To lastCol
        k = NormHeader(CStr(ws.Cells(hRow, c).Value))
        If Len(k) > 0 Then
            If Not d.Exists(k) Then d.Add k, c
        End If
    Next c
    
    Set HeaderMap = d
End Function

Private Function FindCol(ByVal h As Object, ParamArray names() As Variant) As Long
    Dim i As Long
    Dim k As String
    
    For i = LBound(names) To UBound(names)
        k = NormHeader(CStr(names(i)))
        If h.Exists(k) Then
            FindCol = CLng(h(k))
            Exit Function
        End If
    Next i
    FindCol = 0
End Function

Private Function NormHeader(ByVal s As String) As String
    s = LCase$(Trim$(s))
    s = Replace(s, " ", "")
    s = Replace(s, "_", "")
    s = Replace(s, "-", "")
    s = Replace(s, "/", "")
    NormHeader = s
End Function

Private Function NumVal(ByVal v As Variant) As Double
    Dim s As String
    
    If IsError(v) Or IsEmpty(v) Then
        NumVal = 0#
        Exit Function
    End If
    If IsNumeric(v) Then
        NumVal = CDbl(v)
        Exit Function
    End If
    
    s = CStr(v)
    s = Replace(s, "$", "")
    s = Replace(s, ",", "")
    s = Replace(s, "%", "")
    s = Trim$(s)
    
    If Len(s) = 0 Then
        NumVal = 0#
    ElseIf IsNumeric(s) Then
        NumVal = CDbl(s)
        If InStr(1, CStr(v), "%") > 0 Then NumVal = NumVal / 100#
    Else
        NumVal = 0#
    End If
End Function

Private Function DateValueSafe(ByVal v As Variant) As Date
    If IsDate(v) Then
        DateValueSafe = CDate(v)
    Else
        DateValueSafe = 0
    End If
End Function

Private Function TenorDays(ByVal tenor As String) As Long
    Dim s As String
    
    s = UCase$(Trim$(tenor))
    If s = "ON" Or s = "O/N" Then
        TenorDays = 1
    ElseIf InStr(s, "1M") > 0 Then
        TenorDays = 30
    ElseIf InStr(s, "2M") > 0 Then
        TenorDays = 60
    ElseIf InStr(s, "3M") > 0 Then
        TenorDays = 90
    ElseIf InStr(s, "6M") > 0 Then
        TenorDays = 180
    Else
        TenorDays = 0
    End If
End Function

Private Function TenorBucket(ByVal tenor As String) As String
    Dim d As Long
    
    d = TenorDays(tenor)
    If d <= 1 Then
        TenorBucket = "Immediate"
    ElseIf d <= 35 Then
        TenorBucket = "Short"
    ElseIf d <= 95 Then
        TenorBucket = "Medium"
    Else
        TenorBucket = "Long"
    End If
End Function

Private Function SheetExists(ByVal wb As Workbook, ByVal nameVal As String) As Boolean
    Dim ws As Worksheet
    
    On Error Resume Next
    Set ws = wb.Worksheets(nameVal)
    SheetExists = Not ws Is Nothing
    On Error GoTo 0
End Function

Private Function AddSheet(ByVal wb As Workbook, ByVal nameVal As String) As Worksheet
    Dim ws As Worksheet
    
    Set ws = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
    ws.Name = nameVal
    Set AddSheet = ws
End Function

Private Sub FormatBasic(ByVal ws As Worksheet)
    With ws.Rows(1)
        .Font.Bold = True
        .Interior.Color = RGB(222, 235, 247)
    End With
    ws.Columns.AutoFit
    ws.Activate
    ws.Range("A1").Select
End Sub

Private Function GetTenors(ByVal ws As Worksheet) As Variant
    Dim d As Object
    Dim lastRow As Long
    Dim r As Long
    Dim t As String
    
    Set d = CreateObject("Scripting.Dictionary")
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        t = CStr(ws.Cells(r, 1).Value)
        If Len(t) > 0 Then
            If Not d.Exists(t) Then d.Add t, t
        End If
    Next r
    
    GetTenors = SortTenorArray(d.Keys)
End Function

Private Function GetTenorsFromHeader(ByVal ws As Worksheet) As Variant
    Dim lastCol As Long
    Dim arr() As String
    Dim c As Long
    
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    ReDim arr(0 To lastCol - 2)
    
    For c = 2 To lastCol
        arr(c - 2) = CStr(ws.Cells(1, c).Value)
    Next c
    
    GetTenorsFromHeader = SortTenorArray(arr)
End Function

Private Function SortTenorArray(ByVal arr As Variant) As Variant
    Dim i As Long
    Dim j As Long
    Dim tmp As String
    Dim out() As String
    
    ReDim out(LBound(arr) To UBound(arr))
    For i = LBound(arr) To UBound(arr)
        out(i) = CStr(arr(i))
    Next i
    
    For i = LBound(out) To UBound(out) - 1
        For j = i + 1 To UBound(out)
            If TenorSortKey(out(j)) < TenorSortKey(out(i)) Then
                tmp = out(i)
                out(i) = out(j)
                out(j) = tmp
            End If
        Next j
    Next i
    
    SortTenorArray = out
End Function

Private Function TenorSortKey(ByVal t As String) As Long
    Dim d As Long
    
    d = TenorDays(t)
    If d = 0 Then d = 9999
    TenorSortKey = d
End Function

Private Function LastCashByDate(ByVal wsC As Worksheet, ByVal tenor As String, _
    ByVal obs As Date) As Variant
    
    Dim lastRow As Long
    Dim r As Long
    Dim bestDate As Date
    Dim bestCash As Double
    Dim d As Date
    
    lastRow = wsC.Cells(wsC.Rows.Count, 1).End(xlUp).Row
    bestDate = 0
    bestCash = 0
    
    For r = 2 To lastRow
        If CStr(wsC.Cells(r, 1).Value) = tenor Then
            d = wsC.Cells(r, 6).Value
            If d <= obs And d >= bestDate Then
                bestDate = d
                bestCash = NumVal(wsC.Cells(r, 11).Value)
            End If
        End If
    Next r
    
    If bestCash > 0 Then
        LastCashByDate = bestCash
    Else
        LastCashByDate = Empty
    End If
End Function

Private Function FindHeaderInRow(ByVal ws As Worksheet, ByVal textVal As String, _
    ByVal rowVal As Long) As Long
    
    Dim lastCol As Long
    Dim c As Long
    
    lastCol = ws.Cells(rowVal, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastCol
        If UCase$(Trim$(CStr(ws.Cells(rowVal, c).Value))) = UCase$(textVal) Then
            FindHeaderInRow = c
            Exit Function
        End If
    Next c
    FindHeaderInRow = 0
End Function

Private Function AnnualReturnFromValues(ByVal wsV As Worksheet, ByVal c As Long) As Double
    Dim lastRow As Long
    Dim r1 As Long
    Dim r2 As Long
    Dim v1 As Double
    Dim v2 As Double
    Dim d1 As Date
    Dim d2 As Date
    Dim r As Long
    
    lastRow = wsV.Cells(wsV.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        If NumVal(wsV.Cells(r, c).Value) > 0 Then
            r1 = r
            Exit For
        End If
    Next r
    
    For r = lastRow To 2 Step -1
        If NumVal(wsV.Cells(r, c).Value) > 0 Then
            r2 = r
            Exit For
        End If
    Next r
    
    If r1 = 0 Or r2 = 0 Or r1 = r2 Then Exit Function
    
    v1 = NumVal(wsV.Cells(r1, c).Value)
    v2 = NumVal(wsV.Cells(r2, c).Value)
    d1 = wsV.Cells(r1, 1).Value
    d2 = wsV.Cells(r2, 1).Value
    
    If v1 > 0 And v2 > 0 And d2 > d1 Then
        AnnualReturnFromValues = (v2 / v1) ^ (365 / (d2 - d1)) - 1
    End If
End Function

Private Function AnnualVolFromReturns(ByVal wsR As Worksheet, ByVal c As Long) As Double
    AnnualVolFromReturns = StdFromColumn(wsR, c) * Sqr(12)
End Function

Private Function StdFromColumn(ByVal ws As Worksheet, ByVal c As Long) As Double
    Dim vals() As Double
    Dim n As Long
    Dim r As Long
    Dim lastRow As Long
    
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    ReDim vals(1 To lastRow)
    
    For r = 2 To lastRow
        If Len(ws.Cells(r, c).Value) > 0 Then
            n = n + 1
            vals(n) = NumVal(ws.Cells(r, c).Value)
        End If
    Next r
    
    StdFromColumn = StdArray(vals, n)
End Function

Private Function AnnualExcess(ByVal wsR As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    AnnualExcess = AvgExcess(wsR, c, onCol) * 12
End Function

Private Function ExcessVol(ByVal wsR As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    Dim vals() As Double
    Dim n As Long
    Dim r As Long
    Dim lastRow As Long
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    ReDim vals(1 To lastRow)
    
    For r = 2 To lastRow
        If Len(wsR.Cells(r, c).Value) > 0 Then
            If Len(wsR.Cells(r, onCol).Value) > 0 Then
                n = n + 1
                vals(n) = NumVal(wsR.Cells(r, c).Value) - NumVal(wsR.Cells(r, onCol).Value)
            End If
        End If
    Next r
    
    ExcessVol = StdArray(vals, n) * Sqr(12)
End Function

Private Function AvgExcess(ByVal wsR As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    Dim n As Long
    Dim r As Long
    Dim s As Double
    Dim lastRow As Long
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        If Len(wsR.Cells(r, c).Value) > 0 Then
            If Len(wsR.Cells(r, onCol).Value) > 0 Then
                s = s + NumVal(wsR.Cells(r, c).Value) - NumVal(wsR.Cells(r, onCol).Value)
                n = n + 1
            End If
        End If
    Next r
    
    If n > 0 Then AvgExcess = s / n
End Function

Private Function HitRatio(ByVal wsR As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    Dim n As Long
    Dim hit As Long
    Dim r As Long
    Dim lastRow As Long
    Dim e As Double
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        If Len(wsR.Cells(r, c).Value) > 0 Then
            If Len(wsR.Cells(r, onCol).Value) > 0 Then
                e = NumVal(wsR.Cells(r, c).Value) - NumVal(wsR.Cells(r, onCol).Value)
                If e > 0 Then hit = hit + 1
                n = n + 1
            End If
        End If
    Next r
    
    If n > 0 Then HitRatio = hit / n
End Function

Private Function WorstExcess(ByVal wsR As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    Dim r As Long
    Dim lastRow As Long
    Dim e As Double
    Dim first As Boolean
    
    first = True
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        If Len(wsR.Cells(r, c).Value) > 0 Then
            If Len(wsR.Cells(r, onCol).Value) > 0 Then
                e = NumVal(wsR.Cells(r, c).Value) - NumVal(wsR.Cells(r, onCol).Value)
                If first Then
                    WorstExcess = e
                    first = False
                ElseIf e < WorstExcess Then
                    WorstExcess = e
                End If
            End If
        End If
    Next r
End Function

Private Function RelativeDrawdown(ByVal wsV As Worksheet, ByVal c As Long, _
    ByVal onCol As Long) As Double
    
    Dim r As Long
    Dim lastRow As Long
    Dim rel As Double
    Dim peak As Double
    Dim dd As Double
    Dim first As Boolean
    
    first = True
    lastRow = wsV.Cells(wsV.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        If NumVal(wsV.Cells(r, c).Value) > 0 Then
            If NumVal(wsV.Cells(r, onCol).Value) > 0 Then
                rel = NumVal(wsV.Cells(r, c).Value) - NumVal(wsV.Cells(r, onCol).Value)
                If first Then
                    peak = rel
                    first = False
                End If
                If rel > peak Then peak = rel
                dd = rel - peak
                If dd < RelativeDrawdown Then RelativeDrawdown = dd
            End If
        End If
    Next r
End Function

Private Function ResetVolatility(ByVal wsC As Worksheet, ByVal tenor As String) As Double
    Dim vals() As Double
    Dim n As Long
    Dim r As Long
    Dim lastRow As Long
    Dim prevRate As Double
    Dim rateVal As Double
    Dim hasPrev As Boolean
    
    lastRow = wsC.Cells(wsC.Rows.Count, 1).End(xlUp).Row
    ReDim vals(1 To lastRow)
    
    For r = 2 To lastRow
        If CStr(wsC.Cells(r, 1).Value) = tenor Then
            rateVal = NumVal(wsC.Cells(r, 7).Value)
            If hasPrev Then
                n = n + 1
                vals(n) = rateVal - prevRate
            End If
            prevRate = rateVal
            hasPrev = True
        End If
    Next r
    
    ResetVolatility = StdArray(vals, n)
End Function

Private Function WorstResetChange(ByVal wsC As Worksheet, ByVal tenor As String) As Double
    Dim r As Long
    Dim lastRow As Long
    Dim prevRate As Double
    Dim rateVal As Double
    Dim chg As Double
    Dim hasPrev As Boolean
    Dim first As Boolean
    
    first = True
    lastRow = wsC.Cells(wsC.Rows.Count, 1).End(xlUp).Row
    
    For r = 2 To lastRow
        If CStr(wsC.Cells(r, 1).Value) = tenor Then
            rateVal = NumVal(wsC.Cells(r, 7).Value)
            If hasPrev Then
                chg = rateVal - prevRate
                If first Then
                    WorstResetChange = chg
                    first = False
                ElseIf chg < WorstResetChange Then
                    WorstResetChange = chg
                End If
            End If
            prevRate = rateVal
            hasPrev = True
        End If
    Next r
End Function

Private Function StdArray(ByRef vals() As Double, ByVal n As Long) As Double
    Dim i As Long
    Dim avg As Double
    Dim ss As Double
    
    If n <= 1 Then Exit Function
    
    For i = 1 To n
        avg = avg + vals(i)
    Next i
    avg = avg / n
    
    For i = 1 To n
        ss = ss + (vals(i) - avg) ^ 2
    Next i
    
    StdArray = Sqr(ss / (n - 1))
End Function

Private Sub RandomWeights(ByRef weights() As Double)
    Dim i As Long
    Dim s As Double
    
    For i = LBound(weights) To UBound(weights)
        weights(i) = Rnd()
        s = s + weights(i)
    Next i
    
    If s = 0 Then s = 1
    For i = LBound(weights) To UBound(weights)
        weights(i) = weights(i) / s
    Next i
End Sub

Private Sub NormalizeWeights(ByRef weights() As Double)
    Dim i As Long
    Dim s As Double
    
    For i = LBound(weights) To UBound(weights)
        s = s + weights(i)
    Next i
    If s = 0 Then s = 1
    
    For i = LBound(weights) To UBound(weights)
        weights(i) = weights(i) / s
    Next i
End Sub

Private Function PortfolioMonthlySeries(ByVal wsR As Worksheet, ByVal tenors As Variant, _
    ByRef weights() As Double, ByRef vals() As Double) As Long
    
    Dim lastRow As Long
    Dim r As Long
    Dim i As Long
    Dim c As Long
    Dim p As Double
    Dim ok As Boolean
    Dim n As Long
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    ReDim vals(1 To lastRow)
    
    For r = 2 To lastRow
        p = 0
        ok = True
        For i = LBound(tenors) To UBound(tenors)
            c = FindHeaderInRow(wsR, CStr(tenors(i)), 1)
            If c = 0 Or Len(wsR.Cells(r, c).Value) = 0 Then
                ok = False
            Else
                p = p + weights(i + 1) * NumVal(wsR.Cells(r, c).Value)
            End If
        Next i
        If ok Then
            n = n + 1
            vals(n) = p
        End If
    Next r
    
    PortfolioMonthlySeries = n
End Function

Private Function PortfolioAnnReturn(ByVal wsR As Worksheet, ByVal tenors As Variant, _
    ByRef weights() As Double) As Double
    
    Dim vals() As Double
    Dim n As Long
    Dim i As Long
    Dim avg As Double
    
    n = PortfolioMonthlySeries(wsR, tenors, weights, vals)
    If n = 0 Then Exit Function
    
    For i = 1 To n
        avg = avg + vals(i)
    Next i
    
    PortfolioAnnReturn = avg / n * 12
End Function

Private Function PortfolioAnnVol(ByVal wsR As Worksheet, ByVal tenors As Variant, _
    ByRef weights() As Double) As Double
    
    Dim vals() As Double
    Dim n As Long
    
    n = PortfolioMonthlySeries(wsR, tenors, weights, vals)
    PortfolioAnnVol = StdArray(vals, n) * Sqr(12)
End Function

Private Function PortfolioExcess(ByVal wsR As Worksheet, ByVal tenors As Variant, _
    ByRef weights() As Double) As Double
    
    Dim retVal As Double
    Dim onCol As Long
    Dim onAnn As Double
    
    retVal = PortfolioAnnReturn(wsR, tenors, weights)
    onCol = FindHeaderInRow(wsR, "ON", 1)
    If onCol > 0 Then
        onAnn = AvgReturnCol(wsR, onCol) * 12
        PortfolioExcess = retVal - onAnn
    End If
End Function

Private Function AvgReturnCol(ByVal wsR As Worksheet, ByVal c As Long) As Double
    Dim r As Long
    Dim n As Long
    Dim s As Double
    Dim lastRow As Long
    
    lastRow = wsR.Cells(wsR.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        If Len(wsR.Cells(r, c).Value) > 0 Then
            s = s + NumVal(wsR.Cells(r, c).Value)
            n = n + 1
        End If
    Next r
    If n > 0 Then AvgReturnCol = s / n
End Function

Private Function PortfolioWAM(ByVal tenors As Variant, ByRef weights() As Double) As Double
    Dim i As Long
    
    For i = LBound(tenors) To UBound(tenors)
        PortfolioWAM = PortfolioWAM + weights(i + 1) * TenorDays(CStr(tenors(i)))
    Next i
End Function

Private Function FrontierComment(ByVal exc As Double, ByVal vol As Double, _
    ByVal wam As Double) As String
    
    If wam <= 45 Then
        FrontierComment = "High liquidity profile; use as cash buffer reference."
    ElseIf wam <= 90 Then
        FrontierComment = "Balanced WAM; useful CFO comparison zone."
    Else
        FrontierComment = "Longer liquidity lockup; requires explicit limit."
    End If
    
    If exc < 0 Then
        FrontierComment = FrontierComment & " Excess carry is negative in history."
    Else
        FrontierComment = FrontierComment & " Excess carry is positive in history."
    End If
End Function
