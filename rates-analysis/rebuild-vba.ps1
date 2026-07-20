$ErrorActionPreference = 'Stop'

$Folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$Parts = Get-ChildItem -Path (Join-Path $Folder 'source') -Filter 'Rates_Analysis_Final.bas.gz.b64.part*' | Sort-Object Name

if ($Parts.Count -eq 0) {
    throw 'No VBA source chunks were found in rates-analysis/source.'
}

$Encoded = ($Parts | ForEach-Object { (Get-Content $_.FullName -Raw).Trim() }) -join ''
$Compressed = [Convert]::FromBase64String($Encoded)
$InputStream = New-Object System.IO.MemoryStream(,$Compressed)
$Gzip = New-Object System.IO.Compression.GzipStream($InputStream, [System.IO.Compression.CompressionMode]::Decompress)
$OutputPath = Join-Path $Folder 'Rates_Analysis_Final_v2.bas'
$OutputStream = [System.IO.File]::Create($OutputPath)
$Gzip.CopyTo($OutputStream)
$OutputStream.Close()
$Gzip.Close()
$InputStream.Close()

Write-Host "Created $OutputPath"
