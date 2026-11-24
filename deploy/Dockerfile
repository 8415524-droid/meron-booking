# אתר מירון על השרת הפרטי: Node בלי תלויות, מגיש את הקבצים ואת פונקציות ה-API.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 TZ=Asia/Jerusalem
COPY . .
RUN rm -rf .git .github supabase
EXPOSE 3000
USER node
CMD ["node", "deploy/server.js"]
