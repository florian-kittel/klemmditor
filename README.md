# Klemmditor

Früher Entwicklungsstand zum Konzept. Derzeit existiert ausschließlich ein unabhängiger Domänenkern mit einem minimalen Beispielkatalog; eine Editoroberfläche und die weiteren Release-Funktionen fehlen noch.

Voraussetzung: Node.js 22 oder neuer. Tests ausführen: `node --test`.

Das Koordinatensystem verwendet 10 Einheiten je Noppenabstand und 4 je Plattenhöhe. X/Y sind horizontal, Z ist vertikal; Drehungen erfolgen exakt in Vierteldrehungen. Bounds sind nominale Körper und berücksichtigen noch keine Baugruppen oder Verbindungspunkte.

Offen: vollständiger Katalog und Versionierung, Verbindungen, persistente Projekte, Browseroberfläche, Interaktion, Import/Export, Offline-Betrieb, Performance- und Geräteabnahme sowie alle weiteren Anforderungen des Konzepts. Die bisherigen Tests sind keine Release-Abnahme.
