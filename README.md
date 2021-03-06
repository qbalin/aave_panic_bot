# aave_panic_bot
A Telegram Bot that tells you if you should panic based on AAVE rates

# What it does

This bot sends warnings based on the profitability of an AAVE-Polygon WMATIC loan. It will send a message when transitioning between these three states:

1. The loan makes money by itself, the incentive reward is higher than the borrowing rate
2. The borrowing rate is higher than the borrowing rate, but lending the amount borrowed still makes the borrowing + lending profitable
3. The borrowing rate is so high that even lending the borrowed amount is not profitable

Overall, this bot should be rather quiet, it currently runs every 15 minutes.

# How to subscribe:
Find the bot `@AavePanicBot` on Telegram or with this link: [t.me/AavePanicBot](https://t.me/AavePanicBot)

[Edit] The bot has been de-activated as MATIC borrowing+lending is not profitable anymore.

# How to deploy?
Create a TelegramBot with the BotFather. Write down your bot API key somewhere safe.

Pull the code locally:

```bash
git clone https://github.com/qbalin/aave_panic_bot.git
```

Setup the dev environment (you may need to install node and npm locally).

```bash
cd aave_panic_bot
npm install
```

Then add your secret bot key:
```bash
touch botkey.txt
```

Add your bot API key in botkey.txt.

Run the bot manually: 
```
node index.js
```

You'll probably want the bot to run every x minutes. For that use a cronjob.


