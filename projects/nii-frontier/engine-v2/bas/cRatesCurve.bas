Attribute VB_Name = "cRatesCurve"
' === CLASS MODULE ===
' THE CURVE - the one object with real logic. Built from the input
' ranges (Fed moves + holidays) plus SOFR and a date range. It does two
' things, once, at build time:
'   1) STAIRCASE: start flat at SOFR; each Fed move steps the rate,
'      effective the next business day, cumulatively.
'   2) STRIP: walk every business day start->end; record the rate in
'      force, the day factor (1+rate*days/360), and the running product
'      (accumFactor). Interest later is just reading this table.
' It also stores its provenance (what built it) and the daily strip:
'     date | rate% | dayFactor | accumFactor
' Each FOMC move is effective the next business day; rates cumulate on
' SOFR; dayFactor = 1 + rate*days/360; accumFactor is the running product
' (SOFR in-arrears). Accrual reads this table - no re-walking.
' =====================================================================
Option Explicit
Private mName As String
Private mStart As Date, mEnd As Date, mSofr As Double
Private mScenRef As String, mHolRef As String          ' provenance
Private mDates() As Date
Private mRate() As Double
Private mDayF() As Double
Private mAccum() As Double
Private mN As Long
' calendar held internally (built from the holiday range)
Private mHol As Object

Public Sub Init(ByVal nm As String, ByVal startD As Date, ByVal endD As Date, _
                ByVal sofr As Double, scenData As Variant, holData As Variant, _
                ByVal scenRef As String, ByVal holRef As String)
    Dim i As Long
    mName = nm: mStart = startD: mEnd = endD: mSofr = sofr
    mScenRef = scenRef: mHolRef = holRef

    ' --- holidays into a fast set
    Set mHol = CreateObject("Scripting.Dictionary")
    For i = LBound(holData, 1) To UBound(holData, 1)
        If IsDate(holData(i, 1)) Then
            If Not mHol.Exists(CLng(CDate(holData(i, 1)))) Then mHol.Add CLng(CDate(holData(i, 1))), True
        End If
    Next i

    ' --- staircase knots from the scenario moves (effective next BD, cumulative)
    ' Dates are sorted ascending before cumulating so out-of-order input
    ' (e.g. a literal array) still produces the correct staircase.
    Dim kEff() As Date, kRate() As Double, kN As Long, cum As Double, nMoves As Long
    nMoves = UBound(scenData, 1) - LBound(scenData, 1) + 1
    ReDim kEff(0 To nMoves) : ReDim kRate(0 To nMoves)
    kN = 0 : kEff(0) = DateSerial(1900, 1, 1) : kRate(0) = sofr : cum = sofr

    ' Collect valid moves into temporary arrays then sort by date
    Dim tmpDt() As Date, tmpMv() As Double, tmpN As Long
    ReDim tmpDt(1 To nMoves) : ReDim tmpMv(1 To nMoves) : tmpN = 0
    For i = LBound(scenData, 1) To UBound(scenData, 1)
        If IsDate(scenData(i, 1)) Or IsNumeric(scenData(i, 1)) Then
            Dim mv As Double : mv = 0#
            If UBound(scenData, 2) >= 2 Then If IsNumeric(scenData(i, 2)) Then mv = CDbl(scenData(i, 2))
            If mv <> 0# Then
                tmpN = tmpN + 1
                tmpDt(tmpN) = CDate(scenData(i, 1))
                tmpMv(tmpN) = mv
            End If
        End If
    Next i

    ' Bubble sort by date ascending (small n, simple is fine)
    Dim si As Long, sj As Long, swpD As Date, swpM As Double
    For si = 1 To tmpN - 1
        For sj = 1 To tmpN - si
            If tmpDt(sj) > tmpDt(sj + 1) Then
                swpD = tmpDt(sj) : tmpDt(sj) = tmpDt(sj + 1) : tmpDt(sj + 1) = swpD
                swpM = tmpMv(sj) : tmpMv(sj) = tmpMv(sj + 1) : tmpMv(sj + 1) = swpM
            End If
        Next sj
    Next si

    ' Build the cumulative knots from the sorted moves
    For si = 1 To tmpN
        cum = cum + tmpMv(si) / 100#
        kN = kN + 1
        kEff(kN) = NextBusinessDay(tmpDt(si))
        kRate(kN) = cum
    Next si

    ' --- strip every business day start..end with dayFactor and accumFactor
    Dim d As Date, w As Long, acc As Double, cap As Long, r As Double, j As Long
    cap = CLng(endD - startD) + 5
    ReDim mDates(1 To cap): ReDim mRate(1 To cap): ReDim mDayF(1 To cap): ReDim mAccum(1 To cap)
    mN = 0 : acc = 1#
    d = Following(startD)
    Do While d < endD
        w = OnDays(d)
        If d + w > endD Then w = CLng(endD - d)
        r = kRate(0)
        For j = 0 To kN
            If kEff(j) <= d Then r = kRate(j) Else Exit For
        Next j
        Dim f As Double
        f = 1# + r / 100# * w / 360#
        acc = acc * f
        mN = mN + 1
        mDates(mN) = d: mRate(mN) = r: mDayF(mN) = f: mAccum(mN) = acc
        d = NextBusinessDay(d)
    Loop
    ReDim Preserve mDates(1 To Application.Max(1, mN))
    ReDim Preserve mRate(1 To Application.Max(1, mN))
    ReDim Preserve mDayF(1 To Application.Max(1, mN))
    ReDim Preserve mAccum(1 To Application.Max(1, mN))
