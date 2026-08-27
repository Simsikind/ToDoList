from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Table, UniqueConstraint, func
from sqlalchemy.orm import relationship
from db import Base

todo_tags = Table(
    "todo_tags",
    Base.metadata,
    Column("todo_id", Integer, ForeignKey("todos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    email_verification_token = Column(String, nullable=True, index=True)
    email_verification_expires_at = Column(DateTime, nullable=True)
    timezone = Column(String, nullable=True)
    api_token = Column(String, unique=True, nullable=True, index=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    done = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    due_date = Column(Date, nullable=True)
    remind_from = Column(DateTime, nullable=True)
    remind_timezone = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    email_reminder_enabled = Column(Boolean, nullable=False, default=False)
    reminder_email_sent_at = Column(DateTime, nullable=True)
    overdue_email_sent_at = Column(DateTime, nullable=True)

    recurrence_rule = Column(String(16), nullable=False, default="none")
    recurrence_weekdays = Column(String(20), nullable=True)
    parent_todo_id = Column(Integer, ForeignKey("todos.id"), nullable=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    user = relationship("User", backref="todos")
    tags = relationship("Tag", secondary=todo_tags, backref="todos")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(50), nullable=False)