const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY = process.env.VERIFY_TOKEN;
const MANAGER = process.env.MANAGER_NUMBER;

const orders = {}; // table -> customer number

async function send(to, text) {
  await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: text }
  }, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
}

// Verify Webhook
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;

  const from = msg.from;
  const type = msg.type;

  // --- MANAGER REPLY ---
  if (from === MANAGER && type === 'text') {
    const parts = msg.text.body.trim().split(' ');
    const table = parts[0];
    const reply = parts.slice(1).join(' ');
    if (orders[table] && reply) {
      await send(orders[table], `✅ Manager says:\n${reply}`);
      await send(MANAGER, `✓ Sent to Table ${table}`);
    }
    return;
  }

  // --- CUSTOMER ---

  // 1. If Hi
  if (type === 'text' && msg.text.body.toLowerCase().includes('hi')) {
    const tableMatch = msg.text.body.match(/\d+/);
    const table = tableMatch? tableMatch[0] : "0";
    orders[table] = from;
    await send(from, `Welcome! 🙏 Table ${table}

Please share your Live Location (1 hour)

📎 Attach -> Location -> Share Live Location`);
    return;
  }

  // 2. If Location Shared
  if (type === 'location') {
    const lat = msg.location.latitude;
    const lon = msg.location.longitude;
    const table = Object.keys(orders).find(t => orders[t] === from) || "0";
    orders[table] = from;

    await send(from, `Location saved! ✅
Table ${table}

MENU 🍽️
1. Biryani - ₹250
2. Paneer Tikka - ₹180
3. Tea - ₹20

Type your order like:
2 Biryani, 1 Tea`);

    await send(MANAGER, `📍 NEW TABLE: ${table}
Customer: ${from}
Location: https://maps.google.com/?q=${lat},${lon}
Waiting for order...`);
    return;
  }

  // 3. If Order
  if (type === 'text') {
    const table = Object.keys(orders).find(t => orders[t] === from) || "0";
    orders[table] = from;
    const orderText = msg.text.body;

    await send(from, `Order noted: ${orderText} ⌛
Waiting for Manager...`);

    await send(MANAGER, `🔔 ORDER - Table ${table}
${orderText}
Customer: ${from}

Reply like: ${table} Ready in 10 mins`);
  }
});

app.get('/', (req, res) => res.send('Hotel Bot Running'));
app.listen(PORT, () => console.log('Running on', PORT));
