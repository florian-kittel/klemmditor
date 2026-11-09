# Ein Haus für den Klemmditor erstellen

Kopiere den folgenden Auftrag vollständig in einen Chat mit einer bildfähigen KI und füge dein Foto hinzu. Ergänze bei Bedarf gewünschte Breite und Tiefe in Noppen. Speichere die Antwort als UTF-8-Datei mit der Endung `.json` und öffne sie im Klemmditor über **Importieren**. Falls die KI eine Datei bereitstellt, kannst du diese direkt herunterladen und importieren.

---

## Auftrag an die KI

Baue das Haus auf dem beigefügten Bild als Klemmbausteinmodell für den Klemmditor nach. Gib mir das Ergebnis als herunterladbare JSON-Datei. Falls du keine Datei erstellen kannst, gib das vollständige JSON in einem einzigen Codeblock aus. Ich möchte es unverändert als `.json` speichern und importieren können. Keine Kommentare, Auslassungen, Platzhalter, Schleifen oder JavaScript im JSON. Jedes Bauteil muss einzeln im Array stehen.

Leite Form, Farben, Fenster, Tür und Dach aus dem Bild ab. Nicht sichtbare Seiten und Maße darfst du sinnvoll ergänzen; nenne deine Annahmen kurz außerhalb des JSON. Wenn keine Maße angegeben sind, wähle ein überschaubares Modell. Verwende nur die unten aufgeführten Bauteile. Wenn die Vorlage mit diesen Teilen nicht exakt umsetzbar ist, vereinfache sie sinnvoll, zum Beispiel mit einem flachen oder abgestuften Dach. Erfinde keine Teile.

### Dateiformat

Das gesamte JSON besteht genau aus einem Projektobjekt mit `name` und `parts`:

```json
{
  "name": "Mein Haus",
  "parts": [
    { "id": "teil-1", "partId": "brick-1x4", "x": 0, "y": 0, "z": 0, "yaw": 0, "color": "#db4437" }
  ]
}
```

Jedes Teil braucht eine eindeutige Zeichenkette als `id`, eine gültige `partId`, ganzzahlige `x`, `y`, `z` und `yaw` sowie eine Farbe als Hex-Zeichenkette wie `#db4437`. Verwende für jedes Teil eine andere ID. `parts` enthält fertige Einzelteile, keine Gruppen oder Bauanweisungen.

### Koordinaten und Drehung

- X und Y sind waagerecht, Z zeigt nach oben. Ein Noppenabstand sind 10 Einheiten, eine Plattenhöhe 4 und eine normale Steinhöhe 12 Einheiten.
- X und Y müssen Vielfache von 10 sein, Z muss ein nicht negatives Vielfaches von 4 sein und bezeichnet die Unterkante. `yaw` ist 0, 1, 2 oder 3 und zählt Vierteldrehungen um Z.
- `x` und `y` bezeichnen den Mittelpunkt des ersten Noppens. Bei `yaw: 0` wachsen Breite und Tiefe vom ersten Noppen aus in positiver X- beziehungsweise Y-Richtung. Eine Breite von 4 belegt also Noppen bei x, x+10, x+20 und x+30.
- Bei `yaw: 1` wird ein lokaler Versatz `(dx, dy)` zu `(-dy, dx)`, bei 2 zu `(-dx, -dy)` und bei 3 zu `(dy, -dx)`. Auch die Lage des ersten Noppens bleibt dabei der Drehpunkt. Beispiel: Ein `brick-1x4` mit `x: 0, y: 0, yaw: 1` belegt die Noppen (0,0), (0,10), (0,20), (0,30).
- Teile dürfen sich berühren und aufeinander stehen, aber nicht im selben Raum überlappen. Plane Fenster- und Türöffnungen frei; setze dort keine Wandsteine hinein. Verwende möglichst versetzte Steinlagen und stütze Dach und Wände ab.

### Verfügbare Teile

Die Maße sind **Breite in X × Tiefe in Y × Höhe in Einheiten** bei `yaw: 0`. Die Bezeichnungen in der ID sind nicht immer in derselben Reihenfolge wie Breite und Tiefe; verwende daher die folgende Liste:

| partId | Breite × Tiefe × Höhe |
|---|---|
| brick-2x4 | 2 × 4 × 12 |
| brick-1x1 | 1 × 1 × 12 |
| brick-1x2 | 2 × 1 × 12 |
| brick-1x4 | 4 × 1 × 12 |
| brick-2x2 | 2 × 2 × 12 |
| plate-2x4 | 2 × 4 × 4 |
| plate-1x1 | 1 × 1 × 4 |
| plate-1x2 | 2 × 1 × 4 |
| plate-1x4 | 4 × 1 × 4 |
| plate-2x2 | 2 × 2 × 4 |
| brick-corner | 2 × 2 × 12, L-förmig |
| plate-corner | 2 × 2 × 4, L-förmig |
| window-4x2 | 4 × 2 × 36 |
| window-2x2 | 2 × 2 × 36 |
| window-4x1 | 4 × 1 × 36 |
| window-2x1 | 2 × 1 × 36 |
| window-4x1-low | 4 × 1 × 12 |
| window-2x1-low | 2 × 1 × 12 |
| window-4x2-low | 4 × 2 × 12 |
| window-2x2-low | 2 × 2 × 12 |
| door-4x2 | 4 × 2 × 72 |
| door-4x1 | 4 × 1 × 72 |

Fenster und Türen sind fertige Einzelteile, keine aus Steinen zusammengesetzten Rahmen. Ihre `color` bestimmt die Rahmenfarbe; Glas beziehungsweise Türblatt haben feste Farben. Bei Ecksteinen liegt die L-Form bei `yaw: 0` auf den lokalen Noppen (0,0), (1,0) und (0,1). Behandle Fenster und Türen bei der Planung vorsichtshalber als vollständig belegte Quader.

Prüfe vor der Ausgabe das JSON, alle IDs, Teilnamen, Rasterwerte und die Positionen auf Überschneidungen. Wenn du Code ausführen kannst, verwende ihn zum Erzeugen und Prüfen der vollständigen Teileliste. Behaupte keine Prüfung, die du nicht durchgeführt hast.
