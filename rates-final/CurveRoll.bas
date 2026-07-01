Option Explicit

Sub BuildMonthlyFactors()

    Dim data As Worksheet, inp As Worksheet, out As Worksheet
    Dim finalInput As Date, finalDate As Date
    Dim years As Double, totalMonths As Long
    Dim rolls() As Date
    Dim i As Long, outRow As Long

    Set data = Sheets("CurveCalc")
    Set inp = Sheets("Input")
    Set out = Sheets("Output")

    If Not IsDate(inp.Range("B1").Value) Then
        MsgBox "Input!B1 must contain a valid final date."
        Exit Sub
    End If

    If Not IsNumeric(inp.Range("B2").Value) Or inp.Range("B2").Value <= 0 Then
        MsgBox "Input!B2 must contain the analysis years."
        Exit Sub
    End If

    finalInput = CDate(inp.Range("B1").Value)
    years = CDbl(inp.Range("B2").Value)
    totalMonths = Round(years * 12, 0)

    finalDate = PreviousCurveDate(data, finalInput)

    If finalDate = 0 Then
        MsgBox "No curve date is available on or before the final date."
        Exit Sub
    End If

    ReDim rolls(0 To totalMonths)

    For i = 0 To totalMonths
        rolls(i) = PreviousCurveDate(data, RollTarget(finalInput, i - totalMonths))

        If rolls(i) = 0 Then
            MsgBox "Curve history is not sufficient for the full period."
            Exit Sub
        End If
    Next i

    rolls(totalMonths) = finalDate

    out.Cells.Clear
    out.Range("A1:H1").Value = Array("Month", "Start", "End", "ON Factor", "1M Factor", "2M Factor", "3M Factor", "6M Factor")

    outRow = 2

    For i = 1 To totalMonths

        out.Cells(outRow, 1).Value = i
        out.Cells(outRow, 2).Value = rolls(i - 1)
        out.Cells(outRow, 3).Value = rolls(i)

        out.Cells(outRow, 4).Value = PeriodFactor(data, rolls(i - 1), rolls(i), 2)
        out.Cells(outRow, 5).Value = PeriodFactor(data, rolls(i - 1), rolls(i), 6)

        If i Mod 2 = 0 Then
            out.Cells(outRow, 6).Value = PeriodFactor(data, rolls(i - 2), rolls(i), 10)
        End If

        If i Mod 3 = 0 Then
            out.Cells(outRow, 7).Value = PeriodFactor(data, rolls(i - 3), rolls(i), 14)
        End If

        If i Mod 6 = 0 Then
            out.Cells(outRow, 8).Value = PeriodFactor(data, rolls(i - 6), rolls(i), 18)
        End If

        outRow = outRow + 1

    Next i

    out.Columns("B:C").NumberFormat = "yyyy-mm-dd"
    out.Columns("D:H").NumberFormat = "0.000000"
    out.Columns.AutoFit

    MsgBox "Monthly factors created."

End Sub

Function PreviousCurveDate(data As Worksheet, targetDate As Date) As Date
    Dim rowNumber As Variant

    rowNumber = Application.Match(CDbl(targetDate), data.Columns(1), 1)

    If IsError(rowNumber) Then
        PreviousCurveDate = 0
    Else
        PreviousCurveDate = CDate(data.Cells(rowNumber, 1).Value)
    End If
End Function

Function PeriodFactor(data As Worksheet, startDate As Date, endDate As Date, rateColumn As Long) As Double
    Dim rowNumber As Variant
    Dim rate As Double
    Dim days As Long

    rowNumber = Application.Match(CDbl(startDate), data.Columns(1), 0)

    If IsError(rowNumber) Then Exit Function

    rate = CDbl(data.Cells(rowNumber, rateColumn).Value)
    days = endDate - startDate

    PeriodFactor = 1 + rate * days / 360
End Function

Function RollTarget(finalDate As Date, monthOffset As Long) As Date
    Dim firstDay As Date
    Dim lastDay As Date
    Dim fixedDay As Long

    fixedDay = Day(finalDate)
    firstDay = DateSerial(Year(finalDate), Month(finalDate) + monthOffset, 1)
    lastDay = DateSerial(Year(firstDay), Month(firstDay) + 1, 0)

    If fixedDay > Day(lastDay) Then fixedDay = Day(lastDay)

    RollTarget = DateSerial(Year(firstDay), Month(firstDay), fixedDay)
End Function
