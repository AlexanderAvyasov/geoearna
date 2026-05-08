const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
require('dotenv').config();

const botUsername = process.env.BOT_USERNAME;
const qrToken = process.argv[2];

if (!botUsername) {
  console.error('Ошибка: задайте BOT_USERNAME в .env');
  process.exit(1);
}

if (!qrToken) {
  console.error('Использование: node scripts/generate-qr.js <qr_token>');
  process.exit(1);
}

const url = `https://t.me/${botUsername}/app?startapp=${encodeURIComponent(qrToken)}`;
const outputDir = path.resolve(__dirname, '../qr-codes');
const outputFile = path.join(outputDir, `${qrToken}.png`);

fs.mkdirSync(outputDir, { recursive: true });

QRCode.toFile(outputFile, url, {
  type: 'png',
  width: 400,
}, (err) => {
  if (err) {
    console.error('Не удалось сгенерировать QR-код:', err);
    process.exit(1);
  }

  console.log(`QR-код сохранён: ${outputFile}`);
  console.log(`Ссылка: ${url}`);
});
