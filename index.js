const https = require('https');
const fs = require('fs');

const MARKET_DATA_URL = 'https://aave-api-v2.aave.com/data/markets-data';
const TELEGRAM_BOT_KEY = fs.readFileSync('./botkey.txt');
let DEBUG_CHAT_ID;
try {
	DEBUG_CHAT_ID = fs.readFileSync('./debug_chat_id.txt').toString();
} catch(e) {
	DEBUG_CHAT_ID = null;
}
const TELEGRAM_BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}`;

const previousResults = JSON.parse(fs.readFileSync('./previous_results.json'));
const recordedChatIds = JSON.parse(fs.readFileSync('./chat_ids.json'));

const LOAN_NOT_PAYING_FOR_ITSELF_STICKERS = [
  'CAACAgIAAxkBAAMMYLuPobOLloOT1niEV3azKkeNBs0AAswAAzDUnRG4NAgyDgkxzB8E', // 😨 Edvard Munch, The Scream
  'CAACAgIAAxkBAAMPYLuQ2fqLuEfWsaJN3x6kuoXip_YAAsEAAzDUnREUuaVtMV7hEB8E', // 😟 Dropping Halloween candy bucket
  'CAACAgIAAxkBAAMSYLuRcLK1IZFQgg80NEuPmnxl9mQAAtEAAzDUnRH8Uep02BrfOx8E', // 😭 Crying
];

const ALL_IS_WELL_STICKERS = [
  'CAACAgIAAxkBAAMTYLuRottybt5-_DiFjxW3bzJWj6QAAt0AAzDUnRGNVSUVpxpurx8E', // 🥳  Partying with friends
  'CAACAgIAAxkBAAMUYLuR0-E8LkQXzCkWRAFD58HhS-YAAssAAzDUnRF1iucZcHF2zx8E', // 😎  Sunglasses
  'CAACAgIAAxkBAAMVYLuSBktblEsyZSd5QcrHhU9EERgAAroAAzDUnRGE18SIxFBnVh8E', // 🏃‍♂️  Flying with a shooting star
];

const LOSING_MONEY_STICKERS = [
  'CAACAgIAAxkBAAMWYLuSL2FzLGyHw0iATwIQsNtrbJQAArcAAzDUnRGaP4Ps5KISTx8E', // ☠️ Death
  'CAACAgIAAxkBAAMXYLuSX9166IVi5IfkulYqA8scZTUAArwAAzDUnRF3mZ4Qi9Jzoh8E', // 🤬 Explodes
  'CAACAgIAAxkBAAMYYLuSgBQIWFWE7gPwQy92hoQAAaGcAALAAAMw1J0RxsTi3Ux3ZdkfBA'// 🤮 Vomits
];

const randomIndexUpTo2 = () => Math.floor(Math.random() * 3);
const twoDecimals = (number) => Math.round(number * 100) / 100

const httpCall = (url) => {
	return new Promise((resolve, reject) => {
		const req = https.request(url, res => {
			console.log('statusCode', res.statusCode);
			console.log('headers', res.headers);
			let data = '';
			res.on('data', chunk => {
				data += chunk;
			});
	
			res.on('end', () => {
				resolve(JSON.parse(data));
			});
	
			res.on('error', reject);
	    });

		req.end();
	});	
}

const getMarketData = async () => {	
	return await httpCall(MARKET_DATA_URL);
}

const getTelegramUpdates = async () => {
	return await httpCall(`${TELEGRAM_BOT_URL}/getUpdates`);
}

const getTelegramChatIds = async () => {
	// Get the ids of subscribers from the updates, but since updates can be emptied,
	// also record the list of chats on disk and merge the two. Save it again on disk.
	const updates = await getTelegramUpdates();
	const chatIds = updates.result.map(r => {
		if (r.my_chat_member) { 
			return r.my_chat_member.chat.id 
		} else if (r.message) {
			return r.message.chat.id;
		} else {
			return null;
		}
	}).filter(a => a).concat(recordedChatIds);
	const res = [... new Set(chatIds)];
	fs.writeFileSync('./chat_ids.json', JSON.stringify(res));
	return res;
}

const sendTelegramMessage = async (message, sticker) => {
	const chatIds = DEBUG_CHAT_ID ? [DEBUG_CHAT_ID] : await getTelegramChatIds();
	chatIds.forEach(async id => {
		await httpCall(`${TELEGRAM_BOT_URL}/sendSticker?chat_id=${id}&sticker=${sticker}`);
		await httpCall(`${TELEGRAM_BOT_URL}/sendMessage?chat_id=${id}&text=${encodeURI(message)}&parse_mode=Markdown`);
	});
}

(async () => {
	const marketData = (await getMarketData()).reserves;
	fs.writeFileSync(`./history/${new Date().valueOf()}.json`, JSON.stringify(marketData));
	const maticData = marketData.find(d => d.symbol === 'AMUSDT');
	const borrowIncentive = parseFloat(maticData.vIncentivesAPY);
	const borrowRate = parseFloat(maticData.variableBorrowRate);
	const depositIncentive = parseFloat(maticData.aIncentivesAPY);
	const depositRate = parseFloat(maticData.liquidityRate);

	let message, sticker;

	if (borrowIncentive + depositIncentive + depositRate < borrowRate) {
		sticker = LOSING_MONEY_STICKERS[randomIndexUpTo2()];
		message = 'You\'re loosing money!';		
	} else if (borrowIncentive < borrowRate) {
		sticker = LOAN_NOT_PAYING_FOR_ITSELF_STICKERS[randomIndexUpTo2()];
		message = 'The loan is not paying for itself anymore. Still making money if you\'re lending though.';
	} else {
		sticker = ALL_IS_WELL_STICKERS[randomIndexUpTo2()];
		message = 'Making sweet, sweet money again!';
	}
	const rates = `\n- Borrow and lending overall rate: ${twoDecimals((borrowIncentive + depositIncentive + depositRate - borrowRate) * 100)}%\n- Borrow-only rate: ${twoDecimals((borrowIncentive - borrowRate) * 100)}%\n\nBreak down:\n- Borrow rate: ${twoDecimals(borrowRate * 100)}%\n- Borrow incentive: ${twoDecimals(borrowIncentive * 100)}%\n- Deposit rate: ${twoDecimals(depositRate * 100)}%\n- Deposit incentive: ${twoDecimals(depositIncentive * 100)}%\n\nCheck it out on [AAVE](https://app.aave.com/)`;

	const previousWarningLevel = previousResults.warningLevel || '';
	if (previousWarningLevel != message) {
		sendTelegramMessage(message + rates, sticker);
		fs.writeFileSync('./previous_results.json', JSON.stringify({ warningLevel: message }));
	}
})();
