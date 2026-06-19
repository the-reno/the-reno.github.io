Attribute VB_Name = "modCurve"
'==============================================================================
' modCurve  -  loads the daily deposit curve into memory and serves rates.
' Curve sheet layout: row 4 headers; data from row 5; col B = date,
' cols C..F = ON, 1M, 2M, 3M (rates in %).
'==============================================================================
Option Explicit

Public gN As Long              ' number of curve dates
Public gDate() As Date
Public gRate() As Double       ' (1..gN, 1..4)

Public Sub LoadCurve()
    Dim ws As Worksheet, lastRow As Long, i As Long, j As Long
    Set ws = ThisWorkbook.Sheets("Curve")
    lastRow = ws.Cells(ws.Rows.Count, 2).End(xlUp).Row
    gN = lastRow - 4
    If gN < 2 Then Err.Raise vbObjectError + 1, "modCurve", "Curve has fewer than 2 rows of data."
    ReDim gDate(1 To gN)
    ReDim gRate(1 To gN, 1 To 4)
    For i = 1 To gN
        gDate(i) = ws.Cells(4 + i, 2).Value
        For j = 1 To 4
            gRate(i, j) = ws.Cells(4 + i, 2 + j).Value
        Next j
    Next i
End Sub

' Rate (%) at a day index for a tenor, with an optional additive shift (rate pts).
Public Function RateAt(ByVal idx As Long, ByVal tenor As Long, _
                       Optional ByVal shift As Double = 0) As Double
    If idx < 1 Then idx = 1
    If idx > gN Then idx = gN
    RateAt = gRate(idx, tenor) + shift
End Function

' Mean rate of a tenor over the sample (used for WAM/return cross-checks).
Public Function MeanRate(ByVal tenor As Long) As Double
    Dim i As Long, s As Double
    For i = 1 To gN: s = s + gRate(i, tenor): Next i
    MeanRate = s / gN
End Function

' Actual calendar days between two curve indices (ACT/360 numerator).
Public Function DaysBetween(ByVal a As Long, ByVal b As Long) As Double
    DaysBetween = CDbl(gDate(b) - gDate(a))
End Function

' First curve index strictly after startIdx whose date >= start + calDays.
' Clamps to gN so deposits near the horizon mark-to-end with partial accrual.
Public Function NextMatIdx(ByVal startIdx As Long, ByVal calDays As Double) As Long
    Dim target As Date, j As Long
    target = gDate(startIdx) + calDays
    j = startIdx + 1
    Do While j < gN
        If gDate(j) >= target Then Exit Do
        j = j + 1
    Loop
    NextMatIdx = j
End Function
