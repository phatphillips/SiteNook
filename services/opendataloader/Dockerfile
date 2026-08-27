# Use a base image commonly already present in this monorepo (scanner/web builds).
# Avoids flaky Docker Hub pulls for eclipse-temurin when Desktop DNS fails.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    openjdk-17-jre-headless \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/bin/python \
  && python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

WORKDIR /app

RUN pip install --no-cache-dir \
  "opendataloader-pdf>=2.4.0" \
  flask==3.0.3 \
  gunicorn==23.0.0

COPY server.py /app/server.py

ENV PORT=8095
ENV ODL_CLI=opendataloader-pdf
ENV ODL_MAX_BYTES=20971520
ENV ODL_TIMEOUT_SEC=180

EXPOSE 8095

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8095/health')"

CMD ["gunicorn", "-b", "0.0.0.0:8095", "-w", "1", "--timeout", "200", "server:app"]
