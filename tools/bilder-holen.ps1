# DAILY – Kandidaten für das Album „Vögel“ laden (Phase 3c). Gestartet über bilder-holen.cmd im Projektordner.
# Sucht je Vogel auf Wikimedia Commons Fotos mit Lizenz CC0 oder gemeinfrei (geprüft über LicenseShortName),
# querformatig und mindestens 1000 px breit, und lädt bis zu 3 Kandidaten in 1200 px Breite nach public\bilder-roh\voegel.
# Dazu kandidaten.json mit Titel, Lizenz, Urheber und Dateiseite. Claude wählt aus, verkleinert und legt die Lizenzliste an.
# Warum hier: Die Cloud und die Arbeits-VM von Claude erreichen Wikimedia nicht (Netz auf GitHub/npm beschränkt).
# Nachladen: Liegt dort eine Datei nachladen.txt (je Zeile eine Art, z. B. kranich), lädt das Skript nur für diese Arten
# bis zu 8 weitere Kandidaten (bisherige bleiben, kandidaten.json wird ergänzt) und benennt die Datei danach in nachladen-erledigt.txt um.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ziel = Join-Path $PSScriptRoot '..\public\bilder-roh\voegel'
New-Item -ItemType Directory -Force -Path $ziel | Out-Null
$anzahl = 3; $limit = 15
$nur = @(); $liste = Join-Path $ziel 'nachladen.txt'
if (Test-Path $liste) { $nur = @(Get-Content $liste -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ }); $anzahl = 8; $limit = 40 }
$kj = Join-Path $ziel 'kandidaten.json'
$bisher = @(); if ($nur.Count -and (Test-Path $kj)) { $bisher = @(Get-Content $kj -Raw -Encoding UTF8 | ConvertFrom-Json) }
$kopf = @{ 'User-Agent' = 'DAILY-Bildauswahl/1.0 (privates Projekt; https://github.com/RogerWilloughby/daily)' }

$arten = [ordered]@{
  amsel = 'Turdus merula'; blaumeise = 'Cyanistes caeruleus'; kohlmeise = 'Parus major'; rotkehlchen = 'Erithacus rubecula'
  buchfink = 'Fringilla coelebs'; haussperling = 'Passer domesticus'; star = 'Sturnus vulgaris'; elster = 'Pica pica'
  eichelhaeher = 'Garrulus glandarius'; buntspecht = 'Dendrocopos major'; gruenspecht = 'Picus viridis'; eisvogel = 'Alcedo atthis'
  stockente = 'Anas platyrhynchos'; hoeckerschwan = 'Cygnus olor'; graureiher = 'Ardea cinerea'; weissstorch = 'Ciconia ciconia'
  maeusebussard = 'Buteo buteo'; turmfalke = 'Falco tinnunculus'; schleiereule = 'Tyto alba'; waldkauz = 'Strix aluco'
  uhu = 'Bubo bubo'; kranich = 'Grus grus'; kiebitz = 'Vanellus vanellus'; rauchschwalbe = 'Hirundo rustica'
  mauersegler = 'Apus apus'; zaunkoenig = 'Troglodytes troglodytes'; gimpel = 'Pyrrhula pyrrhula'; stieglitz = 'Carduelis carduelis'
  goldammer = 'Emberiza citrinella'; feldlerche = 'Alauda arvensis'; kuckuck = 'Cuculus canorus'
}
# Suchen in dieser Reihenfolge: zuerst „Quality images“ (von der Commons-Gemeinschaft geprüfte Fotos)
$suchen = @(
  'incategory:"Quality_images" hastemplate:"Cc-zero"', 'incategory:"Quality_images" hastemplate:"PD-self"',
  'hastemplate:"Cc-zero"', 'hastemplate:"PD-self"', 'hastemplate:"PD-author"'
)
$erlaubt = '^(CC0|Public domain)'
$alle = @()
foreach ($id in $arten.Keys) {
  if ($nur.Count -and $id -notin $nur) { continue }
  $wiss = $arten[$id]; $gefunden = @()
  $start = @(Get-ChildItem $ziel -Filter "$id-*").Count
  foreach ($zusatz in $suchen) {
    if ($gefunden.Count -ge $anzahl) { break }
    $q = '"' + $wiss + '" filetype:bitmap ' + $zusatz
    $url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=' + $limit +
      '&gsrsearch=' + [uri]::EscapeDataString($q) + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200' +
      '&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl'
    try { $r = Invoke-RestMethod -Uri $url -Headers $kopf -UseBasicParsing } catch { Write-Host "  $id - Suche fehlgeschlagen: $($_.Exception.Message)"; continue }
    if (-not $r.query) { continue }
    foreach ($p in ($r.query.pages.PSObject.Properties.Value | Sort-Object index)) {
      if ($gefunden.Count -ge $anzahl) { break }
      $ii = $p.imageinfo[0]; $m = $ii.extmetadata
      $lizenz = if ($m.LicenseShortName) { $m.LicenseShortName.value } else { '' }
      if ($lizenz -notmatch $erlaubt) { continue }
      if ($ii.width -lt 1000 -or $ii.width -le $ii.height) { continue }
      if ($gefunden | Where-Object { $_.titel -eq $p.title }) { continue }
      if ($bisher | Where-Object { $_.titel -eq $p.title }) { continue }
      if ($p.title -match 'Naturalis|RMNH|specimen') { continue }   # Museumsbälge
      $quelle = if ($ii.thumburl) { $ii.thumburl } else { $ii.url }
      $endung = [IO.Path]::GetExtension(([uri]$quelle).AbsolutePath).ToLower()
      $datei = '{0}-{1}{2}' -f $id, ($start + $gefunden.Count + 1), $endung
      try { Invoke-WebRequest -Uri $quelle -Headers $kopf -UseBasicParsing -OutFile (Join-Path $ziel $datei) } catch { Write-Host "  $datei - Laden fehlgeschlagen"; continue }
      $urheber = if ($m.Artist) { ($m.Artist.value -replace '<[^>]+>', '').Trim() } else { '' }
      $gefunden += [pscustomobject]@{ art = $id; wiss = $wiss; datei = $datei; titel = $p.title; lizenz = $lizenz
        lizenzUrl = $(if ($m.LicenseUrl) { $m.LicenseUrl.value } else { $null }); urheber = $urheber
        seite = $ii.descriptionurl; breite = $ii.width; hoehe = $ii.height; suche = $zusatz }
      Start-Sleep -Milliseconds 300
    }
    Start-Sleep -Milliseconds 300
  }
  Write-Host ('{0,-15} {1} Kandidaten' -f $id, $gefunden.Count)
  $alle += $gefunden
}
$json = ConvertTo-Json -InputObject @($bisher + $alle) -Depth 3
[IO.File]::WriteAllText($kj, $json, (New-Object Text.UTF8Encoding $false))
if ($nur.Count) { Move-Item -Force $liste (Join-Path $ziel 'nachladen-erledigt.txt') }
Write-Host ''
Write-Host ('Fertig: {0} Bilder in {1}' -f $alle.Count, (Resolve-Path $ziel))
Write-Host 'Bitte Claude Bescheid geben.'
