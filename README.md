# Gamma Calc

Gamma Calc tracks Ir-192 and Co-60 test sources, calculates current source strength from radioactive decay, and estimates exposure time from technique curie-minutes and source-to-film distance.

## Current version

- Add Ir-192 or Co-60 sources with serial number, container number, starting strength in curies, and strength date.
- Mark old sources inactive and use "New monthly source" to enter the next Ir-192 source quickly.
- Calculate current strength from half-life decay.
- Calculate exposure time from:

```text
time minutes = technique Ci min x (actual distance / technique distance)^2 / current Ci
```

- Calculate source height for angle exposures from:

```text
source height = sin(angle) x source-to-film distance
```

- Export and import source records as JSON.
- Run as a portable shared-drive app with a small built-in server.
- Store shared source records in `data/gamma-calc-data.json`.
- Require admin login before source records can be added, edited, deactivated, imported, exported, or deleted.
- Back up the data file before source changes in `data/backups/`.
- Keep an audit log of source changes in the shared data file.

## Run

### Ubuntu server

For the recommended internal web deployment, copy this folder to the Ubuntu server and run:

```bash
sudo bash deploy/install-ubuntu.sh
```

Then open the app from any Windows machine:

```text
http://<ubuntu-server-ip>:5174/
```

See `deploy/README-UBUNTU.md` for service, firewall, data, backup, and update notes.

### Windows local/shared-drive preview

For the shared-drive version, run:

```text
run-gamma-calc.cmd
```

Then open:

```text
http://127.0.0.1:5174/
```

The first-run admin password is:

```text
ChangeMe123!
```

Before real use, unlock the app and change this from the Admin controls panel. You can also set a different first-run password with the `GAMMA_CALC_ADMIN_PASSWORD` environment variable before the first data file is created.

For a public/shared drive, keep the full `Gamma-Calc` folder together:

```text
Gamma-Calc/
  app.js
  index.html
  styles.css
  server.mjs
  run-gamma-calc.cmd
  data/
    gamma-calc-data.json
    backups/
```

Normal users can calculate and view active sources. Admins unlock editing from the Admin controls panel.

You can still open `index.html` directly for a local preview, but that mode uses browser-only storage and is not suitable for shared production use.

## Seed constants

- Ir-192 half-life: `73.82` days.
- Co-60 half-life: `5.2714` years, converted with `365.25` days per year.

Check these constants against your company procedure, source certificate, and radiation protection requirements before operational use.
