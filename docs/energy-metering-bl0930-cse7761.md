# BL0930 and CSE7761 analysis

This project previously treated `BL0930` and `CSE7761` as aliases of the existing `CSE7766` path. That assumption is not supported by the manufacturers' technical documentation.

## BL0930

- The `BL0930` documentation describes a single-phase metering IC with pulse outputs `CF`, `F1`, `F2` and a reverse-power indicator `REVP`.
- The public material available for `BL0930` describes a pulse-output metering path rather than a UART register protocol compatible with `CSE7766`.

Implemented scope in this project:

- `BL0930` now uses a dedicated pulse-based driver wired to `CF`.
- The current implementation derives active power and forward active energy from `CF` pulses.
- Voltage, current, apparent power, reactive power and power factor are not exposed because the public documentation used for this implementation does not describe a direct mapping from the available pulse outputs to those quantities in the current GUI-Generic data model.
- The pulse constant is configurable from the GUI as `Imp/kWh`.

## CSE7761

- Chipsea documents `CSE7761` as a high-performance metering IC with one voltage channel and two current channels.
- The user manual describes a register communication interface over `SPI` or `UART`.
- The same manual exposes features that do not map to the current `CSE7766` implementation, including dual current channels and additional measurement/control functions.

Implemented scope in this project:

- `CSE7761` now uses a dedicated UART register driver instead of the `CSE7766` path.
- The current implementation exposes one selected current channel at a time (`IA` or `IB`) together with the shared voltage channel.
- Energy is integrated in software from active power readings and persisted through storage.
- The second current channel is available in the device configuration, but not exported as a second SUPLA energy-meter channel yet.

## Consequence in code

The firmware no longer blocks `SUPLA_BL0930` and `SUPLA_CSE7761` at compile time. Instead it uses dedicated implementations aligned with the communication model described by each datasheet.

## Sources

- Chipsea CSE7761 User Manual: https://chipsea-obs.obs.cn-south-1.myhuaweicloud.com/uploads/DS_CSE7761_V2.2_en-UserManual-11.2_1670210816.pdf
- Shanghai Belling BL0930 datasheet mirror: https://www.alldatasheet.com/datasheet-pdf/view/164364/BELLING/BL0930.html
