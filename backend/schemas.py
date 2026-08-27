from pydantic import BaseModel
from datetime import date, datetime

class UserCreate(BaseModel):
    email: str
    password: str
    timezone: str | None = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdatePassword(BaseModel):
    old_password: str
    new_password: str

class UserOut(BaseModel):
    id: int
    email: str
    is_email_verified: bool
    timezone: str | None = None

    class Config:
        from_attributes = True


class ApiTokenOut(BaseModel):
    api_token: str


class MeOut(BaseModel):
    id: int
    email: str
    is_email_verified: bool
    timezone: str | None = None
    is_admin: bool
    is_owner: bool

    class Config:
        from_attributes = True


class AdminUserOut(BaseModel):
    id: int
    email: str
    is_email_verified: bool
    created_at: datetime
    last_login_at: datetime | None = None
    todos_open: int
    todos_done: int
    is_admin: bool
    is_owner: bool


class AdminSetAdminIn(BaseModel):
    is_admin: bool

class TodoBase(BaseModel):
    title: str
    description: str | None = None
    priority: int = 0
    due_date: date | None = None
    remind_from: datetime | None = None
    done: bool = False
    email_reminder_enabled: bool = False
    tags: list[str] = []
    recurrence_rule: str = "none"  # none | daily | weekly | monthly | weekdays
    recurrence_weekdays: list[int] | None = None  # ISO weekday numbers 1=Mon..7=Sun


class TodoCreate(TodoBase):
    pass


class TodoUpdate(TodoBase):
    pass


class TodoOut(TodoBase):
    # Backend stores remind_from in UTC; output is ISO-8601 with 'Z'
    remind_from: str | None = None
    id: int
    created_at: datetime
    reminder_email_sent_at: datetime | None = None
    overdue_email_sent_at: datetime | None = None
    remind_timezone: str | None = None
    parent_todo_id: int | None = None

    class Config:
        from_attributes = True   # statt orm_mode=True (Pydantic v2)