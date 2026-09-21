# Pacifica Demo Guide

V2X Connect — Chrysler Pacifica 2017, Wednesday 9/14 morning demo (autonomous vehicle).

**Demo scope:** show **TIM zone alerts only**. Priority stays disabled on the device — see the checklist at the bottom.

---

## 1. Core features

What the app does today, independent of Android Auto:

| Feature | What it does |
|---|---|
| SDSM vehicle & VRU tracking | Live map markers for nearby vehicles and pedestrians from the CV2X infrastructure feed. |
| Pedestrian crosswalk detection | Alerts when a tracked VRU is inside a crosswalk ahead, derived from the SDSM feed (not a separate fetch). |
| **TIM zone alerts** | Safety / Regulatory / Informational badges when the vehicle enters a mapped zone — this is what's mirrored to Android Auto and what this demo shows. |
| Signal Priority (preemption) | Sends Signal Request Messages to ask for green-light priority at supported intersections. **Off for this demo.** |
| Direction Guide | Lane-level turn guidance from heading + position. |
| Lane overlay | Lane geometry rendered on the map. |
| Closest intersection detection | Polygon-based detection of the nearest instrumented intersection. |

> SPaT (signal phase & timing) exists in the codebase but is currently disabled — nothing reads it right now, so don't expect a live signal-phase display.

### TIM badge categories

`Safety` · `Regulatory` · `Informational`

Each badge carries a severity (1–5), a duration line ("Active until…" / "Active indefinitely"), and the zone's specific sub-type as its title. A badge appears the moment the vehicle enters the zone polygon and clears the moment it exits.

All live data (SDSM, TIM) runs over a public relay on plain internet — no VPN or local network bridge needed, cellular data is enough.

---

## 2. Android Auto on the Pacifica

The 2017 Pacifica's Uconnect only supports **wired** Android Auto — there's no wireless projection on this model year.

### Pairing steps

1. Unlock the Pixel 10 and open **V2X Connect** directly (not Android Auto). Wait for it to fully reach the map screen — GPS lock, no splash screen.
2. **Only now**, connect the Pixel 10 to the Pacifica with a data-capable USB-C cable, into the main USB port near the head unit (not a charge-only port).
3. On the Uconnect screen, select **Android Auto** when it appears.
4. Accept any permission prompts on the phone (first connection only).
5. Confirm the TIM zone screen renders on the head unit before handing off the vehicle.

### ⚠️ Launch order bug

**The app must already be running on the Pixel 10 before Android Auto is launched on the dash.** Connecting to the car first and starting Android Auto before the app is open is a known way to make the car-app session bug out. Treat this as a hard rule, not a maybe.

**If it bugs out anyway:**
1. Unplug the USB cable from the Pacifica.
2. Force-stop V2X Connect on the phone (Settings → Apps → V2X Connect → Force stop).
3. Reopen the app and wait for the map screen again.
4. Reconnect the USB cable and reselect Android Auto on the head unit.

---

## 3. Demo day checklist

Wednesday morning, phone riding in the autonomous vehicle. Goal: show TIM zone alerts on the dash — nothing else.

- [ ] Battery charged, cellular signal confirmed
- [ ] **Settings → Priority → Auto Priority is OFF** — this demo shows TIM zone alerts only; priority requests stay disabled on this device
- [ ] App launched on the Pixel 10 and sitting on the map screen **before** the phone goes into the vehicle
- [ ] USB connected, Android Auto selected, TIM zone screen visible on the head unit
- [ ] Walk the presenter through what a Safety / Regulatory / Informational badge looks like before the AV moves

**Pending:** waiting on a script from a coworker covering what the presenter actually says during the demo. Once that lands, add it as a section 4 — flag anything above that should change to match it.

---
*Last edited 2026-09-14.*
