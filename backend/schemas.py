from pydantic import BaseModel
from datetime import date, datetime

class UserCreate(BaseModel):
    username: str
    password: str
    creation_password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdatePassword(BaseModel):
    old_password: str
    new_password: str

class UserOut(BaseModel):
    id: int
    username: str

    class Config:
        orm_mode = True

class TodoBase(BaseModel):
    title: str
    description: str | None = None
    priority: int = 0
    due_date: date | None = None
    remind_from: datetime | None = None
    done: bool = False


class TodoCreate(TodoBase):
    pass


class TodoUpdate(TodoBase):
    pass


class TodoOut(TodoBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True   # statt orm_mode=True (Pydantic v2)