End Sub

' ---- calendar helpers (internal, over the holiday set)
Private Function IsBusinessDay(ByVal d As Date) As Boolean
    Dim w As Long: w = Weekday(d, vbMonday)
    IsBusinessDay = (w <= 5) And Not mHol.Exists(CLng(d))
End Function
Public Function Following(ByVal d As Date) As Date
    Do While Not IsBusinessDay(d): d = d + 1: Loop
    Following = d
End Function
Public Function NextBusinessDay(ByVal d As Date) As Date
    NextBusinessDay = Following(d + 1)
End Function
Private Function OnDays(ByVal d As Date) As Long
    OnDays = CLng(NextBusinessDay(d) - d)
End Function

' ---- identity / provenance
Public Property Get CurveName() As String: CurveName = mName: End Property
Public Property Get StartDate() As Date: StartDate = mStart: End Property
Public Property Get EndDate() As Date: EndDate = mEnd: End Property
Public Property Get Sofr() As Double: Sofr = mSofr: End Property
Public Property Get ScenRef() As String: ScenRef = mScenRef: End Property
Public Property Get HolRef() As String: HolRef = mHolRef: End Property
Public Property Get Days() As Long: Days = mN: End Property
Public Property Get LastRate() As Double: LastRate = mRate(mN): End Property

' ---- factors over [s,e): walk the daily slice (no boundary division)
Public Function CompoundFactor(ByVal s As Date, ByVal e As Date) As Double
    Dim i As Long, fac As Double, w As Long
    If e > mEnd Then Err.Raise vbObjectError + 1, , "date past curve end"
    fac = 1#
    For i = 1 To mN
        If mDates(i) >= s And mDates(i) < e Then
            If i < mN Then w = CLng(mDates(i + 1) - mDates(i)) Else w = CLng(e - mDates(i))
            If mDates(i) + w > e Then w = CLng(e - mDates(i))
            fac = fac * (1# + mRate(i) / 100# * w / 360#)
        End If
    Next i
    CompoundFactor = fac
End Function
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

' ---- range check: is a date within the curve's stripped horizon?
Public Function IsInRange(ByVal d As Date) As Boolean
    IsInRange = (d >= mStart And d <= mEnd)
End Function

' ---- is a date before the curve start (still valid - returns opening SOFR)?
Public Function IsBeforeStart(ByVal d As Date) As Boolean
    IsBeforeStart = (d < mStart)
End Function

' ---- the rate in force on a single date (the staircase value).

'      Before the first business day in the strip, returns the opening SOFR.
Public Function RateOn(ByVal d As Date) As Double
    Dim i As Long
    RateOn = mSofr
    For i = 1 To mN
        If mDates(i) <= d Then RateOn = mRate(i) Else Exit For
    Next i
End Function

' ---- spill payload: a provenance header, then the daily strip with
'      date | rate% | dayFactor | accumFactor
Public Function AsArray() As Variant
    Dim a() As Variant, i As Long, h As Long
    h = 2                                   ' two header rows
    ReDim a(1 To mN + h, 1 To 4)
    a(1, 1) = "curve": a(1, 2) = mName: a(1, 3) = "SOFR": a(1, 4) = mSofr
    a(2, 1) = "date": a(2, 2) = "rate%": a(2, 3) = "dayFactor": a(2, 4) = "accumFactor"
    For i = 1 To mN
        a(h + i, 1) = mDates(i): a(h + i, 2) = mRate(i)
        a(h + i, 3) = mDayF(i):  a(h + i, 4) = mAccum(i)
    Next i
    AsArray = a
End Function
