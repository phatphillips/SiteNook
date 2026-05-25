FROM alpine:3.20

ARG PB_VERSION=0.25.8

RUN apk add --no-cache ca-certificates wget curl unzip \
  && wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip \
  && chmod +x /pb/pocketbase

WORKDIR /pb

COPY entrypoint.sh bootstrap.sh seed.sh patch-users.sh patch-rules.sh ./
RUN sed -i 's/\r$//' ./entrypoint.sh ./bootstrap.sh ./seed.sh ./patch-users.sh ./patch-rules.sh \
  && chmod +x ./entrypoint.sh ./bootstrap.sh ./seed.sh ./patch-users.sh ./patch-rules.sh

EXPOSE 8090

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
