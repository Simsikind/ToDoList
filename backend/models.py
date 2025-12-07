from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    done = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    due_date = Column(Date, nullable=True)
    remind_from = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    user = relationship("User", backref="todos")