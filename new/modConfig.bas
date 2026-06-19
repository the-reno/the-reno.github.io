Attribute VB_Name = "modConfig"
'==============================================================================
' modConfig  -  immutable-style config value-holder (engine-v2 pattern)
' Reads parameters from the Config sheet of DepositLadder workbook.
'==============================================================================
Option Explicit

' Tenor indices (1-based, matches Curve columns ON,1M,2M,3M)
Public Const T_ON As Long = 1
Public Const T_1M As Long = 2
Public Const T_2M As Long = 3
Public Const T_3M As Long = 4
Public Const TENORS As Long = 4

Public Type TConfig
    Notional As Double          ' $100
    Basis As Double             ' day-count basis, 360
    AnnDays As Double           ' annualisation days/yr, 252
    GridStep As Long            ' weight grid step, %
    Rf As Double                ' risk-free (avg ON) in %
    CalDays(1 To 4) As Double   ' nominal calendar days per tenor (tenor length)
End Type

' Load the config holder once and pass it by value through the engine.
Public Function LoadConfig() As TConfig
    Dim c As TConfig, ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Config")
    c.Notional = ws.Range("C5").Value
    c.Basis = ws.Range("C6").Value
    c.AnnDays = ws.Range("C7").Value
    c.GridStep = CLng(ws.Range("C8").Value)
    c.Rf = ws.Range("C9").Value
    c.CalDays(T_ON) = ws.Range("C10").Value
    c.CalDays(T_1M) = ws.Range("C11").Value
    c.CalDays(T_2M) = ws.Range("C12").Value
    c.CalDays(T_3M) = ws.Range("C13").Value
    LoadConfig = c
End Function

' Per-tenor scenario shift (rate points): parallel + linear twist.
' twist is the extra applied at the 3M point; ON gets 0; linear in calendar days.
Public Function ShiftFor(ByVal tenor As Long, ByVal parallel As Double, _
                         ByVal twist As Double, cfg As TConfig) As Double
    Dim span As Double, frac As Double
    span = cfg.CalDays(T_3M) - cfg.CalDays(T_ON)
    If span <= 0 Then
        frac = 0#
    Else
        frac = (cfg.CalDays(tenor) - cfg.CalDays(T_ON)) / span
    End If
    ShiftFor = parallel + twist * frac
End Function
