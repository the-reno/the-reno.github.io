Attribute VB_Name = "cFedScenario"
' === CLASS MODULE ===
' Holds a named FOMC move list as VALUES. Rows: date | bps (signed).
' Pure data - no SOFR, no calendar, no calculation. Just the moves.
' =====================================================================
Option Explicit
Private mName As String
Private mDates() As Date
Private mBps() As Double
Private mN As Long

Public Sub Init(ByVal nm As String, data As Variant)
    Dim i As Long, r As Long
    mName = nm: r = 0
    ReDim mDates(1 To UBound(data, 1)) : ReDim mBps(1 To UBound(data, 1))
    For i = LBound(data, 1) To UBound(data, 1)
        If IsDate(data(i, 1)) Then
            r = r + 1
            mDates(r) = CDate(data(i, 1))
            If UBound(data, 2) >= 2 And IsNumeric(data(i, 2)) Then mBps(r) = CDbl(data(i, 2)) Else mBps(r) = 0#
        End If
    Next i
    mN = r
    ReDim Preserve mDates(1 To Application.Max(1, mN))
    ReDim Preserve mBps(1 To Application.Max(1, mN))
End Sub

Public Property Get ScenarioName() As String: ScenarioName = mName: End Property
Public Property Get Count() As Long: Count = mN: End Property
Public Function MoveDate(ByVal i As Long) As Date: MoveDate = mDates(i): End Function
Public Function MoveBps(ByVal i As Long) As Double: MoveBps = mBps(i): End Function

' Spill payload: date | bps, one row per move.
Public Function AsArray() As Variant
    Dim a() As Variant, i As Long
    ReDim a(1 To Application.Max(1, mN), 1 To 2)
    For i = 1 To mN: a(i, 1) = mDates(i): a(i, 2) = mBps(i): Next i
    AsArray = a
End Function
