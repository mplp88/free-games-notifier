# Free Games Notifier

Free Games Notifier is a Node.js bot that notifies users about free games available on Epic Games and Steam. Users can subscribe via Telegram to receive automatic notifications when new free games are detected.

## Features

- Telegram bot for user subscription and notifications
- Scheduled checks for new free games (Epic & Steam)
- Manual commands to check current and upcoming free games
- Persistent user and game notification tracking using SQLite
- Logging with Winston

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- Telegram Bot Token (from [BotFather](https://core.telegram.org/bots#botfather))

### Installation

#### 1. Clone the repository:
```sh
git clone https://github.com/yourusername/free-games-notifier.git
cd free-games-notifier
```
   
#### 2. Install dependencies
```sh
npm install
```

#### 3. Create a .env file:
```sh
TELEGRAM_TOKEN=your_telegram_token_here
```

## Usage
Start the bot:
```sh
npm start
```

Or use the provided script: run.sh

## Telegram Commands
- /start – Subscribe to notifications
- /stop – Unsubscribe from notifications
- /current – Show current free games
- /next – Show upcoming free games
- /epic – Show Epic Games free games
- /steam – Show Steam free games
- /help – Show help (not implemented)
- /info – Show bot info (not implemented)

## Project Structure
```
.
├── bots/              # Telegram and Discord bot logic
├── db/                # SQLite database logic
├── logs/              # Log files
├── models/            # Game and GameOffer models
├── scheduler/         # Cron job for scheduled checks
├── services/          # Game fetching and notification logic
├── utils/             # Logger utility
├── index.js           # Entry point
├── package.json
└── README.md
```

## License
MIT © 2025 Martín Ponce
