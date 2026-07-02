# Gamma Calc

Gamma Calc is an internal source tracker and exposure calculator for Ir-192 and Co-60 radiography test sources.

It is intended to run as a small web app on an internal Ubuntu server, so operators can open it from normal Windows machines without installing anything locally.

## Current version

- Track Ir-192 and Co-60 sources with serial number, container number, starting strength in curies, strength date, notes, and active/inactive state.
- Calculate current source strength from radioactive decay.
- Highlight current strength in Element orange in both the calculator and inventory cards.
- Use "New monthly source" to quickly enter the next Ir-192 source from the previous record.
- Mark old sources inactive instead of deleting them.
- Show operators only active sources in the inventory and calculator.
- Show admins the full source history, including inactive old sources.
- Require admin login before source records can be added, edited, deactivated, imported, exported, or deleted.
- Let admins export source history as JSON, CSV for Excel, or a formatted printable report that can be saved as PDF.
- Calculate exposure time from technique curie-minutes, technique distance, actual distance, and current source strength.
- Display exposure time as minutes and seconds, for example `26 mins 42 secs`.
- Support distances in `mm` or `in`.
- Calculate source height for angle exposures from:

```text
source height = sin(angle) x source-to-film distance
```

- Store shared source records in `/var/lib/gamma-calc/gamma-calc-data.json` on Ubuntu.
- Back up the data file before source changes.
- Keep an audit log of source changes in the shared data file.

Exposure time is calculated from:

```text
time minutes = technique Ci min x (actual distance / technique distance)^2 / current Ci
```

## Deployment

### Ubuntu server

Clone the repository on the Ubuntu server:

```bash
git clone https://github.com/Simon-Boman-Smith/Gamma-Calc.git
cd Gamma-Calc
```

Install the systemd service:

```bash
sudo bash deploy/install-ubuntu.sh
```

Then open the app from any Windows machine:

```text
http://<ubuntu-server-ip>:5174/
```

See `deploy/README-UBUNTU.md` for service, firewall, data, backup, and troubleshooting notes.

### Updating the server

After changes are pushed to GitHub, update the Ubuntu server with:

```bash
cd Gamma-Calc
git pull
sudo bash deploy/update-ubuntu.sh
```

## Admin Access

The first-run admin password is:

```text
ChangeMe123!
```

Change it from the Admin controls panel before real use.

You can set a different first-run password with the `GAMMA_CALC_ADMIN_PASSWORD` environment variable before the first data file is created. Once the data file exists, change the password in the app.

## Operator View

Operators can:

- View active sources only.
- See the current source strength clearly highlighted.
- Calculate exposure times.
- Calculate angle exposure source heights.

Operators cannot:

- View inactive old inventory.
- Add, edit, delete, import, export, activate, or deactivate source records.

## Admin View

Admins can:

- View all sources, including inactive old sources.
- Add the new monthly Ir-192 source.
- Mark old sources inactive.
- Edit or delete source records.
- Import JSON source records.
- Export JSON source records.
- Export CSV source records for Excel.
- Print a formatted inventory report, which can be saved as PDF from the browser print dialog.
- Change the admin password.

## Windows Local Preview

For local testing on Windows, run:

```text
run-gamma-calc.cmd
```

Then open:

```text
http://127.0.0.1:5174/
```

You can also open `index.html` directly for a simple local preview, but that mode uses browser-only storage and is not suitable for shared production use.

## Seed constants

- Ir-192 half-life: `73.82` days.
- Co-60 half-life: `5.2714` years, converted with `365.25` days per year.

Check these constants against your company procedure, source certificate, and radiation protection requirements before operational use.
