# Self-hosting PluginWorld with a custom domain

Target setup: GoDaddy domain → server IP → existing nginx reverse-proxies
`pluginworld.ai` to the Next.js app on `127.0.0.1:3000`, with free HTTPS via
Let's Encrypt.

## 1. DNS at GoDaddy

GoDaddy → My Products → your domain → **DNS / Manage DNS**, add two records:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<your server IP>` | 600 |
| A | `www` | `<your server IP>` | 600 |

Delete any conflicting `A`/`AAAA`/`CNAME` records for `@` and `www`
(GoDaddy's default "Parked" record must go). Propagation is usually minutes.

Verify: `dig +short pluginworld.ai` and `dig +short www.pluginworld.ai`
both return the server IP.

## 2. nginx virtual host (on the server)

```sh
sudo cp deploy/nginx-pluginworld.conf /etc/nginx/conf.d/pluginworld.conf
sudo nginx -t && sudo systemctl reload nginx
```

This is a name-based virtual host — it only answers for `pluginworld.ai` /
`www.pluginworld.ai` and does not disturb other sites on the same nginx.

## 3. HTTPS (Let's Encrypt)

Open ports **80 and 443** in the cloud security group first
(Alibaba Cloud: ECS → Security Group → add inbound rules for 80/443).

```sh
sudo apt install -y certbot python3-certbot-nginx   # Debian/Ubuntu
sudo certbot --nginx -d pluginworld.ai -d www.pluginworld.ai --redirect
```

Certbot adds the 443 block, installs the certificate and sets up
auto-renewal (`certbot renew` timer). Done — the site is live at
`https://www.pluginworld.ai`.

## 4. Keep the app running (if not already)

```sh
# from the repo directory on the server
npm ci && npm run build
# either pm2:
pm2 start npm --name pluginworld -- start && pm2 save
# or a systemd unit pointing at `npm start` in the repo directory
```

## 5. Updating the deployment

```sh
git pull
npm ci && npm run build
pm2 restart pluginworld   # or systemctl restart pluginworld
```

The GitHub Actions daily scan commits fresh snapshot data to the repo, so a
daily `git pull && npm run build && pm2 restart` cron on the server keeps the
listing current. Alternatively configure `DATABASE_URL` (Postgres mode) and
let the Actions workflow upsert the database directly — then no rebuild is
needed for data updates and `REVALIDATE_SECRET`/`SITE_URL` trigger ISR.
