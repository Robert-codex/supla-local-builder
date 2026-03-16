# CSE7759B vs CSE7766 (w tym projekcie)

Ten projekt rozdziela `CSE7759B` i `CSE7766` jako dwa odrebne uklady oraz dwa odrebne drivery firmware.

## Najwazniejsze zasady

- `CSE7766` ma osobna sciezke implementacyjna (`SUPLA_CSE7766`) i osobny parser danych.
- `CSE7759B` ma osobna sciezke implementacyjna (`SUPLA_CSE7759B`) i nie wspoldzieli runtime-path z `CSE7766`.
- Preset `Sonoff POWR316` pozostaje czystym presetem sprzetowym; uklad pomiarowy wybierasz recznie podczas builda.
- Usuniete zostaly twarde warianty presetow `POWR316 + CSE7766` oraz `POWR316 + CSE7759B-S`.

## Czego nie mieszac przy integracji

| Obszar | CSE7766 | CSE7759B | Ryzyko bledu |
| --- | --- | --- | --- |
| Sciezka firmware | `SUPLA_CSE7766` | `SUPLA_CSE7759B` | Bledny driver i zle odczyty |
| Mapowanie pinow | wg rewizji plytki dla CSE7766 | wg rewizji plytki dla CSE7759B | Brak danych lub niestabilne pomiary |
| Kalibracja | osobne mnozniki/parametry | osobne mnozniki/parametry | Przesuniete wyniki V/A/W/Wh |
| Preset buildera | `Sonoff POWR316` + reczny wybor metera | `Sonoff POWR316` + reczny wybor metera | Budowanie z niepoprawnym ukladem |

## Checklista po flashu

1. Potwierdz wybrany uklad (`CSE7766` albo `CSE7759B`) przed kompilacja firmware.
2. Zweryfikuj pinout dla konkretnej rewizji PCB, nie "na pamiec" z innego wariantu.
3. Ustaw kalibracje w `Ustawienia urzadzenia -> Inne -> Calibration`.
4. Porownaj odczyty z referencyjnym watomierzem przy znanym obciazeniu.
