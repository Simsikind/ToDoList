import configparser
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

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
