# Gamma Calc on Ubuntu

This is the recommended deployment when Windows app policies block portable executables.

## Install

Copy the Gamma Calc folder to the Ubuntu server, then run:

```bash
cd Gamma-Calc
sudo bash deploy/install-ubuntu.sh
```

The app will run as a `systemd` service:

```bash
systemctl status gamma-calc --no-pager
```

Open it from Windows machines at:

```text
http://<ubuntu-server-ip>:5174/
```

## Data

Production data is stored outside the app folder:

```text
/var/lib/gamma-calc/gamma-calc-data.json
/var/lib/gamma-calc/backups/
```

Back this folder up with your normal server backup routine.

## Admin Password

The first-run password is:

```text
ChangeMe123!
```

Change it from the Admin controls panel after first login.

To set a different first-run password, edit `/etc/systemd/system/gamma-calc.service` before first start and add:

```ini
Environment=GAMMA_CALC_ADMIN_PASSWORD=your-long-password-here
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart gamma-calc
```

This only affects the first data file creation. Once `/var/lib/gamma-calc/gamma-calc-data.json` exists, change the password in the app.

## Update

Copy the new files over the old Gamma Calc folder, then run:

```bash
sudo bash deploy/update-ubuntu.sh
```

## Optional Firewall

If UFW is enabled:

```bash
sudo ufw allow from <your-shop-floor-subnet> to any port 5174 proto tcp
```

Example:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 5174 proto tcp
```
