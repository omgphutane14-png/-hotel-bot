const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY = process.env.VERIFY_TOKEN;
const MANAGER = process.env.MANAGER_NUMBER;
const CHEF = process.env.CHEF_NUMBER;
const MERCHANT_UPI = process.env.MERCHANT_UPI_ID || "darbarpizza@upi";
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Darbar Pizza";
const WHATSAPP_NUM = "919834309809";

const orders = {};
const customerStates = {};
const locationShared = {};
const chefOrders = {};
const payments = {}; // table -> {total, method, status, customer}
const paymentTimeouts = {};

async function send(to, text) {
  for (let i = 0; i < text.length; i += 3500) {
    const chunk = text.substring(i, i + 3500);
    await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      messaging_product: "whatsapp", to: to, type: "text", text: { body: chunk }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  }
}
function normalize(t){ return t.trim().toLowerCase(); }
function getCustomerTable(from){ return Object.keys(orders).find(k=>orders[k]===from) || "0"; }
function createCustomerState(from, table){ customerStates[from]={table,step:"MAIN_MENU",category:null,section:null,item:null,size:null,quantity:0,cart:[]}; }
function getCustomerState(from){ if(!customerStates[from]) createCustomerState(from, getCustomerTable(from)); return customerStates[from]; }

function closeChatAfter2Hour(from, table){
  if(paymentTimeouts[from]) clearTimeout(paymentTimeouts[from]);
  paymentTimeouts[from] = setTimeout(async ()=>{
    try{
      await send(from, `⏰ *Session Closed* ⏰\n\nTable ${table} chat closed after 2 hours.\n\nThank you for visiting ${MERCHANT_NAME} 🍕\n\nScan QR again for new order.`);
      delete customerStates[from];
      delete locationShared[from];
      delete orders[table];
      delete payments[table];
      delete chefOrders[table];
    }catch(e){}
  }, 2*60*60*1000); // 2 hours
}

