Attribute VB_Name = "modDepositDealGenerator"
Option Explicit

'====================================================
' MODULE: modDepositDealGenerator
' PURPOSE:
' Generate deposit deals from:
'   - Start Date
'   - End Date
'   - Initial Cash
'   - Minimum ON
'   - Strategy allocation %
'
' No rates.
' No interest.
' No scenario.
'
' Interest evaluation is a separate engine.
'====================================================

Public Sub GenerateDepositDeals()

    Dim wsIn As Worksheet
    Dim wsOut As Worksheet
    Dim startDate As Date
    Dim endDate As Date
    Dim initialCash As Double
    Dim minON As Double
    Dim availableCash As Double

    Dim strategyName As String
    Dim pctON As Double
    Dim pct1M As Double
    Dim pct2M As Double
    Dim pct3M As Double
    Dim pct6M As Double

    Set wsIn = ThisWorkbook.Worksheets("Deposit_Input")
    Set wsOut = ThisWorkbook.Worksheets("Deposit_Deals")

    startDate = wsIn.Range("B2").Value
    endDate = wsIn.Range("B3").Value
    initialCash = wsIn.Range("B4").Value
    minON = wsIn.Range("B5").Value

    strategyName = wsIn.Range("B8").Value
    pctON = wsIn.Range("B9").Value / 100
    pct1M = wsIn.Range("B10").Value / 100
    pct2M = wsIn.Range("B11").Value / 100
    pct3M = wsIn.Range("B12").Value / 100
    pct6M = wsIn.Range("B13").Value / 100

    availableCash = initialCash - minON

    If availableCash < 0 Then
        MsgBox "Initial cash cannot be lower than minimum ON.", vbCritical
        Exit Sub
    End If

    If Abs((pctON + pct1M + pct2M + pct3M + pct6M) - 1) > 0.00001 Then
        MsgBox "Strategy percentages must sum to 100%.", vbCritical
        Exit Sub
    End If

    wsOut.Cells.Clear

    wsOut.Range("A1:H1").Value = Array( _
        "DEAL_ID", _
        "STRATEGY", _
        "BUCKET", _
        "START_DATE", _
        "END_DATE", _
        "VALUE_DATE", _
        "NOTIONAL", _
        "BUS_DAY" _
    )

    Dim r As Long
    r = 2

    r = GenerateBucketDeals(wsOut, r, strategyName, "ON", startDate, endDate, minON + availableCash * pctON, 0)
    r = GenerateBucketDeals(wsOut, r, strategyName, "1M", startDate, endDate, availableCash * pct1M, 1)
    r = GenerateBucketDeals(wsOut, r, strategyName, "2M", startDate, endDate, availableCash * pct2M, 2)
    r = GenerateBucketDeals(wsOut, r, strategyName, "3M", startDate, endDate, availableCash * pct3M, 3)
    r = GenerateBucketDeals(wsOut, r, strategyName, "6M", startDate, endDate, availableCash * pct6M, 6)

    wsOut.Columns.AutoFit

    MsgBox "Deposit deals generated successfully.", vbInformation

End Sub

Private Function GenerateBucketDeals( _
    ByVal ws As Worksheet, _
    ByVal startRow As Long, _
    ByVal strategyName As String, _
    ByVal bucket As String, _
    ByVal modelStart As Date, _
    ByVal modelEnd As Date, _
    ByVal notional As Double, _
    ByVal tenorMonths As Long _
) As Long

    Dim r As Long
    Dim dealCount As Long
    Dim tradeDate As Date
    Dim maturityDate As Date
    Dim valueDate As Date
    Dim dealID As String

    r = startRow
    dealCount = 1

    If notional <= 0 Then
        GenerateBucketDeals = r
        Exit Function
    End If

    tradeDate = modelStart

    Do While tradeDate <= modelEnd

        If tenorMonths = 0 Then
            maturityDate = tradeDate + 1
        Else
            maturityDate = DateAdd("m", tenorMonths, tradeDate)
        End If

        valueDate = FollowingBusinessDay(maturityDate)

        If valueDate > modelEnd Then Exit Do

        dealID = "DEP_" & bucket & "_" & Format(dealCount, "000")

        ws.Cells(r, 1).Value = dealID
        ws.Cells(r, 2).Value = strategyName
        ws.Cells(r, 3).Value = bucket
        ws.Cells(r, 4).Value = tradeDate
        ws.Cells(r, 5).Value = maturityDate
        ws.Cells(r, 6).Value = valueDate
        ws.Cells(r, 7).Value = notional
        ws.Cells(r, 8).Value = BusinessDayFlag(valueDate)

        r = r + 1
        dealCount = dealCount + 1

        tradeDate = valueDate

    Loop

    GenerateBucketDeals = r

End Function

Private Function FollowingBusinessDay(ByVal inputDate As Date) As Date

    Dim d As Date
    d = inputDate

    Do While BusinessDayFlag(d) <> "Y"
        d = d + 1
    Loop

    FollowingBusinessDay = d

End Function

Private Function BusinessDayFlag(ByVal inputDate As Date) As String

    If Weekday(inputDate, vbMonday) > 5 Then
        BusinessDayFlag = "WE"
    ElseIf IsHoliday(inputDate) Then
        BusinessDayFlag = "HOL"
    Else
        BusinessDayFlag = "Y"
    End If

End Function

Private Function IsHoliday(ByVal inputDate As Date) As Boolean

    Dim wsHol As Worksheet
    Dim lastRow As Long
    Dim i As Long

    Set wsHol = ThisWorkbook.Worksheets("Holidays")
    lastRow = wsHol.Cells(wsHol.Rows.Count, 1).End(xlUp).Row

    For i = 2 To lastRow
        If wsHol.Cells(i, 1).Value = inputDate Then
            IsHoliday = True
            Exit Function
        End If
    Next i

    IsHoliday = False

End Function
