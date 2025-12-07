from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from db import Base, engine, config
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # später kannst du das präziser machen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datenbanktabellen erzeugen (falls nicht vorhanden)
Base.metadata.create_all(bind=engine)


# --------------------------
# USER AUTH ROUTES
# --------------------------
@app.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Verify creation password
    required_creation_pw = config["security"]["creation_password"]
    if user.creation_password != required_creation_pw:
        raise HTTPException(status_code=403, detail="Invalid creation password")

    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=user.username,
        password_hash=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == form_data.username).first()

    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": db_user.username})

    return {"access_token": token, "token_type": "bearer"}


@app.post("/change-password")
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


# --------------------------
# TODO ROUTES (AUTH REQUIRED)
# --------------------------

@app.get("/todos", response_model=list[TodoOut])
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
    return todos


@app.post("/todos", response_model=TodoOut)
def create_todo(
    todo: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_todo = Todo(
        title=todo.title,
        description=todo.description,
        priority=todo.priority,
        due_date=todo.due_date,
        remind_from=todo.remind_from,
        done=todo.done,
        user_id=current_user.id,
    )
    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)
    return new_todo


@app.put("/todos/{todo_id}", response_model=TodoOut)
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

    for field, value in todo.dict().items():
        setattr(existing, field, value)

    db.commit()
    db.refresh(existing)
    return existing


@app.delete("/todos/{todo_id}")
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
