from datetime import datetime, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import os

from db import SessionLocal, config
from models import User


def _load_jwt_secret() -> str | None:
    env_secret = os.getenv("TODO_JWT_SECRET")
    if env_secret:
        return env_secret

    try:
        if config.has_section("security") and config["security"].get("jwt_secret"):
            return config["security"]["jwt_secret"].strip() or None
    except Exception:
        pass

    return None


SECRET_KEY = _load_jwt_secret()
if not SECRET_KEY:
    raise RuntimeError(
        "JWT secret not configured. Set env TODO_JWT_SECRET or add [security] jwt_secret in config.cfg"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


# -------------------------
# DATABASE SESSION
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------
# PASSWORD FUNCTIONS
# -------------------------
def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)


# -------------------------
# TOKEN FUNCTIONS
# -------------------------
def create_access_token(data: dict, expires_delta: int = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta or ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# -------------------------
# CURRENT USER FUNCTION
# -------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        user = db.query(User).filter(User.email == email).first()

    except JWTError:
        # Fall back to API token lookup
        user = db.query(User).filter(User.api_token == token).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    if not getattr(user, "is_email_verified", False):
        raise HTTPException(status_code=403, detail="Email not verified")

    return user
