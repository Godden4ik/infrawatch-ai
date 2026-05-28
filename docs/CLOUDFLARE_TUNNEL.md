# Hosting the demo at `infrawatch.exdbots.com` via Cloudflare Tunnel

`cloudflared` runs directly on the host machine and exposes
`localhost:3001` (the frontend container's published port) at a public
hostname. No inbound ports opened, no firewall changes, HTTPS terminated by
Cloudflare. Free, no Zero Trust dashboard required.

## Prerequisites

- `exdbots.com` is on Cloudflare (Active status in the dashboard). If not,
  add it via **Add a site** and switch nameservers at your registrar first.
- macOS (other platforms: substitute the `brew` step).

## One-time setup

### 1. Install `cloudflared`

```bash
brew install cloudflared
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

Opens a browser. Pick the `exdbots.com` zone. Cloudflare drops a cert into
`~/.cloudflared/cert.pem`.

### 3. Create the tunnel

```bash
cloudflared tunnel create infrawatch
```

Cloudflared writes credentials to `~/.cloudflared/<tunnel-uuid>.json` and
prints the UUID. Note it (or `cloudflared tunnel list` to see it later).

### 4. Wire DNS

```bash
cloudflared tunnel route dns infrawatch infrawatch.exdbots.com
```

Creates the `infrawatch.exdbots.com` → `<uuid>.cfargotunnel.com` CNAME
automatically. (Cloudflare-proxied, orange-cloud.)

### 5. Write the tunnel config

```bash
cat > ~/.cloudflared/config.yml <<'EOF'
tunnel: infrawatch
credentials-file: ~/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: infrawatch.exdbots.com
    service: http://localhost:3001
  - service: http_status:404
EOF
```

Replace `<tunnel-uuid>` with the UUID from step 3 (or substitute
`$(cloudflared tunnel list | awk '/infrawatch/{print $1; exit}')`).

### 6. Set the auth gate

```bash
cd /path/to/infrawatch-ai

cat >> .env <<EOF
DEMO_PASSWORD=infrawatch-pjatk-2026
SESSION_SECRET=$(openssl rand -hex 32)
EOF
```

### 7. Bring up the stack and the tunnel

```bash
docker compose --profile demo up -d
cloudflared tunnel run infrawatch
```

Visit `https://infrawatch.exdbots.com` — Cloudflare terminates TLS, the
tunnel routes to `localhost:3001`, the auth middleware redirects to
`/login`, and `DEMO_PASSWORD` lets evaluators in.

## Run as a background service

### macOS (launchd)

```bash
sudo cloudflared service install
# launches at boot; logs to /var/log/com.cloudflare.cloudflared.{out,err}.log
```

Then `sudo launchctl start com.cloudflare.cloudflared` to start now.

### Linux (systemd)

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## Day-to-day

| Action | Command |
|--------|---------|
| Run tunnel in the foreground | `cloudflared tunnel run infrawatch` |
| List tunnels | `cloudflared tunnel list` |
| Check tunnel status | `cloudflared tunnel info infrawatch` |
| Tail launchd logs (macOS) | `tail -f /var/log/com.cloudflare.cloudflared.out.log` |
| Tail systemd logs (Linux) | `journalctl -u cloudflared -f` |
| Stop service | `sudo cloudflared service uninstall` |
| Rotate `DEMO_PASSWORD` | edit `.env`, then `docker compose up -d frontend` |
| Bring app down | `docker compose --profile demo down` |

## Notes

- The tunnel reconnects automatically on network drops. No port forwarding,
  no static IP, no inbound firewall rules.
- `cloudflared` reads `~/.cloudflared/config.yml` by default. Pass
  `--config <path>` to use a different file.
- After changing `DEMO_PASSWORD` or `SESSION_SECRET`, restart the frontend
  container: `docker compose up -d frontend`. The tunnel keeps running.
- Cloudflare can optionally enforce its own access policy on top of the
  password gate via Zero Trust → Access → Applications. The in-app gate
  is sufficient for the demo case.
