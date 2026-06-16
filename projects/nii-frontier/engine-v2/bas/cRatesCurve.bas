Attribute VB_Name = "cRatesCurve"
' === CLASS MODULE ===
' The assembled curve. Built from SOFR + a FedScenario + a HolidayTable,
' it strips a DAILY table from start to end:  date | rate% | accumFactor.
' Each FOMC move is effective the next business day; rates cumulate on
' SOFR; accumFactor is the running product (1 + rate*days/360),
' SOFR in-arrears. Accrual reads this table - no re-walking.
' =====================================================================
Option Explicit
Private mName As String
Private mStart As Date, mEnd As Date
Private mDates() As Date          ' one row per business day in [start,end)
Private mRate() As Double
Private mAccum() As Double
Private mN As Long
Private mCal As cHolidayTable

Public Sub Init(ByVal nm As String, ByVal startD As Date, ByVal endD As Date, _
                ByVal sofr As Double, scen As cFedScenario, cal As cHolidayTable)
    Dim i As Long
    mName = nm: mStart = startD: mEnd = endD: Set mCal = cal

    ' 1) build the step knots: effective date (next BD) -> cumulative rate
    Dim kEff() As Date, kRate() As Double, kN As Long, cum As Double
    ReDim kEff(0 To scen.Count) : ReDim kRate(0 To scen.Count)
    kN = 0 : kEff(0) = DateSerial(1900, 1, 1) : kRate(0) = sofr : cum = sofr
    For i = 1 To scen.Count
        If scen.MoveBps(i) <> 0# Then
            cum = cum + scen.MoveBps(i) / 100#
            kN = kN + 1
            kEff(kN) = cal.NextBusinessDay(scen.MoveDate(i))
            kRate(kN) = cum
        End If
    Next i

    ' 2) strip day by day across business days, accumulating the factor
    Dim d As Date, w As Long, acc As Double, cap As Long
    cap = CLng(endD - startD) + 5
    ReDim mDates(1 To cap) : ReDim mRate(1 To cap) : ReDim mAccum(1 To cap)
    mN = 0 : acc = 1#
    d = cal.Following(startD)
    Do While d < endD
        w = cal.OnDays(d)
        If d + w > endD Then w = CLng(endD - d)
        Dim r As Double, j As Long
        r = kRate(0)
        For j = 0 To kN
            If kEff(j) <= d Then r = kRate(j) Else Exit For
        Next j
        acc = acc * (1# + r / 100# * w / 360#)
        mN = mN + 1
        mDates(mN) = d : mRate(mN) = r : mAccum(mN) = acc
        d = cal.NextBusinessDay(d)
    Loop
    ReDim Preserve mDates(1 To Application.Max(1, mN))
    ReDim Preserve mRate(1 To Application.Max(1, mN))
    ReDim Preserve mAccum(1 To Application.Max(1, mN))
End Sub

Public Property Get CurveName() As String: CurveName = mName: End Property
Public Property Get StartDate() As Date: StartDate = mStart: End Property
Public Property Get EndDate() As Date: EndDate = mEnd: End Property
Public Property Get Days() As Long: Days = mN: End Property
Public Property Get FirstRate() As Double: FirstRate = mRate(1): End Property
Public Property Get LastRate() As Double: LastRate = mRate(mN): End Property
Public Property Get Calendar() As cHolidayTable: Set Calendar = mCal: End Property

' Compound factor over [s,e): product of (1+r*days/360) for every fix
' with s <= fixDate < e. Walk the slice directly - no boundary ambiguity.
Public Function CompoundFactor(ByVal s As Date, ByVal e As Date) As Double
    Dim i As Long, f As Double, w As Long
    If e > mEnd Then Err.Raise vbObjectError + 1, , "date past curve end"
    f = 1#
    For i = 1 To mN
        If mDates(i) >= s And mDates(i) < e Then
            If i < mN Then w = CLng(mDates(i + 1) - mDates(i)) Else w = CLng(e - mDates(i))
            If mDates(i) + w > e Then w = CLng(e - mDates(i))
            f = f * (1# + mRate(i) / 100# * w / 360#)
        End If
    Next i
    CompoundFactor = f
End Function

' Simple sum of rate*days/360 over the same [s,e) slice.
Public Function SimpleFactor(ByVal s As Date, ByVal e As Date) As Double
    Dim i As Long, t As Double, w As Long
    If e > mEnd Then Err.Raise vbObjectError + 1, , "date past curve end"
    For i = 1 To mN
        If mDates(i) >= s And mDates(i) < e Then
            If i < mN Then w = CLng(mDates(i + 1) - mDates(i)) Else w = CLng(e - mDates(i))
            If mDates(i) + w > e Then w = CLng(e - mDates(i))
            t = t + mRate(i) / 100# * w / 360#
        End If
    Next i
    SimpleFactor = t
End Function

' Spill payload: date | rate% | accumFactor, one row per business day.
Public Function AsArray() As Variant
    Dim a() As Variant, i As Long
    ReDim a(1 To mN, 1 To 3)
    For i = 1 To mN
        a(i, 1) = mDates(i) : a(i, 2) = mRate(i) : a(i, 3) = mAccum(i)
    Next i
    AsArray = a
End Function
