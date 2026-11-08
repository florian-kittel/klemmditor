# Klemmditor

Früher Entwicklungsstand zum Konzept. Eine erste 3D-Oberfläche bietet einen kleinen Katalog, Platzieren auf Oberflächen oder fester Bauhöhe, Auswahl, Löschen und Undo/Redo. Der Stand ist noch kein fertiger Editor.

Voraussetzung: Node.js 22 oder neuer. Installation: `npm ci`. Entwicklung: `npm run dev`. Produktionsbuild: `npm run build`. Vorhandene Domänentests: `npm test`.

Das Koordinatensystem verwendet 10 Einheiten je Noppenabstand und 4 je Plattenhöhe. X/Y sind horizontal, Z ist vertikal; Drehungen erfolgen exakt in Vierteldrehungen. Bounds sind nominale Körper und berücksichtigen noch keine Baugruppen oder Verbindungspunkte.

Fenster (drei Steinhöhen) und Tür (sechs Steinhöhen) sind starre Baugruppen. Ihre Rahmenfarbe ist wählbar; Scheibe und Türblatt haben vorerst feste Farben und werden getrennt in der Materialliste geführt. Das Oberflächensnapping verwendet die Oberkante des sichtbaren getroffenen Teils; Verbindungsprüfung und Hysterese sind noch nicht umgesetzt.

Der aktuelle Einzelprojektstand wird synchron in localStorage gesichert und kann als JSON exportiert bzw. ersetzt werden. Dies ist eine vorläufige Lösung, keine Umsetzung des im Konzept geforderten IndexedDB-Datenverlustschutzes. Mit V/B wird zwischen Auswahl und Setzen gewechselt. Beim Setzen dreht das Mausrad oder R die Vorschau; Strg beim Klicken setzt denselben Stein erneut. Escape oder ein Rechtsklick hebt die Auswahl auf. Die mittlere Maustaste verschiebt und Ziehen mit der rechten Maustaste dreht die Kamera; außerhalb des Setzmodus zoomt das Mausrad.

Offen: vollständiger Katalog und Versionierung, Verbindungen, sichere Projektverwaltung, Verschieben und Gruppen, Touch-Bestätigung, CSV/PNG, Offline-Betrieb, umfassende Importprüfung, Performance- und Geräteabnahme sowie weitere Anforderungen des Konzepts. Die bisherigen Tests sind keine Release-Abnahme. Auf Wunsch werden umfangreiche automatisierte Tests zunächst zurückgestellt.
