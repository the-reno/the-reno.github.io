Attribute VB_Name = "cHolidayTable"
' === CLASS MODULE ===
' Holds a named holiday set as VALUES. Rows: date | name.
' Provides IsHoliday and the business-day helpers the curve needs.
' =====================================================================
Option Explicit
Private mName As String
Private mDates() As Date
Private mLabels() As String
Private mN As Long
Private mHol As Object        ' Dictionary of date serials for fast lookup

Public Sub Init(ByVal nm As String, data As Variant)
    Dim i As Long, r As Long
    mName = nm
    Set mHol = CreateObject("Scripting.Dictionary")
    r = 0
    ReDim mDates(1 To UBound(data, 1)) : ReDim mLabels(1 To UBound(data, 1))
    For i = LBound(data, 1) To UBound(data, 1)
        If IsDate(data(i, 1)) Then
            r = r + 1
            mDates(r) = CDate(data(i, 1))
            If UBound(data, 2) >= 2 Then mLabels(r) = CStr(data(i, 2)) Else mLabels(r) = ""
            If Not mHol.Exists(CLng(mDates(r))) Then mHol.Add CLng(mDates(r)), mLabels(r)
        End If
    Next i
    mN = r
    ReDim Preserve mDates(1 To Application.Max(1, mN))
    ReDim Preserve mLabels(1 To Application.Max(1, mN))
End Sub

Public Property Get TableName() As String: TableName = mName: End Property
Public Property Get Count() As Long: Count = mN: End Property

Public Function IsHoliday(ByVal d As Date) As Boolean
    IsHoliday = mHol.Exists(CLng(d))
End Function
Public Function IsBusinessDay(ByVal d As Date) As Boolean
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
Public Function OnDays(ByVal d As Date) As Long
    OnDays = CLng(NextBusinessDay(d) - d)
End Function

' Spill payload: date | name, one row per holiday.
Public Function AsArray() As Variant
    Dim a() As Variant, i As Long
    ReDim a(1 To Application.Max(1, mN), 1 To 2)
    For i = 1 To mN: a(i, 1) = mDates(i): a(i, 2) = mLabels(i): Next i
    AsArray = a
End Function
