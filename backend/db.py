import configparser
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import timezone
from zoneinfo import ZoneInfo

config = configparser.ConfigParser()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, "config.cfg")
config.read(CONFIG_PATH)

DB_HOST = config["database"]["host"]
DB_PORT = config["database"]["port"]
DB_NAME = config["database"]["dbname"]
DB_USER = config["database"]["user"]
DB_PASS = config["database"]["password"]

DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def run_migrations():
	"""Lightweight, idempotent migrations for small deployments.

	This project doesn't use Alembic. We keep minimal migrations here so updates
	can be deployed without manual SQL in most cases.
	"""

	with engine.begin() as conn:
		inspector = inspect(conn)
		if not inspector.has_table("users"):
			return

		columns = {col["name"] for col in inspector.get_columns("users")}

		# Rename legacy column
		if "username" in columns and "email" not in columns:
			conn.execute(text("ALTER TABLE users RENAME COLUMN username TO email"))

		# Refresh column set after potential rename
		columns = {col["name"] for col in inspector.get_columns("users")}

		if "is_email_verified" not in columns:
			conn.execute(
				text(
					"ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT FALSE"
				)
			)

		if "email_verification_token" not in columns:
			conn.execute(
				text(
					"ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255)"
				)
			)

		if "email_verification_expires_at" not in columns:
			conn.execute(
				text(
					"ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP"
				)
			)

		if "timezone" not in columns:
			conn.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(64)"))

		if "api_token" not in columns:
			conn.execute(text("ALTER TABLE users ADD COLUMN api_token VARCHAR(255) UNIQUE"))

		if "is_admin" not in columns:
			conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))

		if "last_login_at" not in columns:
			conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP"))

		# --- todos ---
		if inspector.has_table("todos"):
			todo_columns = {col["name"] for col in inspector.get_columns("todos")}

			if "remind_timezone" not in todo_columns:
				conn.execute(text("ALTER TABLE todos ADD COLUMN remind_timezone VARCHAR(64)"))

			if "email_reminder_enabled" not in todo_columns:
				conn.execute(
					text(
						"ALTER TABLE todos ADD COLUMN email_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE"
					)
				)

			if "reminder_email_sent_at" not in todo_columns:
				conn.execute(
					text(
						"ALTER TABLE todos ADD COLUMN reminder_email_sent_at TIMESTAMP"
					)
				)

			if "overdue_email_sent_at" not in todo_columns:
				conn.execute(
					text(
						"ALTER TABLE todos ADD COLUMN overdue_email_sent_at TIMESTAMP"
					)
				)

			if "recurrence_rule" not in todo_columns:
				conn.execute(
					text(
						"ALTER TABLE todos ADD COLUMN recurrence_rule VARCHAR(16) NOT NULL DEFAULT 'none'"
					)
				)

			if "recurrence_weekdays" not in todo_columns:
				conn.execute(text("ALTER TABLE todos ADD COLUMN recurrence_weekdays VARCHAR(20)"))

			if "parent_todo_id" not in todo_columns:
				conn.execute(
					text(
						"ALTER TABLE todos ADD COLUMN parent_todo_id INTEGER REFERENCES todos(id)"
					)
				)

		# --- tags ---
		if not inspector.has_table("tags"):
			conn.execute(
				text(
					"""
					CREATE TABLE tags (
						id SERIAL PRIMARY KEY,
						user_id INTEGER NOT NULL REFERENCES users(id),
						name VARCHAR(50) NOT NULL,
						UNIQUE(user_id, name)
					)
					"""
				)
			)
		else:
			# Base.metadata.create_all() (called before run_migrations()) may have
			# already created this table from the ORM model on a fresh install,
			# without the unique constraint if it predates it being added there.
			existing_unique = {
				tuple(sorted(uc["column_names"]))
				for uc in inspector.get_unique_constraints("tags")
			}
			if tuple(sorted(["user_id", "name"])) not in existing_unique:
				conn.execute(
					text("ALTER TABLE tags ADD CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)")
				)

		if not inspector.has_table("todo_tags"):
			conn.execute(
				text(
					"""
					CREATE TABLE todo_tags (
						todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
						tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
						PRIMARY KEY (todo_id, tag_id)
					)
					"""
				)
			)

	# Data backfill (needs ORM-ish logic; run outside engine.begin)
	default_tz = "UTC"
	try:
		if config.has_section("app") and config["app"].get("default_timezone"):
			default_tz = config["app"]["default_timezone"].strip() or default_tz
	except Exception:
		pass

	db = SessionLocal()
	try:
		# Set default timezone for users that don't have one yet
		db.execute(
			text("UPDATE users SET timezone = :tz WHERE timezone IS NULL"),
			{"tz": default_tz},
		)

		# Convert legacy todos.remind_from (stored as naive local time) into UTC naive
		# and fill remind_timezone when missing.
		rows = db.execute(
			text(
				"SELECT t.id, t.remind_from, t.remind_timezone, u.timezone "
				"FROM todos t JOIN users u ON u.id=t.user_id "
				"WHERE t.remind_from IS NOT NULL AND t.remind_timezone IS NULL"
			)
		).fetchall()

		for todo_id, remind_from, remind_tz, user_tz in rows:
			tz_name = (user_tz or default_tz or "UTC").strip()
			try:
				tz = ZoneInfo(tz_name)
			except Exception:
				tz = ZoneInfo("UTC")
				tz_name = "UTC"

			# Interpret stored remind_from as local time in tz_name
			local_dt = remind_from.replace(tzinfo=tz)
			utc_dt = local_dt.astimezone(timezone.utc).replace(tzinfo=None)

			db.execute(
				text(
					"UPDATE todos SET remind_from=:utc_dt, remind_timezone=:tz WHERE id=:id"
				),
				{"utc_dt": utc_dt, "tz": tz_name, "id": todo_id},
			)

		# One-time admin bootstrap from config.cfg: only ever flips false -> true,
		# never revokes. Once an account is admin, ongoing grants/revokes are
		# managed live via the /admin UI (owner-only) and stored in the DB.
		try:
			raw_admin_emails = config["app"].get("admin_emails", "") if config.has_section("app") else ""
		except Exception:
			raw_admin_emails = ""
		admin_emails = [e.strip().lower() for e in raw_admin_emails.split(",") if e.strip()]
		if admin_emails:
			db.execute(
				text("UPDATE users SET is_admin = TRUE WHERE lower(email) = ANY(:emails) AND is_admin = FALSE"),
				{"emails": admin_emails},
			)

		db.commit()
	finally:
		db.close()
