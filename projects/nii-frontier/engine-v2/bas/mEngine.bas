Attribute VB_Name = "mEngine"
' =====================================================================
' mEngine - the worksheet functions (the only module that reads cells).
'
'   =RatesCurve(name, start, end, sofr, scenRange, holRange)
'        builds ONE named curve directly from the input ranges, stores
'        its provenance + daily strip -> "RatesCurve.NAME | OK | ..."
'   =GET(curveCell)        spills the curve: provenance header + the daily
'                          table (date | rate% | dayFactor | accumFactor)
'   =ACCRUE(start, end, amount, type, curveCell)        interest $mm
'   =SWAP(start, end, notional, fixed, curveCell, leg)  FIXED|FLOAT|NET
'
' RULE: pass scenRange / holRange / curveCell as CELLS or RANGES, never as
' typed text - so edits to holidays or moves cascade through the chain.
' =====================================================================
Option Explicit

Public Function RatesCurve(ByVal name As String, ByVal startD As Date, ByVal endD As Date, _
                           ByVal sofr As Double, scenRange As Range, holRange As Range) As String
    On Error GoTo bad
    Dim o As New cRatesCurve
    o.Init name, startD, endD, sofr, scenRange.Value, holRange.Value, _
           scenRange.Address(False, False), holRange.Address(False, False)
    RegSet "RatesCurve." & name, o
    RatesCurve = "RatesCurve." & name & " | OK | " & o.Days & " days | " & _
                 Format(sofr, "0.00") & "->" & Format(o.LastRate, "0.00") & _
                 " | scen " & o.ScenRef & " | hol " & o.HolRef
    Exit Function
bad: RatesCurve = "#CURVE_ERR: " & Err.Description
End Function

' Spill the whole curve (header + daily strip incl. accumFactor).
Public Function GET(curveCell As Range) As Variant
    On Error GoTo bad
    Dim crv As cRatesCurve
    Set crv = RegGet(HandleKey(CStr(curveCell.Value)))
    If crv Is Nothing Then GET = CVErr(xlErrNA): Exit Function
    GET = crv.AsArray()
    Exit Function
bad: GET = CVErr(xlErrValue)
End Function

Public Function ACCRUE(ByVal startD As Date, ByVal endD As Date, ByVal amount As Double, _
                       ByVal accrualType As String, curveCell As Range) As Variant
    On Error GoTo bad
    Dim crv As cRatesCurve
    Set crv = RegGet(HandleKey(CStr(curveCell.Value)))
    If crv Is Nothing Then ACCRUE = CVErr(xlErrNA): Exit Function
    Select Case UCase$(accrualType)
        Case "SIMPLE":   ACCRUE = amount * crv.SimpleFactor(startD, endD)
        Case "COMPOUND": ACCRUE = amount * (crv.CompoundFactor(startD, endD) - 1#)
        Case Else:       ACCRUE = CVErr(xlErrValue)
    End Select
    Exit Function
bad: ACCRUE = CVErr(xlErrValue)
End Function

Public Function SWAP(ByVal startD As Date, ByVal endD As Date, ByVal notional As Double, _
                     ByVal fixedRate As Double, curveCell As Range, _
                     Optional ByVal leg As String = "NET") As Variant
    On Error GoTo bad
    Dim crv As cRatesCurve
    Set crv = RegGet(HandleKey(CStr(curveCell.Value)))
    If crv Is Nothing Then SWAP = CVErr(xlErrNA): Exit Function
    Dim s As Date, fx As Double, fl As Double
    s = crv.Following(startD)
    fx = notional * fixedRate / 100# * CLng(endD - s) / 360#
    fl = notional * (crv.CompoundFactor(startD, endD) - 1#)
    Select Case UCase$(leg)
        Case "FIXED": SWAP = fx
        Case "FLOAT": SWAP = fl
        Case "NET":   SWAP = fx - fl
        Case Else:    SWAP = CVErr(xlErrValue)
    End Select
    Exit Function
bad: SWAP = CVErr(xlErrValue)
End Function
