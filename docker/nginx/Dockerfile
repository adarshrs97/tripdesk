# Production Frontend Container for Starciti Fleet Desk
FROM nginx:alpine

# Remove default nginx assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled frontend build
COPY dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Native Container Healthcheck
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
