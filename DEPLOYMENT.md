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

## 5. Frontend Setup (Nginx)
You need to serve the HTML files and proxy requests to the backend.

### Update `app.js`
In production, your API isn't on `localhost:8000` from the user's browser perspective.
Edit `frontend/app.js`:
```javascript
// If using Nginx reverse proxy (recommended):
const API_URL = '/api'; 
// OR if using a specific domain:
// const API_URL = 'https://api.yourdomain.com';
```

### Configure Nginx
Create a new site configuration:
```bash
sudo nano /etc/nginx/sites-available/todolist
```

Paste the following:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    # Serve Frontend Files
    location / {
        root /var/www/todolist/frontend;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Proxy API requests to Backend
    location /api/ {
        # Rewrite /api/login to /login if your backend doesn't use /api prefix
        # But since your backend routes are at root (/login, /todos), we need to be careful.
        # Option A: Proxy everything that isn't a file to backend
        # Option B: Use a specific prefix in backend or Nginx rewrite.
        
        # Simple Reverse Proxy (Forwarding /register to localhost:8000/register)
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Specific routes that match your backend endpoints
    location ~ ^/(login|register|todos|change-password) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/todolist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. Final Steps
1. Ensure your firewall allows port 80 (HTTP).
2. Open your browser and visit your server's IP.
