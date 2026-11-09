# Klemmditor

**Live-Version:** https://florian-kittel.github.io/klemmditor/ – lässt sich im Browser (Chrome/Edge: Install-Symbol in der Adressleiste) als App installieren.

Früher Entwicklungsstand zum Konzept. Eine erste 3D-Oberfläche bietet einen kleinen Katalog, Platzieren auf Oberflächen oder fester Bauhöhe, Auswahl, Löschen und Undo/Redo. Der Stand ist noch kein fertiger Editor.

Voraussetzung: Node.js 22 oder neuer. Installation: `npm ci`. Entwicklung: `npm run dev`. Produktionsbuild: `npm run build`. Vorhandene Domänentests: `npm test`.

Ansichten: Isometrisch, Draufsicht und flache Seitenansicht. In der Seitenansicht drehen die Pfeilknöpfe um jeweils 90° zwischen den vier Seiten; die Kamera bleibt auf gleicher Höhe. Die Ausgangsrichtung lässt sich über die Winkelanzeige wiederherstellen. Ziehen im freien Arbeitsbereich verschiebt auch die Seitenansicht.

Rendering: Körper und Noppen werden je Steintyp zusammengefasst und ihre Geometrien geteilt. Ein unselektierter 2×4-Stein benötigt zwei statt ursprünglich neun Zeichenaufrufe, einschließlich einer gemeinsamen Noppenkontur für die Draufsicht; Fenster und Türen drei. Modelländerungen ersetzen nur betroffene Renderobjekte, Vorschauen werden bei unveränderter Pose wiederverwendet. Im Stillstand wird kein weiterer Frame angefordert. Das sind strukturelle Optimierungen; eine FPS-Messung auf dem Zielgerät steht noch aus.

Das Koordinatensystem verwendet 10 Einheiten je Noppenabstand und 4 je Plattenhöhe. X/Y sind horizontal, Z ist vertikal; Drehungen erfolgen exakt in Vierteldrehungen. Bounds sind nominale Körper und berücksichtigen noch keine Baugruppen oder Verbindungspunkte.

Fenster (drei Steinhöhen) und Tür (sechs Steinhöhen) sind starre Baugruppen. Ihre Rahmenfarbe ist wählbar; Scheibe und Türblatt haben vorerst feste Farben und werden getrennt in der Materialliste geführt. Das Oberflächensnapping verwendet die Oberkante des sichtbaren getroffenen Teils; Verbindungsprüfung und Hysterese sind noch nicht umgesetzt.

Projekte werden einzeln in localStorage gesichert. Über „Neu“ entsteht ein leeres Projekt, „Öffnen“ zeigt lokale Projekte mit Namen, Teilezahl und Speicherzeit. Der zuletzt geöffnete Stand wird beim nächsten Start geladen. Der bisherige Einzelprojektstand wird automatisch übernommen und als Migrationsbackup behalten. Vor einem Projektwechsel wird gespeichert; bei einem Speicherfehler wird der Wechsel blockiert. JSON-Import legt ein zusätzliches Projekt an. Undo/Redo gilt für das jeweils geöffnete Projekt und wird beim Wechsel zurückgesetzt. Dies ist eine vorläufige Lösung, keine Umsetzung des im Konzept geforderten IndexedDB-Datenverlustschutzes. Mit V/B wird zwischen Auswahl und Setzen gewechselt. Im Auswahlmodus lässt sich ein Stein durch Ziehen versetzen; eine ungültige Position oder Escape bricht die Bewegung ab. Beim Setzen dreht das Mausrad oder R die Vorschau; Strg beim Klicken setzt denselben Stein erneut. Escape oder ein Rechtsklick hebt die Auswahl auf. Die mittlere Maustaste verschiebt und Ziehen mit der rechten Maustaste dreht die Kamera; außerhalb des Setzmodus zoomt das Mausrad.

Offen: vollständiger Katalog und Versionierung, Verbindungen, sichere Projektverwaltung, Verschieben und Gruppen, Touch-Bestätigung, CSV/PNG, Offline-Betrieb, umfassende Importprüfung, Performance- und Geräteabnahme sowie weitere Anforderungen des Konzepts. Die bisherigen Tests sind keine Release-Abnahme. Auf Wunsch werden umfangreiche automatisierte Tests zunächst zurückgestellt.
