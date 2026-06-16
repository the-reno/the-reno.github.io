Attribute VB_Name = "mRegistry"
' =====================================================================
' mRegistry - the in-memory object store. name -> object.
' Memory is a cache; the builder formulas on the sheet are the truth
' (a recalc rebuilds every object). Handles are dotted: "Type.Name".
' =====================================================================
Option Explicit
Private gReg As Object

Private Sub Ensure()
    If gReg Is Nothing Then Set gReg = CreateObject("Scripting.Dictionary")
End Sub

Public Sub RegSet(ByVal key As String, obj As Object)
    Ensure
    key = LCase$(Trim$(key))
    If gReg.Exists(key) Then gReg.Remove key   ' rebuild = replace
    gReg.Add key, obj
End Sub

Public Function RegGet(ByVal key As String) As Object
    Ensure
    key = LCase$(Trim$(key))
    If gReg.Exists(key) Then Set RegGet = gReg(key)
End Function

' A handle cell holds "Type.Name | OK | info". Strip to the dotted key.
Public Function HandleKey(ByVal handle As String) As String
    Dim p As Long
    p = InStr(handle, "|")
    If p > 0 Then handle = Left$(handle, p - 1)
    HandleKey = LCase$(Trim$(handle))
End Function
