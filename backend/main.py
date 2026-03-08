from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from pathlib import Path
from datetime import datetime, timedelta, timezone
import secrets
import importlib
import logging
import asyncio
from zoneinfo import ZoneInfo

from db import Base, engine, config, run_migrations, SessionLocal
from models import User, Todo
from schemas import UserCreate, UserLogin, UserOut, TodoCreate, TodoUpdate, TodoOut, UserUpdatePassword
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_db,
    get_current_user,
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

logger = logging.getLogger(__name__)


def _default_timezone_name() -> str:
    try:
        if config.has_section("app") and config["app"].get("default_timezone"):
            return (config["app"]["default_timezone"].strip() or "UTC")
    except Exception:
        pass
    return "UTC"


def _normalize_timezone_name(tz_name: str | None) -> str:
    if not tz_name:
        return _default_timezone_name()
    tz_name = tz_name.strip()
    if not tz_name:
        return _default_timezone_name()
    try:
        ZoneInfo(tz_name)
        return tz_name
    except Exception:
        return _default_timezone_name()


def _local_naive_to_utc_naive(local_dt: datetime, tz_name: str) -> datetime:
    tz = ZoneInfo(tz_name)
    if local_dt.tzinfo is not None:
        # If client sends an aware datetime (e.g. ISO with Z), interpret it as absolute time.
        return local_dt.astimezone(timezone.utc).replace(tzinfo=None)
    return local_dt.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)


def _utc_naive_to_local_naive(utc_dt: datetime, tz_name: str) -> datetime:
    tz = ZoneInfo(tz_name)
    if utc_dt.tzinfo is not None:
        utc_aware = utc_dt.astimezone(timezone.utc)
    else:
        utc_aware = utc_dt.replace(tzinfo=timezone.utc)
    return utc_aware.astimezone(tz).replace(tzinfo=None)


def _utc_naive_to_iso_z(utc_dt: datetime | None) -> str | None:
    if utc_dt is None:
        return None
    return utc_dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _todo_to_out(todo: Todo) -> TodoOut:
    return TodoOut(
        id=todo.id,
        title=todo.title,
        description=todo.description,
        priority=todo.priority,
        due_date=todo.due_date,
        remind_from=_utc_naive_to_iso_z(todo.remind_from),
        done=todo.done,
        email_reminder_enabled=todo.email_reminder_enabled,
        created_at=todo.created_at,
        reminder_email_sent_at=todo.reminder_email_sent_at,
        overdue_email_sent_at=todo.overdue_email_sent_at,
        remind_timezone=todo.remind_timezone,
    )


def _get_mail_send_module():
    try:
        return importlib.import_module("mail.send")
    except Exception as exc:
        logger.exception("Failed to import mail.send")
        raise RuntimeError(
            "Mail module not available. Ensure mail-service is installed/available on PYTHONPATH."
        ) from exc


def _call_mail_fn(
    fn_name: str,
    *,
    to: str,
    subject: str,
    message: str,
    details: dict | None = None,
) -> None:
    mail_send = _get_mail_send_module()
    fn = getattr(mail_send, fn_name, None)
    if not callable(fn):
        raise RuntimeError(f"mail.send.{fn_name} not found")
    fn(to=to, subject=subject, message=message, details=details)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        {
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            (config["app"]["base_url"].rstrip("/") if config.has_section("app") and config["app"].get("base_url") else None),
        }
        - {None}
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datenbanktabellen erzeugen (falls nicht vorhanden)
Base.metadata.create_all(bind=engine)
run_migrations()


def _get_app_base_url(request: Request) -> str:
    # Prefer config override (useful behind proxies/tunnels)
    if config.has_section("app") and config["app"].get("base_url"):
        return config["app"]["base_url"].rstrip("/")
    return str(request.base_url).rstrip("/")


def _send_email(to: str, subject: str, message: str) -> None:
    """Best-effort adapter for the local mail-service described by the user."""

    # Backward-compat generic send
    for fn_name in ("send_message", "send_status", "send_alert", "send_reminder"):
        try:
            _call_mail_fn(fn_name, to=to, subject=subject, message=message)
            return
        except Exception:
            continue
    raise RuntimeError("No compatible send_* function found in mail.send")


def _send_verification_email(to_email: str, verify_url: str) -> None:
    subject = "ToDoList: Bitte E-Mail-Adresse bestätigen"
    message = (
        "Hallo!\n\n"
        "Bitte bestätige deine E-Mail-Adresse, indem du diesen Link öffnest:\n\n"
        f"{verify_url}\n\n"
        "Wenn du dich nicht registriert hast, kannst du diese Mail ignorieren.\n"
    )
    # Verification is a neutral status-style mail
    try:
        _call_mail_fn("send_status", to=to_email, subject=subject, message=message)
    except Exception:
        _send_email(to=to_email, subject=subject, message=message)


