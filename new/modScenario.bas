Attribute VB_Name = "modScenario"
'==============================================================================
' modScenario  -  forward reinvestment-risk engine.
'
' The historical path under-states rate risk (you already know how rates moved).
' True reinvestment risk = dispersion of outcomes across plausible FUTURE curves.
' We shock the loaded curve with parallel shifts and steepener/flattener twists,
' re-run the path simulator for each strategy under each scenario, and measure
' the spread of terminal returns.  That spread is the risk axis of the forward
' frontier (return vs scenario dispersion).
'==============================================================================
Option Explicit

Private Type TScenario
    name As String
    parallel As Double      ' rate points (0.50 = +50bp)
    twist As Double         ' extra at 3M; +steepen / -flatten
End Type

Private Function Scenarios() As TScenario()
    Dim s(0 To 8) As TScenario
    s(0).name = "Base":            s(0).parallel = 0:     s(0).twist = 0
    s(1).name = "+50 parallel":    s(1).parallel = 0.5:   s(1).twist = 0
    s(2).name = "-50 parallel":    s(2).parallel = -0.5:  s(2).twist = 0
    s(3).name = "+100 parallel":   s(3).parallel = 1#:    s(3).twist = 0
    s(4).name = "-100 parallel":   s(4).parallel = -1#:   s(4).twist = 0
    s(5).name = "Steepen +50":     s(5).parallel = 0:     s(5).twist = 0.5
    s(6).name = "Flatten -50":     s(6).parallel = 0:     s(6).twist = -0.5
    s(7).name = "Bull steepen":    s(7).parallel = -0.5:  s(7).twist = 0.5
    s(8).name = "Bear flatten":    s(8).parallel = 0.5:   s(8).twist = -0.5
    Scenarios = s
End Function

Public Sub BuildScenarioFrontier()
    Dim cfg As TConfig: cfg = LoadConfig
    Dim ws As Worksheet: Set ws = EnsureSheet("VBA_Scenario")
    Dim sc() As TScenario: sc = Scenarios()
    Dim nS As Long: nS = UBound(sc) + 1
    Dim s As Long: s = cfg.GridStep
    Dim a As Long, b As Long, c As Long, d As Long, k As Long
    Dim w(1 To 4) As Double, res As TSimResult
    Dim r As Long, idx As Long
    Dim ret() As Double, baseRet As Double, m As Double, v As Double, lo As Double, hi As Double

    ReDim ret(0 To nS - 1)
    ws.Cells.Clear
    ws.Range("B2").Value = "FORWARD REINVESTMENT-RISK FRONTIER  (curve-shock scenarios)"
    ws.Range("B2").Font.Bold = True
    ws.Range("B3").Value = "Risk = std-dev of terminal annual return across " & nS & " shocked curves."
    Dim h As Variant, j As Long
    h = Array("#", "wON", "w1M", "w2M", "w3M", "BaseRet %", "MeanRet %", "Dispersion %", "Min %", "Max %")
    For j = 0 To UBound(h)
        ws.Cells(5, 2 + j).Value = h(j): ws.Cells(5, 2 + j).Font.Bold = True
    Next j

    r = 6
    Application.ScreenUpdating = False
    For a = 0 To 100 Step s
        For b = 0 To 100 - a Step s
            For c = 0 To 100 - a - b Step s
                d = 100 - a - b - c
                w(1) = a / 100#: w(2) = b / 100#: w(3) = c / 100#: w(4) = d / 100#
                m = 0: lo = 1E+30: hi = -1E+30
                For k = 0 To nS - 1
                    res = SimulateStrategy(w, cfg, sc(k).parallel, sc(k).twist)
                    ret(k) = res.annReturn
                    If k = 0 Then baseRet = res.annReturn
                    m = m + ret(k)
                    If ret(k) < lo Then lo = ret(k)
                    If ret(k) > hi Then hi = ret(k)
                Next k
                m = m / nS
                v = 0
                For k = 0 To nS - 1: v = v + (ret(k) - m) ^ 2: Next k
                v = Sqr(v / nS)
                idx = idx + 1
                ws.Cells(r, 2).Value = idx
                ws.Cells(r, 3).Value = w(1): ws.Cells(r, 4).Value = w(2)
                ws.Cells(r, 5).Value = w(3): ws.Cells(r, 6).Value = w(4)
                ws.Cells(r, 7).Value = baseRet
                ws.Cells(r, 8).Value = m
                ws.Cells(r, 9).Value = v
                ws.Cells(r, 10).Value = lo
                ws.Cells(r, 11).Value = hi
                r = r + 1
            Next c
        Next b
    Next a
    Application.ScreenUpdating = True

    ws.Range(ws.Cells(6, 3), ws.Cells(r - 1, 6)).NumberFormat = "0%"
    ws.Range(ws.Cells(6, 7), ws.Cells(r - 1, 11)).NumberFormat = "0.000"
    ws.Columns("B:K").AutoFit
    ' forward frontier: base return (y, col 7) vs dispersion (x, col 9)
    MakeScatter ws, "Forward frontier: return vs reinvestment-risk dispersion", 9, 7, r - 1, "B16"
    MsgBox "Scenario frontier built: " & idx & " strategies x " & nS & " scenarios.", vbInformation
End Sub
