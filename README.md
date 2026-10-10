# 👥 Members Bot For Suppliers

A Node.js Discord supplier bot designed for automated server member additions via OAuth2 authorized tokens, credit balances, and order fulfillment.

## ✨ Features
- **OAuth2 Token Joins**: Delivers authenticated members into target servers using Discord REST API endpoints.
- **Credit & Order System**: SQLite-backed database (`json.sqlite`) tracking balance credits, orders, and fulfillment logs.
- **Admin Dashboard**: Web interface (`index.html`) and Discord slash commands for managing member queues.

## 🚀 Quickstart
```bash
npm install
node index.js
```
Configure bot token and client IDs in `config.json`.
