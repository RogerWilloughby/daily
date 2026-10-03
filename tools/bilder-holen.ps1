# DAILY – Kandidaten für das Album „Vögel“ laden (Phase 3c). Gestartet über bilder-holen.cmd im Projektordner.
# Sucht je Vogel auf Wikimedia Commons Fotos mit Lizenz CC0 oder gemeinfrei (geprüft über LicenseShortName),
# querformatig und mindestens 1000 px breit, und lädt bis zu 3 Kandidaten in 1200 px Breite nach public\bilder-roh\voegel.
# Dazu kandidaten.json mit Titel, Lizenz, Urheber und Dateiseite. Claude wählt aus, verkleinert und legt die Lizenzliste an.
# Warum hier: Die Cloud und die Arbeits-VM von Claude erreichen Wikimedia nicht (Netz auf GitHub/npm beschränkt).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ziel = Join-Path $PSScriptRoot '..\public\bilder-roh\voegel'
New-Item -ItemType Directory -Force -Path $ziel | Out-Null
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
  $wiss = $arten[$id]; $gefunden = @()
  foreach ($zusatz in $suchen) {
    if ($gefunden.Count -ge 3) { break }
    $q = '"' + $wiss + '" filetype:bitmap ' + $zusatz
    $url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15' +
      '&gsrsearch=' + [uri]::EscapeDataString($q) + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200' +
      '&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl'
    try { $r = Invoke-RestMethod -Uri $url -Headers $kopf -UseBasicParsing } catch { Write-Host "  $id - Suche fehlgeschlagen: $($_.Exception.Message)"; continue }
    if (-not $r.query) { continue }
    foreach ($p in ($r.query.pages.PSObject.Properties.Value | Sort-Object index)) {
      if ($gefunden.Count -ge 3) { break }
      $ii = $p.imageinfo[0]; $m = $ii.extmetadata
      $lizenz = if ($m.LicenseShortName) { $m.LicenseShortName.value } else { '' }
      if ($lizenz -notmatch $erlaubt) { continue }
      if ($ii.width -lt 1000 -or $ii.width -le $ii.height) { continue }
      if ($gefunden | Where-Object { $_.titel -eq $p.title }) { continue }
      $quelle = if ($ii.thumburl) { $ii.thumburl } else { $ii.url }
      $endung = [IO.Path]::GetExtension(([uri]$quelle).AbsolutePath).ToLower()
      $datei = '{0}-{1}{2}' -f $id, ($gefunden.Count + 1), $endung
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
$json = ConvertTo-Json -InputObject @($alle) -Depth 3
[IO.File]::WriteAllText((Join-Path $ziel 'kandidaten.json'), $json, (New-Object Text.UTF8Encoding $false))
Write-Host ''
Write-Host ('Fertig: {0} Bilder in {1}' -f $alle.Count, (Resolve-Path $ziel))
Write-Host 'Bitte Claude Bescheid geben.'
