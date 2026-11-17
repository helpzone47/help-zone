# Help Zone — Customer Support

A small, general-purpose customer support website with a public message form and a password-protected admin inbox.

## Requirements
- Node.js 20 or newer
- A hosting provider that supports a persistent disk (SQLite database and sessions are stored in `data/`).

## Run locally
1. Copy `.env.example` to `.env`.
2. Set long random values for `SESSION_SECRET` and `ADMIN_SETUP_KEY`.
3. Keep `APP_ORIGIN=http://localhost:3000` for local testing.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000/admin-setup.html` and create your admin password using the `ADMIN_SETUP_KEY` from `.env`.
7. Sign in at `http://localhost:3000/admin.html`.
8. Customers can send messages from the home page.

## Deploy
Deploy this folder to a Node.js host with persistent storage. Set these environment variables in the host dashboard:
- `NODE_ENV=production`
- `PORT` (usually supplied by the host)
- `SESSION_SECRET` (long random secret)
- `ADMIN_SETUP_KEY` (different long random secret)
- `APP_ORIGIN=https://your-real-domain.example` (exact HTTPS origin, no trailing slash)

Make sure the host keeps the `data/` directory between deploys/restarts. After deployment, visit `/admin-setup.html` once to create the admin password, then remove/disable access to that setup page if your host supports it. The endpoint itself becomes permanently unavailable after the first admin is created.

## Routes
- `/` — public support form
- `/admin.html` — admin inbox
- `/admin-setup.html` — one-time initial admin setup
- `POST /api/messages` — accept a customer message
- `GET /api/messages` — admin-only inbox
- `POST /api/messages/:id/reply` — admin-only reply
- `DELETE /api/messages/:id` — admin-only delete

## Important
- This is a starter application, not a managed hosting service. It is not online until deployed.
- Use HTTPS in production, keep secrets private, and back up the `data/` directory.
- Customer messages contain personal information; publish a privacy notice and collect only information you need.
- The Telegram link is a convenience link. Replies saved in the admin inbox are stored on the website; this starter does not automatically send replies to the customer's phone/email.
