Attribute VB_Name = "mEngine"
' =====================================================================
' mEngine  -  the worksheet functions you type into cells.
' This is the ONLY module that reads cells. It builds the curve, reads
' it back, and does the interest math. Every function follows the same
' shape: fetch the curve object by the name in a cell, then act on it.
'
' THE FUNCTIONS
'   RBuildCurve(name, start, end, sofr, fedRange, holidayRange)
'        Builds the curve; returns "RatesCurve.name" when OK,
'        "#CURVE_ERR: reason" if something is wrong. Downstream
'        RAccrue/RCurveRate show #N/A if the curve cell has an error.
'   RCurveRate(curveCell, date)      SOFR rate % in force on that date
'   RAccrue(start, end, amount, type, curveCell)        interest $mm
'   RSwapLeg(start, end, notional, fixed, curveCell, leg)  FIXED|FLOAT|NET
'
' THE ONE RULE
'   Always pass ranges and the curve handle as CELLS (e.g. $B$6), never
'   as typed text. A cell is a precedent, so editing a holiday or a Fed
'   move rebuilds the curve and refreshes everything downstream. Typed
'   text is invisible to Excel and would go stale.
' =====================================================================
Option Explicit

' ---------------------------------------------------------------------
' RBuildCurve: validate inputs, build the curve, store it by name.
' Returns "RatesCurve.name" on success, "#CURVE_ERR: reason" on any
' problem - so errors are visible at the builder cell and cascade as
' #N/A in every downstream formula that references this cell.
' ---------------------------------------------------------------------
Public Function RBuildCurve(ByVal name As String, _
                            ByVal startDate As Date, ByVal endDate As Date, _
                            ByVal sofr As Double, _
                            fedRange As Range, holidayRange As Range) As String
    On Error GoTo Failed

    ' 1. Horizon check
    If endDate <= startDate Then
        RBuildCurve = "#CURVE_ERR: end date must be after start date"
        Exit Function
    End If

    ' 2. Validate scenario range row by row.
    '    Column 1 = meeting date (must be date or numeric serial, not text).
    '    Column 2 = move bps    (must be numeric, not text).
    '    Completely blank rows are skipped silently (they mean "no meeting here").
    '    Any text value in a non-blank row is an error - never silent.
    Dim scenData As Variant
    scenData = fedRange.Value
    Dim r As Long, v1 As Variant, v2 As Variant
    For r = LBound(scenData, 1) To UBound(scenData, 1)
        v1 = scenData(r, 1)
        v2 = scenData(r, 2)
        If v1 = "" And v2 = "" Then GoTo SkipRow    ' blank row - OK
        If Not (IsDate(v1) Or IsNumeric(v1)) Or v1 = "" Then
            RBuildCurve = "#CURVE_ERR: scenario row " & r & _
                          " date is not valid (got: " & CStr(v1) & ")"
            Exit Function
        End If
        If Not IsNumeric(v2) Then
            RBuildCurve = "#CURVE_ERR: scenario row " & r & _
                          " move is not numeric (got: " & CStr(v2) & ")"
            Exit Function
        End If
SkipRow:
    Next r

    ' 3. Build the curve (Init sorts moves by date and strips the daily table)
    Dim curve As New cRatesCurve
    curve.Init name, startDate, endDate, sofr, _
               scenData, holidayRange.Value, _
               fedRange.Address(False, False), holidayRange.Address(False, False)
    StoreObject "RatesCurve." & name, curve
    RBuildCurve = "RatesCurve." & name
    Exit Function
Failed:
    RBuildCurve = "#CURVE_ERR: " & Err.Description
End Function

' ---------------------------------------------------------------------
' RCurveRate: the SOFR rate in force on a single date.
' Date must be within the curve range - any date outside returns a
' clear error string. Never silently returns a rate for a bad date.
' ---------------------------------------------------------------------
Public Function RCurveRate(curveCell As Range, ByVal onDate As Variant) As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then RCurveRate = CVErr(xlErrNA): Exit Function
    If Not IsDate(onDate) And Not IsNumeric(onDate) Then
        RCurveRate = "#RATE_ERR: invalid date"
        Exit Function
    End If
    Dim d As Date
    d = CDate(onDate)
    ' Date must be within the curve range. Any date outside returns an error.
    If Not curve.IsInRange(d) Then
        RCurveRate = "#RATE_ERR: " & Format(d, "yyyy-mm-dd") & _
                     " not in curve range " & Format(curve.StartDate, "yyyy-mm-dd") & _
                     " to " & Format(curve.EndDate, "yyyy-mm-dd")
    Else
        RCurveRate = curve.RateOn(d)
    End If
    Exit Function
Failed:
    RCurveRate = CVErr(xlErrValue)
End Function

' ---------------------------------------------------------------------
' RAccrue: interest over [start, end) on an amount.
'   "SIMPLE"   = sum of each day's rate*days/360 (no compounding)
'   "COMPOUND" = SOFR in-arrears: interest earns interest daily
' Both read the pre-built daily strip - no day-walking at call time.
' ---------------------------------------------------------------------
Public Function RAccrue(ByVal startDate As Date, ByVal endDate As Date, _
                        ByVal amount As Double, ByVal accrualType As String, _
                        curveCell As Range) As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then RAccrue = CVErr(xlErrNA): Exit Function
    Select Case UCase$(accrualType)
        Case "SIMPLE":   RAccrue = amount * curve.SimpleFactor(startDate, endDate)
        Case "COMPOUND": RAccrue = amount * (curve.CompoundFactor(startDate, endDate) - 1#)
        Case Else:       RAccrue = CVErr(xlErrValue)
    End Select
    Exit Function
Failed:
    RAccrue = CVErr(xlErrValue)
End Function

' ---------------------------------------------------------------------
' RSwapLeg: one period of a swap. No math of its own - two RAccrue-style
' calls and a subtraction:
'   fixed leg = notional * fixedRate * days/360  (simple, constant rate)
'   float leg = notional * (CompoundFactor - 1)  (in-arrears on the curve)
'   leg = "FIXED" | "FLOAT" | "NET"  (NET = receive-fixed = fixed - float)
' ---------------------------------------------------------------------
Public Function RSwapLeg(ByVal startDate As Date, ByVal endDate As Date, _
                         ByVal notional As Double, ByVal fixedRate As Double, _
                         curveCell As Range, _
                         Optional ByVal leg As String = "NET") As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then RSwapLeg = CVErr(xlErrNA): Exit Function
    Dim firstDay As Date, fixedLeg As Double, floatLeg As Double
    firstDay  = curve.Following(startDate)
    fixedLeg  = notional * fixedRate / 100# * CLng(endDate - firstDay) / 360#
    floatLeg  = notional * (curve.CompoundFactor(startDate, endDate) - 1#)
    Select Case UCase$(leg)
        Case "FIXED": RSwapLeg = fixedLeg
        Case "FLOAT": RSwapLeg = floatLeg
        Case "NET":   RSwapLeg = fixedLeg - floatLeg
        Case Else:    RSwapLeg = CVErr(xlErrValue)
    End Select
    Exit Function
Failed:
    RSwapLeg = CVErr(xlErrValue)
End Function
