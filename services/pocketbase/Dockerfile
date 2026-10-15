FROM alpine:3.20

ARG PB_VERSION=0.25.8

RUN apk add --no-cache ca-certificates wget curl unzip jq sqlite \
  && wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip \
  && chmod +x /pb/pocketbase

WORKDIR /pb

COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
COPY entrypoint.sh bootstrap.sh seed.sh stamp-legacy-migrations.sh patch-users.sh patch-app-settings.sh patch-multi-tenant.sh patch-rules.sh patch-scan-status.sh patch-site-schedule.sh patch-site-settings.sh patch-score-denominators.sh patch-scan-log-events.sh patch-pages-html-size.sh patch-pages-rendered-html.sh patch-qa-inventory-asset-category.sh patch-qa-inventory-refs.sh patch-a11y-issue-actions.sh ./
RUN sed -i 's/\r$//' ./entrypoint.sh ./bootstrap.sh ./seed.sh ./stamp-legacy-migrations.sh ./patch-users.sh ./patch-app-settings.sh ./patch-multi-tenant.sh ./patch-rules.sh ./patch-scan-status.sh ./patch-site-schedule.sh ./patch-site-settings.sh ./patch-score-denominators.sh ./patch-scan-log-events.sh ./patch-pages-html-size.sh ./patch-pages-rendered-html.sh ./patch-qa-inventory-asset-category.sh ./patch-qa-inventory-refs.sh ./patch-a11y-issue-actions.sh \
  && chmod +x ./entrypoint.sh ./bootstrap.sh ./seed.sh ./stamp-legacy-migrations.sh ./patch-users.sh ./patch-app-settings.sh ./patch-multi-tenant.sh ./patch-rules.sh ./patch-scan-status.sh ./patch-site-schedule.sh ./patch-site-settings.sh ./patch-score-denominators.sh ./patch-scan-log-events.sh ./patch-pages-html-size.sh ./patch-pages-rendered-html.sh ./patch-qa-inventory-asset-category.sh ./patch-qa-inventory-refs.sh ./patch-a11y-issue-actions.sh

EXPOSE 8090

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
