import os
import psycopg2

DSN = os.environ.get("GOVLINKS_DSN", "host=/tmp port=5433 user=postgres dbname=govlinks_demo")


def connect(dsn=None):
    return psycopg2.connect(dsn or DSN)
