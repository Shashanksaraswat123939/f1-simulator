# F1 Simulator

A Formula 1 racing simulator for the browser, built with Three.js. Every car, circuit, texture, sound and voice line is generated in code at load time, so there are no asset files in this repository.

**▶ Play: https://shashanksaraswat123939.github.io/f1-simulator/**

Works on desktop (keyboard or gamepad) and on phones and tablets with on-screen controls. Press Enter or tap on the title screen, pick a driver, choose a circuit and start.

## What's in it

- 2026 season line-up: 11 teams, 22 drivers, with team colours and numbers.
- Races, time trial and a Grand Prix weekend (qualifying, then race). Dry, wet and dynamic weather.
- Automatic gearbox, ERS battery modes (harvest, balanced, overtake), DRS and a pit limiter.
- Race director: start lights, lap and sector timing, pit stops with tyre changes, yellow and blue flags, track-limit and collision penalties, virtual safety car and safety car.
- **Event frequency** setting (off, normal, frequent, chaos) controls how often random safety cars, VSCs, yellow flags, failures and rain showers happen.
- On-screen controls: steer arrows, gas, brake, battery mode, boost, DRS, pit limiter, pit and pause, with an AUTO / MANUAL switch. Auto is deliberately mid-strength.
- Broadcast-style HUD with timing tower, minimap, sector times, ERS and DRS indicators, and a pit multi-function display.
- Cameras: chase, far chase, T-cam, cockpit, nose, TV, helicopter, plus replay.
- Quality presets from low to ultra.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Steer | A / D or arrows | ◀ ▶ |
| Throttle / brake | W / S | GAS / BRAKE |
| DRS | Space (hold) | DRS |
| ERS overtake | R (hold) | BOOST |
| ERS mode | V | BATTERY |
| Pit limiter | L | PIT LIMITER |
| Request pit | P | PIT |
| Camera | C | |
| Pause | Esc | PAUSE |

Add `?touch=1` to the address to show the touch controls on a desktop browser.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5200
npm run build
```

## Notes

Team and driver names are used for identification only. This is a fan project, not affiliated with or endorsed by Formula 1 or any team, driver or sponsor. Based on the MIT-licensed Apex Formula by BridgeMind; see [LICENSE](LICENSE).
