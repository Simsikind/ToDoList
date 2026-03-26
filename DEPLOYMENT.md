# Deployment Guide for Linux (Ubuntu/Debian)

This guide assumes you have a fresh Linux server and your code is hosted on GitHub.

## 1. System Preparation

Update your system and install necessary packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip postgresql postgresql-contrib git -y
```

## 2. Clone the Repository

```bash
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git ToDoList
sudo chown -R $USER:$USER ToDoList
cd ToDoList
```

## 3. Database Setup (PostgreSQL)

```bash
sudo -u postgres psql
```

Inside the SQL shell:
```sql
CREATE DATABASE todo_db;
CREATE USER todo_user WITH PASSWORD 'ChangeME!';
GRANT ALL PRIVILEGES ON DATABASE todo_db TO todo_user;
\q
```

## 4. Python Dependencies

Install required packages system-wide (or in a venv):
```bash
pip3 install fastapi uvicorn sqlalchemy psycopg python-jose passlib argon2-cffi httpx mcp --break-system-packages
```

## 5. Configuration

Copy the example config and fill in your values:
```bash
cp config.cfg.example config.cfg
nano config.cfg
```

**Required settings:**

```ini
[database]
host = localhost
port = 5432
dbname = todo_db
user = todo_user
password = your_db_password

[security]
jwt_secret = your_strong_random_secret

[app]
base_url = https://todo.yourdomain.com
default_timezone = Europe/Vienna
```

> **Security note:** `jwt_secret` must be a long, random string. Never commit `config.cfg` to version control.

## 6. Systemd Services

### Backend (FastAPI)

```bash
sudo nano /etc/systemd/system/todolist.service
```

```ini
[Unit]
Description=ToDoList Deployment
After=network.target

[Service]
User=YOUR_USER
WorkingDirectory=/var/www/ToDoList/backend
ExecStart=uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### MCP Server (Claude Integration)

```bash
sudo nano /etc/systemd/system/todolist-mcp.service
```

```ini
[Unit]
Description=ToDoList MCP Server
After=network.target todolist.service

[Service]
User=YOUR_USER
WorkingDirectory=/var/www/ToDoList
ExecStart=uvicorn mcp_server:app --host 127.0.0.1 --port 8086
Restart=always
RestartSec=5
Environment=TODO_BASE_URL=http://127.0.0.1:8000

[Install]
WantedBy=multi-user.target
```

Enable and start both services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todolist.service
sudo systemctl enable --now todolist-mcp.service
```

## 7. Cloudflare Tunnel Setup

Install and authenticate `cloudflared`, then create tunnels:
```bash
cloudflared tunnel create todolist
```

Create `/etc/cloudflared/todolist.yml`:
```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/YOUR_USER/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: todo.yourdomain.com
    service: http://127.0.0.1:8000
  - hostname: mcp.yourdomain.com
    service: http://127.0.0.1:8086
  - service: http_status:404
```

Add DNS routes:
```bash
cloudflared tunnel route dns todolist todo.yourdomain.com
cloudflared tunnel route dns todolist mcp.yourdomain.com
```

Create a systemd service for the tunnel and start it:
```bash
sudo nano /etc/systemd/system/cloudflared-todolist.service
```

```ini
[Unit]
Description=Cloudflared Tunnel (todolist)
After=network.target

[Service]
ExecStart=/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/todolist.yml tunnel run
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cloudflared-todolist.service
```

## 8. Claude MCP Integration

The app includes a built-in MCP (Model Context Protocol) server that lets you create and manage todos directly from Claude.

### Setup

1. Open the app and log in
2. Click **API Token** in the toolbar
3. Copy the **MCP Server URL** shown in the modal
4. In [claude.ai](https://claude.ai) go to **Settings → Integrations → MCP Servers → Add**
5. Paste the URL and save

### What Claude can do

Once connected, Claude can:
- **List** your todos
- **Create** todos from natural language, photos, or emails
- **Update** todos (change title, priority, due date, reminder, mark as done)
- **Delete** todos

Each user gets their own personal API token. The token can be regenerated at any time from the API Token modal — existing connections using the old token will immediately become invalid.

### Example prompts

> *"Create a todo to submit my tax return by April 30th, remind me on April 28th at 9am"*

> *"Here's an email from my boss — extract all the tasks and add them as todos with appropriate priorities"*

> *"Show me my open todos"*

> *"Mark todo 5 as done"*

## 9. Mail Service (Optional)

The backend uses an optional local mail module (`mail.send`) for:
- Email verification on registration
- Todo reminders and overdue alerts

Ensure the module is importable by the backend process (e.g. via `PYTHONPATH`).

Set `[app] base_url` in `config.cfg` so verification links point to the correct public URL.
