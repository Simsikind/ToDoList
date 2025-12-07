import configparser
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

config = configparser.ConfigParser()
config.read("config.cfg")

DB_HOST = config["database"]["host"]
DB_PORT = config["database"]["port"]
DB_NAME = config["database"]["tododbname"]
DB_USER = config["database"]["user"]
DB_PASS = config["database"]["password"]

DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