def _send_todo_created_email(to_email: str, todo: Todo) -> None:
    subject = "ToDoList: E-Mail-Reminder aktiviert"
    tz_name = _normalize_timezone_name(todo.remind_timezone)
    when = (
        _utc_naive_to_local_naive(todo.remind_from, tz_name).isoformat(sep=" ", timespec="minutes")
        if todo.remind_from
        else "-"
    )
    due = todo.due_date.isoformat() if todo.due_date else "-"
    message = "Für dieses ToDo ist ein E-Mail-Reminder aktiviert."
    details = {
        "Titel": todo.title,
        "Fällig": due,
        "Reminder ab": when,
    }
    if todo.priority is not None:
        details["Priorität"] = str(todo.priority)
    if todo.description:
        details["Beschreibung"] = todo.description

    try:
        _call_mail_fn("send_status", to=to_email, subject=subject, message=message, details=details)
    except Exception:
        _send_email(to=to_email, subject=subject, message=message)


def _send_todo_reminder_email(to_email: str, todo: Todo) -> None:
    subject = f"ToDoList Reminder: {todo.title}"
    due = todo.due_date.isoformat() if todo.due_date else "-"
    tz_name = _normalize_timezone_name(todo.remind_timezone)
    when = (
        _utc_naive_to_local_naive(todo.remind_from, tz_name).isoformat(sep=" ", timespec="minutes")
        if todo.remind_from
        else "-"
    )
    message = "Dieses ToDo ist noch offen."
    details = {
        "Titel": todo.title,
        "Fällig": due,
        "Reminder ab": when,
    }
    if todo.priority is not None:
        details["Priorität"] = str(todo.priority)
    if todo.description:
        details["Beschreibung"] = todo.description
    try:
        _call_mail_fn("send_reminder", to=to_email, subject=subject, message=message, details=details)
    except Exception:
        _send_email(to=to_email, subject=subject, message=message)


def _send_todo_overdue_email(to_email: str, todo: Todo) -> None:
    subject = f"ToDoList OVERDUE: {todo.title}"
    due = todo.due_date.isoformat() if todo.due_date else "-"
    message = "Dieses ToDo ist überfällig und noch nicht erledigt."
    details = {
        "Titel": todo.title,
        "Fällig seit": due,
    }
    if todo.priority is not None:
        details["Priorität"] = str(todo.priority)
    if todo.description:
        details["Beschreibung"] = todo.description
    try:
        _call_mail_fn("send_alert", to=to_email, subject=subject, message=message, details=details)
    except Exception:
        _send_email(to=to_email, subject=subject, message=message)


def _process_todo_email_notifications_once() -> None:
    # Store and compare remind_from in UTC (naive UTC in DB).
    now_utc = datetime.utcnow()

    db = SessionLocal()
    try:
        # Reminders
        reminders = (
            db.query(Todo)
            .join(User, Todo.user_id == User.id)
            .filter(
                Todo.email_reminder_enabled.is_(True),
                Todo.done.is_(False),
                Todo.remind_from.isnot(None),
                Todo.remind_from <= now_utc,
                Todo.reminder_email_sent_at.is_(None),
                User.is_email_verified.is_(True),
            )
            .all()
        )

        for todo in reminders:
            user = db.query(User).filter(User.id == todo.user_id).first()
            if not user:
                continue
            try:
                _send_todo_reminder_email(to_email=user.email, todo=todo)
                todo.reminder_email_sent_at = now_utc
                db.commit()
            except Exception:
                logger.exception("Failed sending reminder for todo_id=%s", todo.id)
                db.rollback()

        # Overdue depends on the user's local date (due_date is a date without tz).
        overdue_candidates = (
            db.query(Todo)
            .join(User, Todo.user_id == User.id)
            .filter(
                Todo.email_reminder_enabled.is_(True),
                Todo.done.is_(False),
                Todo.due_date.isnot(None),
                Todo.overdue_email_sent_at.is_(None),
                User.is_email_verified.is_(True),
            )
            .all()
        )

        for todo in overdue_candidates:
            user = db.query(User).filter(User.id == todo.user_id).first()
            if not user:
                continue
            tz_name = _normalize_timezone_name(user.timezone or todo.remind_timezone)
            local_today = _utc_naive_to_local_naive(now_utc, tz_name).date()
            if not todo.due_date or not (todo.due_date < local_today):
                continue

            try:
                _send_todo_overdue_email(to_email=user.email, todo=todo)
                todo.overdue_email_sent_at = now_utc
                db.commit()
            except Exception:
                logger.exception("Failed sending overdue alert for todo_id=%s", todo.id)
                db.rollback()

    finally:
        db.close()


async def _todo_email_loop() -> None:
    interval_seconds = 60
    while True:
        try:
            await asyncio.to_thread(_process_todo_email_notifications_once)
        except Exception:
            logger.exception("Todo email loop failed")
        await asyncio.sleep(interval_seconds)


@app.on_event("startup")
async def _startup_email_loop():
    asyncio.create_task(_todo_email_loop())