async function showPaymentOptions(from, table){
  const order = chefOrders[table] || payments[table];
  if(!order) return;
  const total = order.total;
  const upiLink = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${total}&cu=INR&tn=Table${table}`;
  const qrImageLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;

  payments[table] = { total, customer: from, status: "AWAITING_PAYMENT", method: null, upiLink };
  const state = getCustomerState(from);
  state.step = "PAYMENT";

  await send(from, `💳 *PAYMENT - Table ${table}* 💳\n\n💰 Total Amount: ₹${total}\n\nPlease choose payment method:\n\n1️⃣ Pay via UPI (GPay / PhonePe / Paytm)\n2️⃣ Pay via Cash\n\nReply 1 or 2`);

  await send(from, `📱 *UPI Payment QR*\n\nIf you choose UPI, scan this QR or click link:\n\n🔗 ${upiLink}\n\nQR Image:\n${qrImageLink}\n\nAfter payment, type: Paid\n\nOr choose Cash: type 2`);

  // Notify manager with beep
  await send(MANAGER, `🔔🔔🔔 *PAYMENT REQUEST - Table ${table}* 🔔🔔🔔\n\n💰 Amount: ₹${total}\nCustomer: ${from}\n\nCustomer choosing payment method...\n\nWaiting for payment confirmation.\n\nTo confirm payment:\n${table} Paid\n${table} Paid Cash\n${table} Paid UPI ${total}`);

  closeChatAfter2Hour(from, table);
}

async function showMainMenu(from){
  await send(from, `🍕 *WELCOME TO DARBAR PIZZA* 🍕\n\nPlease choose a category:\n\n1️⃣ Veg Pizza\n2️⃣ Non-Veg Pizza\n3️⃣ Beverages\n4️⃣ Starters\n5️⃣ Burgers\n6️⃣ Sandwich\n7️⃣ Wraps\n8️⃣ Pasta\n9️⃣ Garlic Bread\n🔟 Nachos\n1️⃣1️⃣ DFC\n1️⃣2️⃣ Combos\n1️⃣3️⃣ Desserts\n\n━━━━━━━━━━━━━━\nReply with number\n\nB = Back | M = Menu | C = Cart`);
}
async function showCategoryMenu(from, category){
  const menu=MENU[category]; if(!menu){ await send(from,"❌ Not found"); return; }
  const state=getCustomerState(from); state.category=category; state.section=null; state.item=null; state.size=null;
  if(menu.type==="sections"){
    const sections=Object.keys(menu.sections); let msg=`🍕 *${category.toUpperCase()}*\n\nChoose section:\n\n`;
    sections.forEach((s,i)=>{ msg+=`${i+1}️⃣ ${s}\n`; });
    msg+=`\n━━━━━━━━━━━━━━\nB = Back | M = Menu | C = Cart`; state.step="SECTION"; await send(from,msg); return;
  }
  if(menu.type==="items"){ await showItems(from, category, menu.items); }
}
async function showItems(from, category, items){
  const state=getCustomerState(from); const names=Object.keys(items);
  let msg=`🍕 *${category.toUpperCase()}*\n`; if(state.section) msg+=`\n📂 *${state.section}*\n`; msg+=`\n`;
  names.forEach((n,i)=>{
    const v=items[n];
    if(typeof v==="object"){ msg+=`${i+1}️⃣ ${n}\n ${Object.entries(v).map(([k,p])=>`${k} ₹${p}`).join(" | ")}\n`; }
    else{ msg+=`${i+1}️⃣ ${n} - ₹${v}\n`; }
  });
  msg+=`\n━━━━━━━━━━━━━━\nReply item number\nB = Back | M = Menu | C = Cart`;
  state.step="ITEM"; await send(from,msg);
}
async function showItemOptions(from, itemName, itemData){
  const state=getCustomerState(from); state.item=itemName;
  if(typeof itemData==="object"){
    state.step="SIZE";
    await send(from,`🍕 *${itemName}*\n\nChoose size:\n1️⃣ R - ₹${itemData.R}\n2️⃣ M - ₹${itemData.M}\n3️⃣ L - ₹${itemData.L}\n4️⃣ XL - ₹${itemData.XL}\n\nB = Back | M = Menu | C = Cart`); return;
  }
  state.step="QUANTITY"; state.selectedPrice=itemData;
  await send(from,`🍽️ *${itemName}*\n\nPrice: ₹${itemData}\n\nHow many?\nEx: 2`);
}
async function addToCart(from, qty){
  const state=getCustomerState(from); let price=state.selectedPrice;
  if(state.size){ const cat=MENU[state.category]; const items=state.section?cat.sections[state.section]:cat.items; price=items[state.item][state.size]; }
  const total=price*qty; state.cart.push({item:state.item,size:state.size,quantity:qty,price,total});
  state.step="AFTER_ADD";
  await send(from,`✅ *ADDED*\n\n${state.item}${state.size?` (${state.size})`:""} x ${qty} = ₹${total}\n\n1️⃣ Add More\n2️⃣ View Cart\n3️⃣ Checkout`);
}
async function showCart(from){
  const state=getCustomerState(from);
  if(!state.cart.length){ await send(from,`🛒 Empty`); return; }
  let msg=`🛒 *CART*\n\n`; let tot=0;
  state.cart.forEach((c,i)=>{ msg+=`${i+1}. ${c.item}${c.size?` (${c.size})`:""} x ${c.quantity} = ₹${c.total}\n`; tot+=c.total; });
  msg+=`\n💰 TOTAL: ₹${tot}\n\n1️⃣ Add More\n2️⃣ Checkout\n3️⃣ Clear`; state.step="CART"; await send(from,msg);
}
function getCartTotal(s){ return s.cart.reduce((a,b)=>a+b.total,0); }
function createOrderText(s){ let t=""; s.cart.forEach((c,i)=>{ t+=`${i+1}. ${c.item}${c.size?` (${c.size})`:""} x ${c.quantity} = ₹${c.total}\n`; }); return t; }
async function checkout(from){
  const state=getCustomerState(from); if(!state.cart.length){ await send(from,"🛒 Empty"); return; }
  const total=getCartTotal(state); const orderText=createOrderText(state); state.step="CONFIRM_ORDER";
  await send(from,`🧾 *SUMMARY*\n\n${orderText}\n💰 TOTAL: ₹${total}\n\n1️⃣ Confirm\n2️⃣ Add More\n3️⃣ Cancel`);
}
async function sendOrderToManager(from){
  const state=getCustomerState(from); const table=state.table||getCustomerTable(from);
  const total=getCartTotal(state); const orderText=createOrderText(state);
  chefOrders[table]={orderText,total,customer:from,status:"PENDING_APPROVAL"};
  await send(from,`✅ *ORDER CONFIRMED* Table ${table}\n\n${orderText}\n💰 ₹${total}\n\n⌛ Waiting manager approval...`);
  await send(MANAGER,`🔔 *NEW ORDER - Table ${table}*\n\n${orderText}\n💰 ₹${total}\nCustomer: ${from}\n\n${table} Approved → Chef\n${table} Rejected`);
  state.step="WAITING_MANAGER";
  closeChatAfter2Hour(from, table);
}
async function clearCart(from){ const s=getCustomerState(from); s.cart=[]; s.step="MAIN_MENU"; await send(from,`🗑️ Cleared`); await showMainMenu(from); }
async function handleBack(from){ const s=getCustomerState(from); s.step="MAIN_MENU"; await showMainMenu(from); }

const MENU = {
  "Veg Pizza": { type: "sections", sections: { "Darbar E Classic": { "Margherita": { R: 130, M: 180, L: 240, XL: 320 }, "Double Cheese Margherita": { R: 170, M: 210, L: 290, XL: 380 }, "Pesto Margherita Paradiso": { R: 160, M: 210, L: 280, XL: 380 }, "Cheese & Corn": { R: 160, M: 200, L: 270, XL: 360 }, "Corn Fusion": { R: 180, M: 230, L: 330, XL: 420 }, "Farm Fresh": { R: 170, M: 220, L: 320, XL: 400 }, "Corn & Veggie Delight": { R: 180, M: 230, L: 330, XL: 420 }, "Spicy Corn Mexicano": { R: 180, M: 230, L: 330, XL: 420 }, "Cheese Garlic": { R: 150, M: 200, L: 240, XL: 320 }, "Achari Do Pyaza": { R: 169, M: 209, L: 290, XL: 380 } }, "Darbar E Exotic": { "Paneer Makhani": { R: 210, M: 270, L: 370, XL: 490 }, "Spicy Paneer": { R: 210, M: 270, L: 370, XL: 490 }, "Paneer Tikka": { R: 210, M: 270, L: 370, XL: 490 }, "Farm House": { R: 210, M: 270, L: 370, XL: 490 }, "Veggie Paradise": { R: 210, M: 270, L: 370, XL: 490 }, "Mexican Green Wave": { R: 210, M: 270, L: 370, XL: 490 }, "Spiced Paneer": { R: 210, M: 270, L: 370, XL: 490 }, "Tandoori Paneer": { R: 210, M: 270, L: 370, XL: 490 }, "Pesto Paneer Paradiso": { R: 210, M: 270, L: 370, XL: 490 } }, "Darbar E Super Exotic": { "Paneer Overload": { R: 240, M: 310, L: 420, XL: 550 }, "Maharaja Veg": { R: 240, M: 310, L: 420, XL: 550 }, "All Veggies Madness": { R: 240, M: 310, L: 420, XL: 550 }, "Crowded House": { R: 240, M: 310, L: 420, XL: 550 }, "Indie Tandoori Paneer": { R: 240, M: 310, L: 420, XL: 550 }, "Double Paneer Supreme": { R: 240, M: 310, L: 420, XL: 550 }, "Devils Spiced Paneer": { R: 249, M: 319, L: 440, XL: 579 } }, "Darbar E Spicy Schezwan": { "Veggie Schezwan Delight": { R: 200, M: 260, L: 350, XL: 480 }, "Schezwan Paneer": { R: 220, M: 310, L: 400, XL: 540 }, "Schezwan Madness": { R: 220, M: 310, L: 400, XL: 540 } } } },
  "Non-Veg Pizza": { type: "sections", sections: { "Darbar E Classic": { "Pepper BBQ Chicken": { R: 200, M: 250, L: 350, XL: 460 }, "Pepper BBQ Chicken & Onion": { R: 200, M: 250, L: 350, XL: 470 }, "Chicken Makhani": { R: 200, M: 250, L: 350, XL: 470 }, "Chicken Sausage": { R: 200, M: 250, L: 350, XL: 470 }, "Chicken Pepperoni": { R: 200, M: 250, L: 350, XL: 460 }, "Chicken Seekh Kebab": { R: 200, M: 250, L: 350, XL: 470 }, "Chicken Pepper Crunch": { R: 200, M: 250, L: 350, XL: 480 }, "Chicken Cheese Garlic": { R: 200, M: 250, L: 350, XL: 460 }, "Italian Chicken Feast": { R: 200, M: 250, L: 350, XL: 460 }, "Chicken Achari Do Pyaza": { R: 209, M: 260, L: 360, XL: 480 } }, "Darbar E Exotic": { "Mexican Chicken": { R: 220, M: 270, L: 370, XL: 500 }, "Chicken Peri Peri": { R: 220, M: 270, L: 370, XL: 500 }, "Chicken Tikka": { R: 220, M: 270, L: 370, XL: 500 }, "Darbar Delight": { R: 220, M: 270, L: 370, XL: 500 }, "Indie Tandoori Chicken": { R: 220, M: 270, L: 370, XL: 500 }, "Spicy Chicken & Corn": { R: 220, M: 270, L: 370, XL: 500 }, "Fire Me Up Chicken": { R: 220, M: 270, L: 370, XL: 500 }, "Double Trouble": { R: 220, M: 270, L: 370, XL: 500 }, "Pesto Chicken Paradiso": { R: 220, M: 270, L: 370, XL: 500 } }, "Darbar E Super Exotic": { "Darbar Chicken Special": { R: 240, M: 310, L: 420, XL: 550 }, "Chicken Full Smash": { R: 240, M: 310, L: 420, XL: 550 }, "Fantastic Four": { R: 240, M: 310, L: 420, XL: 550 }, "Butter Chicken": { R: 240, M: 310, L: 420, XL: 550 }, "Non Veg Supreme": { R: 240, M: 310, L: 420, XL: 550 }, "The Meat Eater": { R: 260, M: 330, L: 450, XL: 600 }, "Devils Chicken Pizza": { R: 249, M: 319, L: 440, XL: 579 } }, "Darbar E Spicy Schezwan": { "Schezwan Chicken Delight": { R: 220, M: 310, L: 400, XL: 540 }, "Schezwan Chicken Supreme": { R: 220, M: 310, L: 400, XL: 540 } } } },
  "Beverages": { type: "sections", sections: { "Fruity Shakes": { "Strawberry Milkshake": 129, "Blueberry Milkshake": 129, "Mango Milkshake": 129, "Kiwi Milkshake": 129, "Strawberry Banana Milkshake": 129, "Berry Blast Milkshake": 129, "Strawberry Cheese Cake": 129, "Blueberry Cheese Cake": 129 }, "Exotic Shakes": { "Vanilla Milkshake": 119, "Bubblegum Milkshake": 119, "Butterscotch Milkshake": 119, "Salted Caramel Milkshake": 119, "Strawberry Cookie Shake": 119, "Toffee Shake": 119 }, "Chocolate Shakes": { "Chocolate Milkshake": 129, "Oreo Milkshake": 129, "KitKat Milkshake": 129, "Snicker Milkshake": 129, "Choco-Hazelnut Milkshake": 129, "Chocolate Bounty Milkshake": 129 }, "Cold Coffee": { "Cold Coffee": 109, "Coffee Mocha": 109, "Irish Coffee": 109, "Hazelnut": 109, "Tiramisu": 109 }, "Mojitos": { "Mint Mojito": 99, "Blue Mojito": 99, "Watermelon Mojito": 99, "Green Apple Mojito": 99, "Blueberry Mojito": 99, "Peach Mojito": 99, "Mango Mojito": 99, "Kiwi Mojito": 99 }, "Lemonade": { "Plain Lemonade": 79, "Watermelon Lemonade": 89, "Green Apple Lemonade": 89, "Cucumber Lemonade": 89 }, "Coolers / Refreshers": { "Kala Khata Twist": 89, "Chilli Guava": 89, "Cumin Masala": 89, "Tangy Mango": 89, "Nimbu Masala": 89, "Blueberry Cooler": 89, "Very Berry Lemonade": 89, "Mosambi Cooler": 89 }, "Ice Tea": { "Lemon Ice Tea": 79, "Peach Ice Tea": 79, "Watermelon Ice Tea": 79, "Cucumber Ice Tea": 79, "Blueberry Ice Tea": 79, "Mango Ice Tea": 79, "Passion Fruit Ice Tea": 79, "Green Apple Ice Tea": 79 }, "Soft Drinks & Juices": { "Coca-Cola": 40, "Sprite": 40, "Mix Fruit Juice": 50 } } },
  "Starters": { type: "items", items: { "Hashbrown": 90, "Masala Wedges": 99, "Potato Shots": 99, "Cheesy Jalapeno Poppers": 99, "Chicken Nuggets (6 pcs)": 120, "Pizza Pockets": 130, "Crispy Chicken Strips (6 pcs)": 149, "Chicken Cheese Pockets": 160 } },
  "Burgers": { type: "items", items: { "Classic Chicken King Burger": 100, "American Cheese Supreme Chicken Burger": 120, "Fiery Crunchy Chicken King Burger": 130, "Chicken Big King Burger": 190, "Fiery Aloo Tikki Burger": 90, "Spicy Paneer Burger": 120, "Veg Burger Combo": 199, "Paneer Burger Combo": 220, "Classic Chicken Burger Combo": 199, "Crunchy Chicken Burger Combo": 240 } },
  "Sandwich": { type: "items", items: { "Cheese & Corn": 99, "Farm Fresh": 120, "Roasted Sandwich": 130, "Paneer Tikka": 150, "Paneer Chilli": 150, "Paneer Mexican": 150, "Tandoori Chicken": 150 } },
  "Wraps": { type: "items", items: { "Aloo Tikki Wrap (Mexican)": 129, "Spicy Paneer Wrap": 149, "Paneer Tikka Wrap": 149, "Chicken Tandoori Zinger": 159, "Mexican Zinger": 159, "Peri Peri Wrap": 169, "Tandoori Wrap": 169 } },
  "Pasta": { type: "items", items: { "Chicken Tikka Pasta": 160, "Paneer Tikka Pasta": 160 } },
  "Garlic Bread": { type: "sections", sections: { "Veg Stuffed Garlic Bread": { "Garlic Bread Sticks": 90, "Mexican Stuffed Garlic Bread": 149, "Paneer Mexicano Stuffed Garlic Bread": 169, "Paneer Peri Peri Stuffed Garlic Bread": 169, "Paneer Tikka Stuffed Garlic Bread": 169 }, "Chicken Stuffed Garlic Bread": { "Mexican Chicken Stuffed Garlic Bread": 169, "Chicken Tikka Stuffed Garlic Bread": 169, "Chicken Peri Peri Stuffed Garlic Bread": 169, "Chicken Pepperoni Stuffed Garlic Bread": 169, "Italian Chicken Stuffed Garlic Bread": 169 }, "Garlic Bread Sides": { "Cheesy Garlic Bread (4 pcs)": 139, "Veg Supreme Garlic Bread (4 pcs)": 149, "Paneer Garlic Bread (4 pcs)": 159, "Paneer Tikka Garlic Bread (4 pcs)": 159, "Veggie Delight Garlic Bread (4 pcs)": 159, "Chicken Garlic Bread": 159 } } },
  "Nachos": { type: "items", items: { "Smoked BBQ Nachos": 139, "Tandoori Tikka Nachos": 139, "Fiery Mexi Nachos": 139, "Cheese Overload Nachos": 149, "Paneer Tikka Nachos": 169, "Paneer Mexican Nachos": 169, "Fiery Mexican Chicken Nachos": 169, "Smoked BBQ Chicken Nachos": 169, "Chicken Tandoori Nachos": 169, "Butter Chicken Nachos": 169, "Cheese Loaded Nachos": 169 } },
  "DFC": { type: "items", items: { "Crispy Chicken Strips - 3 pcs": 120, "Crispy Chicken Strips - 6 pcs": 230, "Crispy Chicken Hot Wings - 4 pcs": 140, "Crispy Chicken Hot Wings - 8 pcs": 260, "Crispy Chicken Lollypop - 4 pcs": 140, "Crispy Chicken Lollypop - 8 pcs": 260, "Chicken Pop Corn - M": 180, "Chicken Pop Corn - L": 340, "Hot & Crispy Fried Chicken - 1 pc": 90, "Hot & Crispy Fried Chicken - 2 pcs": 170, "Hot & Crispy Fried Chicken - 4 pcs": 320 } },
  "Combos": { type: "items", items: { "Chicken Zinger Combo": 299, "Crispy Wrap Combo": 299, "Crunchy Fried Chicken Meal": 299, "Hot Wings Combo": 350, "Chicken Zinger Burger + Wings Combo": 369, "Chicken Zinger Burger + Pop Corn Combo": 420, "Fried Chicken (2 pcs) Combo": 560, "10 Pcs Love That Chicken Platter": 690, "11 Pcs Fried Chicken Party Meal": 750, "Family Combo": 1150, "Chicken Pop Corn Fries": 189, "Chicken Pop Corn Nachos": 179 } },
  "Desserts": { type: "items", items: { "Choco Lava Cake": 60, "Red Velvet Lava Cake": 70, "Choco Overload Brownie": 60 } }
};

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY) return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;
    const from = msg.from; const type = msg.type;

    // ================= CHEF WINDOW =================
    if (from === CHEF && type === 'text') {
      const text = msg.text.body.trim(); const match = text.match(/^(\d+)\s+(.*)/);
      if (!match) { await send(CHEF, `❌ Format: 1 Ready\nEx: 1 Ready / 1 Cooking`); return; }
      const table = match[1]; const statusMsg = match[2]; const order = chefOrders[table];
      if (!order) { await send(CHEF, `❌ No order Table ${table}`); return; }
      if (statusMsg.toLowerCase().includes('ready')) {
        order.status = "READY";
        await send(order.customer, `✅ *Your order is READY!* 🍕\n\nTable ${table}\n\n${order.orderText}\n💰 ₹${order.total}\n\nPreparing bill...`);
        await send(MANAGER, `✅ *CHEF - TABLE ${table} READY* ✅\n\n${order.orderText}\n💰 ₹${order.total}\n\nGenerating payment link...`);
        await send(CHEF, `✓ Table ${table} READY`);
        // AUTO TRIGGER PAYMENT
        setTimeout(()=> showPaymentOptions(order.customer, table), 1000);
      } else {
        order.status = statusMsg.toUpperCase();
        await send(MANAGER, `👨‍🍳 Table ${table}: ${statusMsg}\n${order.orderText}`);
        await send(CHEF, `✓ Table ${table}: ${statusMsg}`);
      }
      return;
    }

    // ================= MANAGER WINDOW - APPROVAL + PAYMENT CONFIRM =================
    if (from === MANAGER && type === 'text') {
      const text = msg.text.body.trim(); const match = text.match(/^(\d+)\s+(.*)/);
      if (!match) {
        let lastTable = Object.keys(orders).pop();
        if (lastTable && text.toLowerCase().includes('approved')) {
          const order = chefOrders[lastTable];
          if (order) {
            order.status = "PENDING";
            await send(CHEF, `🔔 *NEW ORDER TABLE ${lastTable}*\n\n${order.orderText}\n💰 ₹${order.total}\n\nPENDING ⏳\nReply ${lastTable} Ready`);
            await send(MANAGER, `✅ Table ${lastTable} → Chef PENDING`);
            await send(order.customer, `✅ Approved Table ${lastTable} → Cooking 👨‍🍳`);
            return;
          }
        }
        await send(MANAGER, `❌ Format:\n${lastTable||1} Approved\n${lastTable||1} Paid\n${lastTable||1} Paid Cash`); return;
      }
      const table = match[1]; const reply = match[2].toLowerCase(); const order = chefOrders[table] || payments[table];

      // APPROVE
      if (reply.includes('approv') || reply.includes('ok') &&!reply.includes('paid')) {
        if (!chefOrders[table]) { await send(MANAGER, `❌ No order Table ${table}`); return; }
        chefOrders[table].status = "PENDING";
        await send(CHEF, `🔔 *NEW ORDER TABLE ${table}*\n\n${chefOrders[table].orderText}\n💰 ₹${chefOrders[table].total}\n\nPENDING ⏳\n${table} Ready`);
        await send(MANAGER, `✅ Table ${table} → Chef PENDING`);
        await send(chefOrders[table].customer, `✅ Table ${table} approved → Cooking 👨‍🍳`);
        return;
      }

      // PAYMENT CONFIRMATION
      if (reply.includes('paid')) {
        const pay = payments[table];
        if (!pay) { await send(MANAGER, `❌ No payment pending Table ${table}`); return; }

        const isCash = reply.includes('cash');
        const isUPI = reply.includes('upi');
        const method = isCash? "CASH" : isUPI? "UPI" : "UPI/CASH";
        pay.status = "PAID";
        pay.method = method;

        // BEEP + CONFIRMATION
        await send(MANAGER, `🔔🔔🔔 *PAYMENT CONFIRMED* 🔔🔔🔔\n\n✅ Table ${table} PAID ✅\n\n💰 Amount: ₹${pay.total}\nMethod: ${method}\nCustomer: ${pay.customer}\n\nStatus: PAID ✅\n\nTable ${table} free now.\nAmount added: ₹${pay.total}`);

        await send(pay.customer, `✅ *PAYMENT SUCCESSFUL* ✅\n\nTable ${table}\n💰 Amount: ₹${pay.total}\nMethod: ${method}\nStatus: PAID ✅\n\nThank you! Visit again 🍕\n\n⏰ Chat will auto-close in 2 hours.`);

        // Also inform chef
        await send(CHEF, `💰 Table ${table} PAID - ₹${pay.total} (${method}) - Table free`);

        // Keep chat open 2hr then close, but mark paid
        closeChatAfter2Hour(pay.customer, table);
        return;
      }

      if (reply.includes('reject')) {
        if (order) { await send(order.customer, `❌ Table ${table} rejected\nM = Menu`); delete chefOrders[table]; }
        return;
      }
      if (orders[table]) { await send(orders[table], `Manager Table ${table}: ${match[2]}`); }
      return;
    }

    // ================= CUSTOMER =================
    if (type === 'location') {
      const lat = msg.location.latitude; const lon = msg.location.longitude;
      const table = getCustomerTable(from); orders[table]=from; locationShared[from]=true;
      createCustomerState(from, table); const state=customerStates[from]; state.step="MAIN_MENU";
      await send(from, `📍 *LOCATION SAVED* ✅\n\nTable: ${table}\nWelcome to Darbar Pizza 🍕`);
      await showMainMenu(from);
      await send(MANAGER, `📍 NEW TABLE ${table}\n${from}\nhttps://maps.google.com/?q=${lat},${lon}`);
      closeChatAfter2Hour(from, table);
      return;
    }

    if (type === 'text') {
      const text = msg.text.body.trim(); const lower = normalize(text);
      if (lower.startsWith("hi") || lower==="hello" || lower==="hey") {
        const m = text.match(/\d+/); const table = m?m[0]:"0";
        orders[table]=from; locationShared[from]=false; createCustomerState(from, table);
        await send(from, `👋 *WELCOME DARBAR PIZZA* 🍕\n\nTable: ${table}\n\n📍 Share location\nAttach → Location → Send Current Location`);
        return;
      }
      if (!locationShared[from]) {
        await send(from, `📍 *Share location first* 🙏\n\nTable: ${getCustomerTable(from)}\n\nAttach → Location → Send`);
        return;
      }

      const state=getCustomerState(from);

      // PAYMENT STEP
      if (state.step === "PAYMENT") {
        const table = state.table || getCustomerTable(from);
        const pay = payments[table];
        if (!pay) { state.step="MAIN_MENU"; await showMainMenu(from); return; }

        if (lower === "1" || lower.includes("upi")) {
          pay.method = "UPI";
          pay.status = "WAITING_CONFIRMATION";
          await send(from, `📱 *UPI Selected*\n\n💰 Amount: ₹${pay.total}\n\n🔗 Pay Link:\n${pay.upiLink}\n\nQR:\nhttps://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pay.upiLink)}\n\nAfter paying, type: Paid\n\nWaiting for manager confirmation...`);
          await send(MANAGER, `🔔🔔🔔 Table ${table} chose UPI - ₹${pay.total}\n\nCustomer clicked UPI.\n\nVerify payment in your UPI app, then type:\n${table} Paid\n${table} Paid UPI ${pay.total}\n\n🔔 Beep! Check UPI!`);
          closeChatAfter2Hour(from, table);
          return;
        }
        if (lower === "2" || lower.includes("cash")) {
          pay.method = "CASH";
          pay.status = "WAITING_CONFIRMATION";
          await send(from, `💵 *CASH Selected*\n\n💰 Amount: ₹${pay.total}\n\nPlease pay cash to waiter / counter.\n\nType: Paid after cash given\n\nWaiting for manager...`);
          await send(MANAGER, `🔔🔔🔔 Table ${table} chose CASH - ₹${pay.total}\n\n🔔 Beep! Collect cash!\n\nCollect ₹${pay.total} from Table ${table}, then type:\n${table} Paid Cash\n${table} Paid`);
          closeChatAfter2Hour(from, table);
          return;
        }
        if (lower.includes("paid")) {
          await send(from, `⌛ Payment marked. Waiting for manager confirmation...\n\nManager will confirm in a moment.`);
          await send(MANAGER, `🔔 Table ${table} says PAID - ₹${pay.total} - Please verify and confirm:\n${table} Paid`);
          return;
        }
        await send(from, `💳 *PAYMENT Table ${table}*\n💰 ₹${pay.total}\n\n1️⃣ UPI\n2️⃣ Cash\n\nReply 1 or 2`);
        return;
      }

      if (lower==="m"||lower==="menu"){ state.step="MAIN_MENU"; await showMainMenu(from); return; }
      if (lower==="c"||lower==="cart"){ await showCart(from); return; }
      if (lower==="b"||lower==="back"){ await handleBack(from); return; }

      if (state.step==="MAIN_MENU"){
        const cats=Object.keys(MENU); const num=parseInt(text);
        if(isNaN(num)||num<1||num>cats.length){ await send(from,`❌ Choose 1-${cats.length}`); return; }
        await showCategoryMenu(from,cats[num-1]); return;
      }
      if (state.step==="SECTION"){
        const cat=MENU[state.category]; const secs=Object.keys(cat.sections); const num=parseInt(text);
        if(isNaN(num)||num<1||num>secs.length){ await send(from,`❌ Invalid`); return; }
        state.section=secs[num-1]; await showItems(from, state.category, cat.sections[state.section]); return;
      }
      if (state.step==="ITEM"){
        const cat=MENU[state.category]; let items=state.section?cat.sections[state.section]:cat.items;
        const names=Object.keys(items); const num=parseInt(text);
        if(isNaN(num)||num<1||num>names.length){ await send(from,`❌ Invalid`); return; }
        await showItemOptions(from, names[num-1], items[names[num-1]]); return;
      }
      if (state.step==="SIZE"){
        const map={"1":"R","2":"M","3":"L","4":"XL"}; if(!map[text]){ await send(from,`❌ 1=R 2=M 3=L 4=XL`); return; }
        state.size=map[text]; const cat=MENU[state.category]; let items=state.section?cat.sections[state.section]:cat.items;
        state.selectedPrice=items[state.item][state.size]; state.step="QUANTITY";
        await send(from,`🍕 ${state.item} Size ${state.size} ₹${state.selectedPrice}\nHow many?`); return;
      }
      if (state.step==="QUANTITY"){
        const q=parseInt(text); if(isNaN(q)||q<=0){ await send(from,`❌ Qty`); return; }
        await addToCart(from,q); return;
      }
      if (state.step==="AFTER_ADD"){
        if(text==="1"){ state.step="MAIN_MENU"; await showMainMenu(from); return; }
        if(text==="2"){ await showCart(from); return; }
        if(text==="3"){ await checkout(from); return; }
        return;
      }
      if (state.step==="CART"){
        if(text==="1"){ state.step="MAIN_MENU"; await showMainMenu(from); return; }
        if(text==="2"){ await checkout(from); return; }
        if(text==="3"){ await clearCart(from); return; }
        return;
      }
      if (state.step==="CONFIRM_ORDER"){
        if(text==="1"){ await sendOrderToManager(from); return; }
        if(text==="2"){ state.step="MAIN_MENU"; await showMainMenu(from); return; }
        if(text==="3"){ state.cart=[]; state.step="MAIN_MENU"; await send(from,`❌ Cancelled`); await showMainMenu(from); return; }
        return;
      }
      if (state.step==="WAITING_MANAGER"){
        await send(from,`⌛ Waiting manager approval...`); return;
      }
    }
  } catch(e){ console.error(e.response?.data||e.message); }
});

