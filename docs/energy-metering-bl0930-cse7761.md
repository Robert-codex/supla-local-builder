# BL0930 and CSE7761 analysis

This project previously treated `BL0930` and `CSE7761` as aliases of the existing `CSE7766` path. That assumption is not supported by the manufacturers' technical documentation.

## BL0930

- The `BL0930` documentation describes a single-phase metering IC with pulse outputs `CF`, `F1`, `F2` and a reverse-power indicator `REVP`.
- The public material available for `BL0930` describes a pulse-output metering path rather than a UART register protocol compatible with `CSE7766`.

Implication for this project:

- `BL0930` is not compatible with the current `CSE7766` UART driver.
- Proper support requires a dedicated pulse-based driver and a GPIO model based on pulse inputs instead of `FUNCTION_CSE7766_RX`.

## CSE7761

- Chipsea documents `CSE7761` as a high-performance metering IC with one voltage channel and two current channels.
- The user manual describes a register communication interface over `SPI` or `UART`.
- The same manual exposes features that do not map to the current `CSE7766` implementation, including dual current channels and additional measurement/control functions.

Implication for this project:

- `CSE7761` is not protocol-compatible with `CSE7766`.
- Proper support requires a dedicated driver that implements the documented UART/SPI register protocol and a data model for two current channels.

## Consequence in code

The firmware now blocks `SUPLA_BL0930` and `SUPLA_CSE7761` at compile time with explicit messages instead of pretending compatibility with `CSE7766`.

## Sources

- Chipsea CSE7761 User Manual: https://chipsea-obs.obs.cn-south-1.myhuaweicloud.com/uploads/DS_CSE7761_V2.2_en-UserManual-11.2_1670210816.pdf
- Shanghai Belling BL0930 datasheet mirror: https://www.alldatasheet.com/datasheet-pdf/view/164364/BELLING/BL0930.html
