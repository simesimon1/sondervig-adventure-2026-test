# Figurenprototyp v0.15

Originale GLB-Modelle für Simon, Swantje und Ida, mit je einem Skelett (18 Knochen) und den Animationen `Idle` und `Walk`. Sie werden reproduzierbar mit `tools/build-characters.py` in Blender erzeugt. Alle Texturen sind kleine generierte Gewebestrukturen im GLB; keine Bilder müssen nachgeladen werden.

Die vom Nutzer im Chat bereitgestellten Charakterkarten dienen als gestalterische Referenz. Weder diese Karten noch Familienfotos oder Ausschnitte daraus sind Bestandteil des Repositories oder der GLBs. Es werden keine zuvor vorhandenen Familienmodelle behauptet. Diese eigenen Modelle sind ein erster stilisierter Durchgang, keine fotorealistische Rekonstruktion der abgebildeten Personen.

- Simon: 1,88 m nach ursprünglichem Projektauftrag; die Karte nennt abweichend ca. 1,84 m. Braune Jacke mit hellem Kragen, gelbes Trikot, Jeans, helle Sneaker, kurze braune Haare und Bart.
- Swantje: 1,87 m, cremefarbene Fleecejacke und weite Hose, lange braune Haare.
- Ida: 1,05 m, rosa Hoodie, dunkle Leggings, rosa Sneaker, blonder Pferdeschwanz. Eigene kindliche Größenverhältnisse, keine bloß gleichmäßig verkleinerte Erwachsenenfigur.
- Tilda: Karte als Konzept vorhanden; in diesem Durchgang noch kein Modell und keine neue Baby-/Kinderwagenfunktion.

`manifest.json` enthält die tatsächlichen Dateigrößen und Geometriebudgets. Die drei GLBs umfassen zusammen ca. 3,4 MB ohne HTTP-Kompression. Die Stand-/Gehclips werden weich überblendet. Eine einfache Sohlenkorrektur verhindert, dass die Animation die Füße durch die lokale Bodenebene drückt; sie ersetzt keine vollständige Bein-IK auf unebenem Gelände.

Für realistischere Nahansichten brauchen besonders Gesichtstopologie, Hautoberflächen, Haarformen und Kleidungsfalten weitere künstlerische Arbeit. Die Zielbilder sind eine Stilreferenz und keine Behauptung über bereits erreichte Modellqualität.