app.get('/', (req,res)=>{ res.send(`Darbar Pizza Running 🍕<br>Manager: ${MANAGER}<br>Chef: ${CHEF}<br>UPI: ${MERCHANT_UPI}<br><a href="/qr">QR Codes</a> | <a href="/payqr">Merchant UPI QR</a>`); });
app.get('/qr',(req,res)=>{
  res.send(`<html><head><title>QR</title><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script><style>body{font-family:Arial;text-align:center}.card{display:inline-block;padding:15px;margin:10px;box-shadow:0 2px 8px #0002;border-radius:12px}</style></head><body><h1>🍕 Table QR</h1><div id="qrs"></div><script>let c=document.getElementById('qrs');for(let i=1;i<=10;i++){let d=document.createElement('div');d.className='card';d.innerHTML='<h3>Table '+i+'</h3><div id="qr-'+i+'"></div>';c.appendChild(d);new QRCode(document.getElementById('qr-'+i),{text:'https://wa.me/${WHATSAPP_NUM}?text=Hi%20Table%20'+i,width:180,height:180});}</script></body></html>`);
});
app.get('/payqr',(req,res)=>{
  const upi = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&cu=INR`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upi)}`;
  res.send(`<html><body style="text-align:center;font-family:Arial"><h1>Merchant UPI QR</h1><p>${MERCHANT_UPI} - ${MERCHANT_NAME}</p><img src="${qr}"/><p>Scan to Pay (Enter amount manually)</p><p>UPI Link: ${upi}</p></body></html>`);
});

app.listen(PORT,()=>console.log(`Running ${PORT}`));