# --------------------------
# USER AUTH ROUTES
# --------------------------
@app.post("/api/register", response_model=UserOut)
def register(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    email = user.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)

    tz_name = _normalize_timezone_name(user.timezone)

    new_user = User(
        email=email,
        password_hash=hash_password(user.password),
        is_email_verified=False,
        email_verification_token=token,
        email_verification_expires_at=expires_at,
        timezone=tz_name,
    )
    db.add(new_user)
    db.flush()

    base_url = _get_app_base_url(request)
    verify_url = f"{base_url}/api/verify-email?token={token}"
    try:
        _send_verification_email(to_email=email, verify_url=verify_url)
    except Exception:
        logger.exception("Failed to send verification email for %s", email)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = (form_data.username or "").strip().lower()
    db_user = db.query(User).filter(User.email == email).first()

    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")

    if not db_user.is_email_verified:
        raise HTTPException(status_code=403, detail="E-Mail-Adresse noch nicht verifiziert")

    token = create_access_token({"sub": db_user.email})

    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/verify-email", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    if not token or len(token) < 10:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = db.query(User).filter(User.email_verification_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Token not found")

    if user.is_email_verified:
        return "<h2>E-Mail-Adresse ist bereits bestätigt.</h2>"

    if not user.email_verification_expires_at or user.email_verification_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    db.commit()
    return "<h2>E-Mail-Adresse bestätigt. Du kannst dieses Tab schließen.</h2>"


@app.post("/api/resend-verification")
def resend_verification(payload: dict, request: Request, db: Session = Depends(get_db)):
    raw_email = (payload.get("email") or "").strip().lower()
    if "@" not in raw_email or "." not in raw_email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    user = db.query(User).filter(User.email == raw_email).first()
    if not user:
        # Avoid user enumeration
        return {"success": True}
    if user.is_email_verified:
        return {"success": True}

    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    user.email_verification_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    base_url = _get_app_base_url(request)
    verify_url = f"{base_url}/api/verify-email?token={token}"
    try:
        _send_verification_email(to_email=user.email, verify_url=verify_url)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    return {"success": True}


@app.post("/api/change-password")
def change_password(
    pw_data: UserUpdatePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(pw_data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    current_user.password_hash = hash_password(pw_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@app.post("/api/set-timezone")
def set_timezone(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz_name = _normalize_timezone_name(payload.get("timezone"))
    current_user.timezone = tz_name
    db.commit()
    return {"timezone": tz_name}


# --------------------------
# TODO ROUTES (AUTH REQUIRED)
# --------------------------

@app.get("/api/todos", response_model=list[TodoOut])
def get_todos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todos = (
        db.query(Todo)
        .filter(Todo.user_id == current_user.id)
        .order_by(Todo.id)
        .all()
    )
    return [_todo_to_out(t) for t in todos]


@app.post("/api/todos", response_model=TodoOut)
def create_todo(
    todo: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz_name = _normalize_timezone_name(current_user.timezone)
    remind_from_utc = None
    remind_tz = None
    if todo.remind_from is not None:
        remind_from_utc = _local_naive_to_utc_naive(todo.remind_from, tz_name)
        remind_tz = tz_name

    new_todo = Todo(
        title=todo.title,
        description=todo.description,
        priority=todo.priority,
        due_date=todo.due_date,
        remind_from=remind_from_utc,
        remind_timezone=remind_tz,
        done=todo.done,
        email_reminder_enabled=todo.email_reminder_enabled,
        user_id=current_user.id,
    )
    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    if new_todo.email_reminder_enabled:
        try:
            _send_todo_created_email(to_email=current_user.email, todo=new_todo)
        except Exception:
            logger.exception("Failed to send todo-created status email (todo_id=%s)", new_todo.id)
    return _todo_to_out(new_todo)


@app.put("/api/todos/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: int,
    todo: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Todo)
        .filter(Todo.id == todo_id, Todo.user_id == current_user.id)
        .first()
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Todo not found")

    data = todo.dict()

    # Normalize remind_from to stored UTC and track timezone
    tz_name = _normalize_timezone_name(current_user.timezone)
    if "remind_from" in data:
        if data["remind_from"] is None:
            data["remind_timezone"] = None
        else:
            data["remind_from"] = _local_naive_to_utc_naive(data["remind_from"], tz_name)
            data["remind_timezone"] = tz_name

    # Reset sent markers if timing/enabled state changes
    if "email_reminder_enabled" in data and data["email_reminder_enabled"] != existing.email_reminder_enabled:
        existing.reminder_email_sent_at = None
        existing.overdue_email_sent_at = None
    if "remind_from" in data and data["remind_from"] != existing.remind_from:
        existing.reminder_email_sent_at = None
    if "due_date" in data and data["due_date"] != existing.due_date:
        existing.overdue_email_sent_at = None

    for field, value in data.items():
        setattr(existing, field, value)

    db.commit()
    db.refresh(existing)
    return _todo_to_out(existing)


@app.delete("/api/todos/{todo_id}")
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Todo)
        .filter(Todo.id == todo_id, Todo.user_id == current_user.id)
        .first()
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Todo not found")

    db.delete(existing)
    db.commit()
    return {"success": True}

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
