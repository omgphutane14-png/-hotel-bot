const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');

// KEEP YOUR ROOM FILE
const roomsData = require('./rooms.json');

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const MANAGER_NUMBER = process.env.MANAGER_NUMBER;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hotel123';

let orders = {};
let menus = `*MENU* 🍽️
1. Biryani - ₹250
2. Paneer Tikka - ₹180
3. Tea - ₹20
4. Coffee - ₹30
Type e.g: "2 Biryani, 1 Tea"`;

function sendWhatsApp(to, message) {
  return axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp", to: to, type: "text", text: { body: message }
  }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

// ROOT + ROOMS API (for your old files)
app.get('/', (req,res) => res.send('Hotel Bot Running ✅ Rooms + WhatsApp'));
app.get('/api/rooms', (req,res) => res.json(roomsData));

app.get('/webhook', (req,res) => {
  if(req.query['hub.verify_token'] === VERIFY_TOKEN) res.send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

app.post('/webhook', async (req,res) => {
  res.sendStatus(200);
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if(!msg) return;
  const from = msg.from;
  const text = msg.text?.body || '';
  const location = msg.location;

  // STEP 1: QR
  if(text.toLowerCase().includes('hi table')){
    const table = text.match(/table\s*(\d+)/i)?.[1] || '0';
    orders[from] = { table, status: 'WAIT_LOCATION', time: Date.now() };
    await sendWhatsApp(from, `Welcome! You are at Table ${table} 🙏\nPlease *Share your Live Location* for 1 hour\nClick 📎 -> Location -> Share Live Location`);
    return;
  }

  // STEP 2: Location
  if(location && orders[from]){
    orders[from].location = location;
    orders[from].status = 'MENU_SENT';
    await sendWhatsApp(from, `Location saved! ✅ Table ${orders[from].table}\n\n${menus}`);
    return;
  }

  // STEP 3: Order
  if(orders[from]?.status === 'MENU_SENT'){
    orders[from].items = text;
    orders[from].status = 'PENDING_APPROVAL';
    await sendWhatsApp(from, `Order noted: *${text}* \nWaiting for Manager Approval... ⏳`);
    await sendWhatsApp(MANAGER_NUMBER, `🔔 NEW ORDER!\nTable: ${orders[from].table}\nCustomer: ${from}\nOrder: ${text}\nLive Loc: https://maps.google.com/?q=${orders[from].location?.latitude},${orders[from].location?.longitude}\n\nReply: APPROVE ${from} or REJECT ${from}`);
    return;
  }

  // STEP 4: Manager Approve
  if(from === MANAGER_NUMBER && text.toUpperCase().startsWith('APPROVE')){
    const custNum = text.split(' ')[1];
    if(orders[custNum]){
      orders[custNum].status = 'COOKING';
      await sendWhatsApp(custNum, `✅ Approved! Chef cooking ${orders[custNum].items} 👨‍🍳`);
    }
    return;
  }

  // STEP 7: Payment Choice
  if(orders[from]?.status === 'READY'){
    if(text.toUpperCase().includes('CASH')){
      orders[from].status = 'CASH_PENDING';
      await sendWhatsApp(MANAGER_NUMBER, `💵 BEEP! Table ${orders[from].table} wants to pay CASH ₹ - Go collect! Customer: ${from}\nReply: PAID ${from}`);
      await sendWhatsApp(from, `Manager is coming to Table ${orders[from].table} for cash collection 💵`);
    } else if(text.toUpperCase().includes('ONLINE')){
      orders[from].status = 'PAID_ONLINE';
      await sendWhatsApp(from, `Pay here: UPI ID: yourupi@bank\nAfter pay, send screenshot. Thank you!`);
    }
    return;
  }

  if(from === MANAGER_NUMBER && text.toUpperCase().startsWith('PAID')){
    const cust = text.split(' ')[1];
    if(orders[cust]){
      orders[cust].status = 'CLOSED';
      await sendWhatsApp(cust, `Payment received ✅ Thank you! Visit again 🙏`);
      setTimeout(()=> delete orders[cust], 60*60*1000); // delete after 1 hour
    }
  }
});

app.get('/manager', (req,res) => res.send(`<h1>Manager Panel - ${Object.keys(orders).length} orders</h1><pre>${JSON.stringify(orders,null,2)}</pre>`));
app.get('/chef', (req,res) => {
  let html = '<h1>Chef Panel 👨‍🍳</h1>';
  for(let num in orders){
    if(orders[num].status === 'COOKING'){
      html += `<div style="border:2px solid black;padding:10px;margin:10px"><b>Table ${orders[num].table}: ${orders[num].items}</b><br><a href="/ready?num=${num}"><button style="padding:10px">READY</button></a></div>`;
    }
  }
  if(html===' <h1>Chef Panel 👨‍🍳</h1>') html+='<p>No orders cooking</p>';
  res.send(html);
});
app.get('/ready', async (req,res) => {
  const num = req.query.num;
  if(orders[num]){
    orders[num].status = 'READY';
    await sendWhatsApp(num, `🍛 Your order *${orders[num].items}* is READY! Table ${orders[num].table}\nPayment? Reply: CASH or ONLINE`);
    res.send('Customer notified Ready! <a href="/chef">Back</a>');
  } else res.send('Order not found');
});

app.get('/qr/:table', async (req,res) => {
  const table = req.params.table;
  const link = `https://wa.me/${MANAGER_NUMBER}?text=Hi%20Table%20${table}`;
  const qr = await QRCode.toDataURL(link);
  res.send(`<h1>Table ${table} QR</h1><img src="${qr}"/><p>${link}</p><button onclick="window.print()">Print</button>`);
});

// FIX 1: Use Render PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Bot running on '+PORT));
