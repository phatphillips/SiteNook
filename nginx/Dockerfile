FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /docker-entrypoint-sitenook.sh
RUN sed -i 's/\r$//' /docker-entrypoint-sitenook.sh \
  && chmod +x /docker-entrypoint-sitenook.sh
ENTRYPOINT ["/docker-entrypoint-sitenook.sh"]
