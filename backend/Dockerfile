FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY app /app/app

EXPOSE 8000

# App Service sets PORT; default to 8000 locally.
ENV PORT=8000

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:${PORT} app.main:app"]

