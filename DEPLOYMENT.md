# Deployment Guide for Linux (Ubuntu/Debian)

This guide assumes you have a fresh Linux server and your code is hosted on GitHub.

## 1. System Preparation
Update your system and install necessary packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv postgresql postgresql-contrib nginx git -y
```

## 2. Clone the Repository
Navigate to the web directory (or your home directory) and clone your project:
```bash
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git todolist
sudo chown -R $USER:$USER todolist
cd todolist
```

## 3. Database Setup (PostgreSQL)
Log in to Postgres and create the database and user as defined in your `config.cfg`.

```bash
sudo -u postgres psql
```

Inside the SQL shell:
```sql
CREATE DATABASE todo_db;
CREATE USER todo_user WITH PASSWORD 'ChangeME!'; -- Use a strong password!
GRANT ALL PRIVILEGES ON DATABASE todo_db TO todo_user;
\q
```

**Note:** You can verify the tables are created later when the backend starts, or run your script manually:
```bash
psql -U todo_user -d todo_db -h localhost -f psql/create_tables.sql
```

## 4. Backend Setup
Set up the Python environment.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure `config.cfg`
Copy the example configuration file and edit it to match your production settings (especially the passwords).
```bash
cp ../config.cfg.example ../config.cfg
nano ../config.cfg
```

**Security note (JWT secret):** You must configure a strong JWT signing secret.

- Option A: set environment variable `TODO_JWT_SECRET` for the systemd service.
- Option B: set `[security] jwt_secret = ...` in `config.cfg`.

**Note (Email login + verification):** Users now register with an email address (no admin creation password). The backend sends a verification email on registration.

- Set `[app] base_url` in `config.cfg` to your public URL (e.g. `https://todo.yourdomain.com`) so verification links are correct behind Cloudflare Tunnel.
- Ensure your local `mail-service` module is available to the backend process (e.g. via `PYTHONPATH` or installing it into the same venv). The backend imports `mail.send`.

### Create a Systemd Service
To keep the backend running in the background, create a service file.

```bash
sudo nano /etc/systemd/system/todolist-backend.service
```

Paste the following (adjust paths/user):
```ini
[Unit]
Description=ToDoList Backend
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/todolist/backend
Environment="PATH=/var/www/todolist/backend/venv/bin"
ExecStart=/var/www/todolist/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000

[Install]
WantedBy=multi-user.target
```

Start and enable the service:
```bash
sudo systemctl start todolist-backend
sudo systemctl enable todolist-backend
```

## 5. Frontend Setup (Directly via Uvicorn)
Since you want to serve the frontend directly from the backend (port 8000) and expose it via Cloudflare Tunnel, you don't need Nginx.

The backend is already configured to serve the `frontend` folder at the root URL `/`.

### Run the Server
Simply run the backend service as described in Step 4.
```bash
sudo systemctl start todolist-backend
```

Your application will be available at `http://localhost:8000`.

## 6. Cloudflare Tunnel Setup
1.  Install `cloudflared` on your server.
2.  Authenticate and create a tunnel.
3.  Configure the tunnel to point to your local service:
    *   **Service:** `http://localhost:8000`
    *   **Hostname:** `todo.yourdomain.com`

Now, when you visit `https://todo.yourdomain.com`, Cloudflare will forward the request to your Uvicorn server, which will serve both the frontend (HTML/JS) and the API.
