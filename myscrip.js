const puppeteer = require('puppeteer-extra');
const readlineSync = require('readline-sync');
const fs = require('fs');
const ExcelJS = require('exceljs');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

(async () => {
  puppeteer.use(StealthPlugin());

  // Meminta input URL dari pengguna
  const url = readlineSync.question('Masukkan URL: ');

  // Meminta input jumlah tab dari pengguna
  const numTabs = parseInt(readlineSync.question('Masukkan jumlah tab: '));

  // Buka browser
  const browser = await puppeteer.launch();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');

  worksheet.columns = [
    { header: 'WebSocket URL', key: 'webSocketUrl' },
    { header: 'Sec-WebSocket-Protocol', key: 'secWebSocketProtocol' }
  ];

  // Loop untuk membuka tab-tab
  for (let i = 0; i < numTabs; i++) {
    console.log(`Membuka tab ${i + 1} dari ${numTabs}`);

    // Buka tab baru
    const page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    const data = [];

    client.on('Network.webSocketCreated', ({ requestId, url }) => {
      console.log('WebSocket URL:', url);
      data.push({ webSocketUrl: url });
    });

    client.on('Network.webSocketWillSendHandshakeRequest', ({ requestId, request }) => {
      console.log('Sec-WebSocket-Protocol:', request.headers['Sec-WebSocket-Protocol']);
      data[data.length - 1].secWebSocketProtocol = request.headers['Sec-WebSocket-Protocol'];
    });

    // Navigasi ke URL
    await page.goto(url);

    // Tunggu hingga tab terbuka sepenuhnya
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for the element to appear and click it
    try {
      await page.waitForSelector('.live-tag');
      await page.click('.live-tag');
      console.log('Element .live-tag clicked successfully.');
    } catch (error) {
      await page.evaluate(() => {
        const element = document.querySelector('.live-tag');
        if (element) {
          element.click();
          console.log('Element .live-tag clicked successfully using JavaScript.');
        } else {
          console.error('Element .live-tag not found in the DOM.');
        }
      });
    }

    // Tunggu beberapa saat untuk menerima data websocket
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simpan data ke dalam worksheet
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Tutup tab
    await page.close();
  }

  console.log(`Proses selesai. Menutup browser...`);

  // Tutup browser
  await browser.close();

  // Simpan workbook ke dalam file Excel
  const fileName = 'data_tab.xlsx';
  await workbook.xlsx.writeFile(fileName);

  console.log(`Data disimpan dalam file Excel dengan nama ${fileName}.`);
})();
