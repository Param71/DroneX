# DroneX Testing Checklist

## User Flow
- [ ] Loads `garage.html` first.
- [ ] Entering pilot name and choosing mode correctly navigates to `mode-select.html`.
- [ ] Clicking "RACE MODE" navigates to `game.html`.
- [ ] Clicking "FREEFLY" navigates to `freefly.html`.

## Freefly Mode
- [ ] Countryside scenery loads (rolling hills, river, trees, sunset).
- [ ] No rings present.
- [ ] Back button properly returns to mode select.

## Race Mode
- [ ] Rings are correctly spawned.
- [ ] Rings do not spawn inside buildings.
- [ ] Timer works.
- [ ] Results screen appears at end.
- [ ] Leaderboard submission works and rank is displayed.
- [ ] Try Again resets mission.

## Phone Controller Pairing
- [ ] 4-digit code is properly generated on Garage page.
- [ ] Visiting `/controller.html` shows overlay asking for code.
- [ ] Submitting correct code hides overlay and connects.
- [ ] Session persists across page reloads using `sessionStorage`.

## Gameplay
- [ ] Drone restarts position after crashing.
- [ ] Drone is prevented from clipping through buildings.
- [ ] FPV mode toggles correctly.
- [ ] Touch Yaw works via background swipe.
- [ ] Performance toggle (High/Low) correctly modifies shadows.

## Security
- [ ] Express server has Helmet/CSP integrated.
- [ ] `index.js` sanitizes `/api/leaderboard` inputs.
- [ ] Railway `port` configuration correctly reads `process.env.PORT`.
