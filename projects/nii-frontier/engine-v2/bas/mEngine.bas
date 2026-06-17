Attribute VB_Name = "mEngine"
' =====================================================================
' mEngine  -  the worksheet functions you type into cells.
' This is the ONLY module that reads cells. It builds the curve, reads
' it back, and does the interest math. Every function follows the same
' shape: fetch the curve object by the name in a cell, then act on it.
'
' THE FUNCTIONS
'   BuildCurve(name, start, end, sofr, fedRange, holidayRange)
'        Builds the curve; returns "RatesCurve.name" when OK,
'        "#CURVE_ERR: reason" if something is wrong. Downstream
'        Accrue/CurveRate show #N/A if the curve cell has an error.
'   CurveRate(curveCell, date)      SOFR rate % in force on that date
'   Accrue(start, end, amount, type, curveCell)        interest, $mm
'   SwapLeg(start, end, notional, fixed, curveCell, leg)  FIXED|FLOAT|NET
'
' THE ONE RULE
'   Always pass ranges and the curve handle as CELLS (e.g. $B$6), never
'   as typed text. A cell is a precedent, so editing a holiday or a Fed
'   move rebuilds the curve and refreshes everything downstream. Typed
'   text is invisible to Excel and would go stale.
' =====================================================================
Option Explicit

' ---------------------------------------------------------------------
' Build the curve from the raw input ranges and store it by name.
' The heavy lifting (staircase + daily strip) lives in the cRatesCurve
' class; this function just passes the cell values in and parks the
' result in the registry, returning a short receipt to the cell.
' ---------------------------------------------------------------------
Public Function BuildCurve(ByVal name As String, ByVal startDate As Date, ByVal endDate As Date, _
                           ByVal sofr As Double, fedRange As Range, holidayRange As Range) As String
    On Error GoTo Failed
    Dim curve As New cRatesCurve
    curve.Init name, startDate, endDate, sofr, fedRange.Value, holidayRange.Value, _
               fedRange.Address(False, False), holidayRange.Address(False, False)
    StoreObject "RatesCurve." & name, curve
    BuildCurve = "RatesCurve." & name
    Exit Function
Failed:
    BuildCurve = "#CURVE_ERR: " & Err.Description
End Function


' ---------------------------------------------------------------------
' The point lookup for cashflow rows: the SOFR rate in force on a date.
' ---------------------------------------------------------------------
Public Function CurveRate(curveCell As Range, ByVal onDate As Date) As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then CurveRate = CVErr(xlErrNA): Exit Function
    CurveRate = curve.RateOn(onDate)
    Exit Function
Failed:
    CurveRate = CVErr(xlErrValue)
End Function

' ---------------------------------------------------------------------
' Interest over [start, end) on an amount.
'   "SIMPLE"   = add up each day's interest           (sum of rate*days/360)
'   "COMPOUND" = let interest earn interest, in arrears (the swap-float method)
' Both just read the pre-built daily strip - no day-walking here.
' ---------------------------------------------------------------------
Public Function Accrue(ByVal startDate As Date, ByVal endDate As Date, ByVal amount As Double, _
                       ByVal accrualType As String, curveCell As Range) As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then Accrue = CVErr(xlErrNA): Exit Function
    Select Case UCase$(accrualType)
        Case "SIMPLE":   Accrue = amount * curve.SimpleFactor(startDate, endDate)
        Case "COMPOUND": Accrue = amount * (curve.CompoundFactor(startDate, endDate) - 1#)
        Case Else:       Accrue = CVErr(xlErrValue)
    End Select
    Exit Function
Failed:
    Accrue = CVErr(xlErrValue)
End Function

' ---------------------------------------------------------------------
' One month (or period) of a swap. A swap has no math of its own - it is
' two Accrue-style calls and a subtraction:
'   fixed leg = notional at the fixed rate (simple)
'   float leg = notional compounded on the curve (in arrears)
'   leg = "FIXED" | "FLOAT" | "NET"   (NET = receive-fixed = fixed - float)
' ---------------------------------------------------------------------
Public Function SwapLeg(ByVal startDate As Date, ByVal endDate As Date, ByVal notional As Double, _
                        ByVal fixedRate As Double, curveCell As Range, _
                        Optional ByVal leg As String = "NET") As Variant
    On Error GoTo Failed
    Dim curve As cRatesCurve
    Set curve = FetchObject(CleanName(CStr(curveCell.Value)))
    If curve Is Nothing Then SwapLeg = CVErr(xlErrNA): Exit Function

    Dim firstDay As Date, fixedLeg As Double, floatLeg As Double
    firstDay = curve.Following(startDate)
    fixedLeg = notional * fixedRate / 100# * CLng(endDate - firstDay) / 360#
    floatLeg = notional * (curve.CompoundFactor(startDate, endDate) - 1#)

    Select Case UCase$(leg)
        Case "FIXED": SwapLeg = fixedLeg
        Case "FLOAT": SwapLeg = floatLeg
        Case "NET":   SwapLeg = fixedLeg - floatLeg
        Case Else:    SwapLeg = CVErr(xlErrValue)
    End Select
    Exit Function
Failed:
    SwapLeg = CVErr(xlErrValue)
End Function
