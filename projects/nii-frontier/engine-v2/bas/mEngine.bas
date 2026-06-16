Attribute VB_Name = "mEngine"
' =====================================================================
' mEngine - the worksheet functions (the only module that reads cells).
'
'   =HolidayTable(name, range)                       -> "HolidayTable.NAME | OK | n"
'   =FedScenario(name, range)                        -> "FedScenario.NAME | OK | n"
'   =RatesCurve(name, start, end, sofr, scenCell, holCell)
'                                                    -> "RatesCurve.NAME | OK | ..."
'   =GET(handleCell)                                 -> spills the whole dataset
'   =ACCRUE(start, end, amount, type, curveCell)     -> interest $mm
'   =SWAP(start, end, notional, fixed, curveCell, leg)
'
' RULE: pass the handle CELL (e.g. $B$5), never the text - so edits cascade.
' =====================================================================
Option Explicit

Public Function HolidayTable(ByVal name As String, data As Range) As String
    On Error GoTo bad
    Dim o As New cHolidayTable
    o.Init name, data.Value
    RegSet "HolidayTable." & name, o
    HolidayTable = "HolidayTable." & name & " | OK | " & o.Count & " dates"
    Exit Function
bad: HolidayTable = "#HOL_ERR: " & Err.Description
End Function

Public Function FedScenario(ByVal name As String, data As Range) As String
    On Error GoTo bad
    Dim o As New cFedScenario
    o.Init name, data.Value
    RegSet "FedScenario." & name, o
    FedScenario = "FedScenario." & name & " | OK | " & o.Count & " moves"
    Exit Function
bad: FedScenario = "#SCEN_ERR: " & Err.Description
End Function

Public Function RatesCurve(ByVal name As String, ByVal startD As Date, ByVal endD As Date, _
                           ByVal sofr As Double, scenCell As Range, holCell As Range) As String
    On Error GoTo bad
    Dim scen As cFedScenario, cal As cHolidayTable
    Set scen = RegGet(HandleKey(CStr(scenCell.Value)))
    Set cal = RegGet(HandleKey(CStr(holCell.Value)))
    If scen Is Nothing Then RatesCurve = "#CURVE_ERR: scenario not built": Exit Function
    If cal Is Nothing Then RatesCurve = "#CURVE_ERR: holidays not built": Exit Function
    Dim o As New cRatesCurve
    o.Init name, startD, endD, sofr, scen, cal
    RegSet "RatesCurve." & name, o
    RatesCurve = "RatesCurve." & name & " | OK | " & o.Days & " days | " & _
                 Format(sofr, "0.00") & "->" & Format(o.LastRate, "0.00")
    Exit Function
bad: RatesCurve = "#CURVE_ERR: " & Err.Description
End Function

' Spills the entire stored dataset for any object. Use a CELL handle so
' the spill refreshes when the object rebuilds. Then XLOOKUP the spill
' for any single point.
Public Function GET(handleCell As Range) As Variant
    On Error GoTo bad
    Dim key As String, o As Object
    key = HandleKey(CStr(handleCell.Value))
    Set o = RegGet(key)
    If o Is Nothing Then GET = CVErr(xlErrNA): Exit Function
    GET = o.AsArray()                       ' polymorphic: each class supplies AsArray
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
    s = crv.Calendar.Following(startD)
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
