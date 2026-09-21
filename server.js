const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const app = express();
app.use(express.json());

// ========== CONFIG FROM RENDER ENV ==========
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const MANAGER_NUMBER = process.env.MANAGER_NUMBER; // 919834309809
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hotel123';

let orders = {}; // Store orders: { "Table4_98765": {status, items, location} }
let menus = `*MENU* 🍽️
1. Biryani - ₹250
2. Paneer Tikka - ₹180
3. Tea - ₹20
4. Coffee - ₹30
Type e.g: "2 Biryani, 1 Tea"`;

function sendWhatsApp(to, message) {
  return axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: message }
  }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

// ========== STEP 0: VERIFY WEBHOOK ==========
app.get('/webhook', (req,res) => {
  if(req.query['hub.verify_token'] === VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  } else res.sendStatus(403);
});

// ========== MAIN FLOW ==========
app.post('/webhook', async (req,res) => {
  res.sendStatus(200);
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if(!msg) return;
  const from = msg.from; // Customer number
  const text = msg.text?.body || '';
  const location = msg.location;

  // STEP 1: QR Scan -> Hi Table 4
  if(text.toLowerCase().includes('hi table')){
    const table = text.match(/table\s*(\d+)/i)?.[1] || '0';
    orders[from] = { table, status: 'WAIT_LOCATION' };
    await sendWhatsApp(from, `Welcome! You are at Table ${table} 🙏\nPlease *Share your Live Location* (1 hour) for service.\n\nClick 📎 -> Location -> Share Live Location`);
    return;
  }

  // STEP 2: Location Received -> Send Menu
  if(location){
    if(orders[from]){
      orders[from].location = location;
      orders[from].status = 'MENU_SENT';
      await sendWhatsApp(from, `Location saved! ✅ Table ${orders[from].table}\n\n${menus}`);
    }
    return;
  }

  // STEP 3: Customer Orders -> Alert Manager
  if(orders[from]?.status === 'MENU_SENT'){
    orders[from].items = text;
    orders[from].status = 'PENDING_APPROVAL';
    await sendWhatsApp(from, `Order noted: *${text}* \nWaiting for Manager Approval... ⏳`);
    // Alert Manager
    await sendWhatsApp(MANAGER_NUMBER, `🔔 NEW ORDER!\nTable: ${orders[from].table}\nCustomer: ${from}\nOrder: ${text}\n\nReply: APPROVE ${from} or REJECT ${from}`);
    return;
  }

  // STEP 4: Manager APPROVE -> Chef
  if(from === MANAGER_NUMBER && text.toUpperCase().startsWith('APPROVE')){
    const custNum = text.split(' ')[1];
    if(orders[custNum]){
      orders[custNum].status = 'COOKING';
      await sendWhatsApp(custNum, `✅ Order Approved! Chef is cooking your ${orders[custNum].items} 👨‍🍳`);
      // For Chef dashboard you will see in /chef page
    }
    return;
  }

  // STEP 5: Chef READY is via Chef Panel (see below)
});

// ========== MANAGER & CHEF PANELS ==========
app.get('/manager', (req,res) => res.send(`<h1>Manager Panel</h1><pre>${JSON.stringify(orders,null,2)}</pre><p>To approve, send WhatsApp to your bot: APPROVE 91xxxxxxxxxx</p>`));
app.get('/chef', (req,res) => {
  let html = '<h1>Chef Panel 👨‍🍳</h1>';
  for(let num in orders){
    if(orders[num].status === 'COOKING'){
      html += `<div style="border:2px solid black;padding:10px;margin:10px"><b>Table ${orders[num].table}: ${orders[num].items}</b><br><a href="/ready?num=${num}"><button>READY</button></a></div>`;
    }
  }
  res.send(html);
});
app.get('/ready', async (req,res) => {
  const num = req.query.num;
  if(orders[num]){
    orders[num].status = 'READY';
    await sendWhatsApp(num, `🍛 Your order *${orders[num].items}* is READY! Coming to Table ${orders[num].table}\n\nPayment? Reply: CASH or ONLINE`);
    res.send('Customer notified Ready!');
  }
});

// ========== QR GENERATOR FOR TABLES ==========
app.get('/qr/:table', async (req,res) => {
  const table = req.params.table;
  const link = `https://wa.me/${MANAGER_NUMBER}?text=Hi%20Table%20${table}`;
  const qr = await QRCode.toDataURL(link);
  res.send(`<h1>Table ${table} QR</h1><img src="${qr}"/><p>Print this</p><p>Link: ${link}</p>`);
});

app.listen(10000, () => console.log('Bot running'));
