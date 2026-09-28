const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY = process.env.VERIFY_TOKEN;
const MANAGER = process.env.MANAGER_NUMBER;
const WHATSAPP_NUM = "919834309809"; // Your bot number

/*

DATA

*/
const orders = {};
const customerStates = {};
const locationShared = {}; // NEW - track who shared location

/*

MENU - YOUR FULL MENU

*/
const MENU = {
  "Veg Pizza": {
    type: "sections",
    sections: {
      "Darbar E Classic": {
        "Margherita": { R: 130, M: 180, L: 240, XL: 320 },
        "Double Cheese Margherita": { R: 170, M: 210, L: 290, XL: 380 },
        "Pesto Margherita Paradiso": { R: 160, M: 210, L: 280, XL: 380 },
        "Cheese & Corn": { R: 160, M: 200, L: 270, XL: 360 },
        "Corn Fusion": { R: 180, M: 230, L: 330, XL: 420 },
        "Farm Fresh": { R: 170, M: 220, L: 320, XL: 400 },
        "Corn & Veggie Delight": { R: 180, M: 230, L: 330, XL: 420 },
        "Spicy Corn Mexicano": { R: 180, M: 230, L: 330, XL: 420 },
        "Cheese Garlic": { R: 150, M: 200, L: 240, XL: 320 },
        "Achari Do Pyaza": { R: 169, M: 209, L: 290, XL: 380 }
      },
      "Darbar E Exotic": {
        "Paneer Makhani": { R: 210, M: 270, L: 370, XL: 490 },
        "Spicy Paneer": { R: 210, M: 270, L: 370, XL: 490 },
        "Paneer Tikka": { R: 210, M: 270, L: 370, XL: 490 },
        "Farm House": { R: 210, M: 270, L: 370, XL: 490 },
        "Veggie Paradise": { R: 210, M: 270, L: 370, XL: 490 },
        "Mexican Green Wave": { R: 210, M: 270, L: 370, XL: 490 },
        "Spiced Paneer": { R: 210, M: 270, L: 370, XL: 490 },
        "Tandoori Paneer": { R: 210, M: 270, L: 370, XL: 490 },
        "Pesto Paneer Paradiso": { R: 210, M: 270, L: 370, XL: 490 }
      },
      "Darbar E Super Exotic": {
        "Paneer Overload": { R: 240, M: 310, L: 420, XL: 550 },
        "Maharaja Veg": { R: 240, M: 310, L: 420, XL: 550 },
        "All Veggies Madness": { R: 240, M: 310, L: 420, XL: 550 },
        "Crowded House": { R: 240, M: 310, L: 420, XL: 550 },
        "Indie Tandoori Paneer": { R: 240, M: 310, L: 420, XL: 550 },
        "Double Paneer Supreme": { R: 240, M: 310, L: 420, XL: 550 },
        "Devils Spiced Paneer": { R: 249, M: 319, L: 440, XL: 579 }
      },
      "Darbar E Spicy Schezwan": {
        "Veggie Schezwan Delight": { R: 200, M: 260, L: 350, XL: 480 },
        "Schezwan Paneer": { R: 220, M: 310, L: 400, XL: 540 },
        "Schezwan Madness": { R: 220, M: 310, L: 400, XL: 540 }
      }
    }
  },
  "Non-Veg Pizza": {
    type: "sections",
    sections: {
      "Darbar E Classic": {
        "Pepper BBQ Chicken": { R: 200, M: 250, L: 350, XL: 460 },
        "Pepper BBQ Chicken & Onion": { R: 200, M: 250, L: 350, XL: 470 },
        "Chicken Makhani": { R: 200, M: 250, L: 350, XL: 470 },
        "Chicken Sausage": { R: 200, M: 250, L: 350, XL: 470 },
        "Chicken Pepperoni": { R: 200, M: 250, L: 350, XL: 460 },
        "Chicken Seekh Kebab": { R: 200, M: 250, L: 350, XL: 470 },
        "Chicken Pepper Crunch": { R: 200, M: 250, L: 350, XL: 480 },
        "Chicken Cheese Garlic": { R: 200, M: 250, L: 350, XL: 460 },
        "Italian Chicken Feast": { R: 200, M: 250, L: 350, XL: 460 },
        "Chicken Achari Do Pyaza": { R: 209, M: 260, L: 360, XL: 480 }
      },
      "Darbar E Exotic": {
        "Mexican Chicken": { R: 220, M: 270, L: 370, XL: 500 },
        "Chicken Peri Peri": { R: 220, M: 270, L: 370, XL: 500 },
        "Chicken Tikka": { R: 220, M: 270, L: 370, XL: 500 },
        "Darbar Delight": { R: 220, M: 270, L: 370, XL: 500 },
        "Indie Tandoori Chicken": { R: 220, M: 270, L: 370, XL: 500 },
        "Spicy Chicken & Corn": { R: 220, M: 270, L: 370, XL: 500 },
        "Fire Me Up Chicken": { R: 220, M: 270, L: 370, XL: 500 },
        "Double Trouble": { R: 220, M: 270, L: 370, XL: 500 },
        "Pesto Chicken Paradiso": { R: 220, M: 270, L: 370, XL: 500 }
      },
      "Darbar E Super Exotic": {
        "Darbar Chicken Special": { R: 240, M: 310, L: 420, XL: 550 },
        "Chicken Full Smash": { R: 240, M: 310, L: 420, XL: 550 },
        "Fantastic Four": { R: 240, M: 310, L: 420, XL: 550 },
        "Butter Chicken": { R: 240, M: 310, L: 420, XL: 550 },
        "Non Veg Supreme": { R: 240, M: 310, L: 420, XL: 550 },
        "The Meat Eater": { R: 260, M: 330, L: 450, XL: 600 },
        "Devils Chicken Pizza": { R: 249, M: 319, L: 440, XL: 579 }
      },
      "Darbar E Spicy Schezwan": {
        "Schezwan Chicken Delight": { R: 220, M: 310, L: 400, XL: 540 },
        "Schezwan Chicken Supreme": { R: 220, M: 310, L: 400, XL: 540 }
      }
    }
  },
  "Beverages": {
    type: "sections",
    sections: {
      "Fruity Shakes": {
        "Strawberry Milkshake": 129, "Blueberry Milkshake": 129, "Mango Milkshake": 129, "Kiwi Milkshake": 129,
        "Strawberry Banana Milkshake": 129, "Berry Blast Milkshake": 129, "Strawberry Cheese Cake": 129, "Blueberry Cheese Cake": 129
      },
      "Exotic Shakes": {
        "Vanilla Milkshake": 119, "Bubblegum Milkshake": 119, "Butterscotch Milkshake": 119,
        "Salted Caramel Milkshake": 119, "Strawberry Cookie Shake": 119, "Toffee Shake": 119
      },
      "Chocolate Shakes": {
        "Chocolate Milkshake": 129, "Oreo Milkshake": 129, "KitKat Milkshake": 129,
        "Snicker Milkshake": 129, "Choco-Hazelnut Milkshake": 129, "Chocolate Bounty Milkshake": 129
      },
      "Cold Coffee": { "Cold Coffee": 109, "Coffee Mocha": 109, "Irish Coffee": 109, "Hazelnut": 109, "Tiramisu": 109 },
      "Mojitos": {
        "Mint Mojito": 99, "Blue Mojito": 99, "Watermelon Mojito": 99, "Green Apple Mojito": 99,
        "Blueberry Mojito": 99, "Peach Mojito": 99, "Mango Mojito": 99, "Kiwi Mojito": 99
      },
      "Lemonade": { "Plain Lemonade": 79, "Watermelon Lemonade": 89, "Green Apple Lemonade": 89, "Cucumber Lemonade": 89 },
      "Coolers / Refreshers": {
        "Kala Khata Twist": 89, "Chilli Guava": 89, "Cumin Masala": 89, "Tangy Mango": 89,
        "Nimbu Masala": 89, "Blueberry Cooler": 89, "Very Berry Lemonade": 89, "Mosambi Cooler": 89
      },
      "Ice Tea": {
        "Lemon Ice Tea": 79, "Peach Ice Tea": 79, "Watermelon Ice Tea": 79, "Cucumber Ice Tea": 79,
        "Blueberry Ice Tea": 79, "Mango Ice Tea": 79, "Passion Fruit Ice Tea": 79, "Green Apple Ice Tea": 79
      },
      "Soft Drinks & Juices": { "Coca-Cola": 40, "Sprite": 40, "Mix Fruit Juice": 50 }
    }
  },
  "Starters": {
    type: "items",
    items: {
      "Hashbrown": 90, "Masala Wedges": 99, "Potato Shots": 99, "Cheesy Jalapeno Poppers": 99,
      "Chicken Nuggets (6 pcs)": 120, "Pizza Pockets": 130, "Crispy Chicken Strips (6 pcs)": 149, "Chicken Cheese Pockets": 160
    }
  },
  "Burgers": {
    type: "items",
    items: {
      "Classic Chicken King Burger": 100, "American Cheese Supreme Chicken Burger": 120,
      "Fiery Crunchy Chicken King Burger": 130, "Chicken Big King Burger": 190,
      "Fiery Aloo Tikki Burger": 90, "Spicy Paneer Burger": 120,
      "Veg Burger Combo": 199, "Paneer Burger Combo": 220,
      "Classic Chicken Burger Combo": 199, "Crunchy Chicken Burger Combo": 240
    }
  },
  "Sandwich": {
    type: "items",
    items: {
      "Cheese & Corn": 99, "Farm Fresh": 120, "Roasted Sandwich": 130, "Paneer Tikka": 150,
      "Paneer Chilli": 150, "Paneer Mexican": 150, "Tandoori Chicken": 150
    }
  },
  "Wraps": {
    type: "items",
    items: {
      "Aloo Tikki Wrap (Mexican)": 129, "Spicy Paneer Wrap": 149, "Paneer Tikka Wrap": 149,
      "Chicken Tandoori Zinger": 159, "Mexican Zinger": 159, "Peri Peri Wrap": 169, "Tandoori Wrap": 169
    }
  },
  "Pasta": { type: "items", items: { "Chicken Tikka Pasta": 160, "Paneer Tikka Pasta": 160 } },
  "Garlic Bread": {
    type: "sections",
    sections: {
      "Veg Stuffed Garlic Bread": {
        "Garlic Bread Sticks": 90, "Mexican Stuffed Garlic Bread": 149,
        "Paneer Mexicano Stuffed Garlic Bread": 169, "Paneer Peri Peri Stuffed Garlic Bread": 169,
        "Paneer Tikka Stuffed Garlic Bread": 169
      },
      "Chicken Stuffed Garlic Bread": {
        "Mexican Chicken Stuffed Garlic Bread": 169, "Chicken Tikka Stuffed Garlic Bread": 169,
        "Chicken Peri Peri Stuffed Garlic Bread": 169, "Chicken Pepperoni Stuffed Garlic Bread": 169,
        "Italian Chicken Stuffed Garlic Bread": 169
      },
      "Garlic Bread Sides": {
        "Cheesy Garlic Bread (4 pcs)": 139, "Veg Supreme Garlic Bread (4 pcs)": 149,
        "Paneer Garlic Bread (4 pcs)": 159, "Paneer Tikka Garlic Bread (4 pcs)": 159,
        "Veggie Delight Garlic Bread (4 pcs)": 159, "Chicken Garlic Bread": 159
      }
    }
  },
  "Nachos": {
    type: "items",
    items: {
      "Smoked BBQ Nachos": 139, "Tandoori Tikka Nachos": 139, "Fiery Mexi Nachos": 139, "Cheese Overload Nachos": 149,
      "Paneer Tikka Nachos": 169, "Paneer Mexican Nachos": 169, "Fiery Mexican Chicken Nachos": 169,
      "Smoked BBQ Chicken Nachos": 169, "Chicken Tandoori Nachos": 169, "Butter Chicken Nachos": 169, "Cheese Loaded Nachos": 169
    }
  },
  "DFC": {
    type: "items",
    items: {
      "Crispy Chicken Strips - 3 pcs": 120, "Crispy Chicken Strips - 6 pcs": 230,
      "Crispy Chicken Hot Wings - 4 pcs": 140, "Crispy Chicken Hot Wings - 8 pcs": 260,
      "Crispy Chicken Lollypop - 4 pcs": 140, "Crispy Chicken Lollypop - 8 pcs": 260,
      "Chicken Pop Corn - M": 180, "Chicken Pop Corn - L": 340,
      "Hot & Crispy Fried Chicken - 1 pc": 90, "Hot & Crispy Fried Chicken - 2 pcs": 170, "Hot & Crispy Fried Chicken - 4 pcs": 320
    }
  },
  "Combos": {
    type: "items",
    items: {
      "Chicken Zinger Combo": 299, "Crispy Wrap Combo": 299, "Crunchy Fried Chicken Meal": 299,
      "Hot Wings Combo": 350, "Chicken Zinger Burger + Wings Combo": 369,
      "Chicken Zinger Burger + Pop Corn Combo": 420, "Fried Chicken (2 pcs) Combo": 560,
      "10 Pcs Love That Chicken Platter": 690, "11 Pcs Fried Chicken Party Meal": 750,
      "Family Combo": 1150, "Chicken Pop Corn Fries": 189, "Chicken Pop Corn Nachos": 179
    }
  },
  "Desserts": { type: "items", items: { "Choco Lava Cake": 60, "Red Velvet Lava Cake": 70, "Choco Overload Brownie": 60 } }
};

/*

UTILITY

*/
async function send(to, text) {
  const maxLength = 3500;
  for (let i = 0; i < text.length; i += maxLength) {
    const chunk = text.substring(i, i + maxLength);
    await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      messaging_product: "whatsapp", to: to, type: "text", text: { body: chunk }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  }
}
function normalize(text) { return text.trim().toLowerCase(); }
function getCustomerTable(from) { return Object.keys(orders).find(table => orders[table] === from) || "0"; }
function createCustomerState(from, table) {
  customerStates[from] = { table: table, step: "MAIN_MENU", category: null, section: null, item: null, size: null, quantity: 0, cart: [] };
}
function getCustomerState(from) {
  if (!customerStates[from]) createCustomerState(from, getCustomerTable(from));
  return customerStates[from];
}
async function showMainMenu(from) {
  await send(from, `🍕 *WELCOME TO DARBAR PIZZA* 🍕\n\nPlease choose a category:\n\n1️⃣ Veg Pizza\n2️⃣ Non-Veg Pizza\n3️⃣ Beverages\n4️⃣ Starters\n5️⃣ Burgers\n6️⃣ Sandwich\n7️⃣ Wraps\n8️⃣ Pasta\n9️⃣ Garlic Bread\n🔟 Nachos\n1️⃣1️⃣ DFC\n1️⃣2️⃣ Combos\n1️⃣3️⃣ Desserts\n\n━━━━━━━━━━━━━━\nReply with the number.\n\nExample: 1\n\nCommands:\n↩️ B = Back\n🏠 M = Main Menu\n🛒 C = Cart`);
}
async function showCategoryMenu(from, category) {
  const menu = MENU[category]; if (!menu) { await send(from, "❌ Category not found."); return; }
  const state = getCustomerState(from);
  state.category = category; state.section = null; state.item = null; state.size = null; state.quantity = 0;
  if (menu.type === "sections") {
    const sections = Object.keys(menu.sections);
    let message = `🍕 *${category.toUpperCase()}*\n\nPlease choose a section:\n\n`;
    sections.forEach((section, index) => { message += `${index + 1}️⃣ ${section}\n`; });
    message += `\n━━━━━━━━━━━━━━\n↩️ B = Back\n🏠 M = Main Menu\n🛒 C = Cart\n\nReply with the number.`;
    state.step = "SECTION"; await send(from, message); return;
  }
  if (menu.type === "items") { await showItems(from, category, menu.items); return; }
}
async function showItems(from, category, items) {
  const state = getCustomerState(from); const itemNames = Object.keys(items);
  let message = `🍕 *${category.toUpperCase()}*\n`; if (state.section) message += `\n📂 *${state.section}*\n`; message += `\n`;
  itemNames.forEach((item, index) => {
    const value = items[item];
    if (typeof value === "object") {
      const sizes = Object.entries(value).map(([size, price]) => `${size} ₹${price}`).join(" | ");
      message += `${index + 1}️⃣ ${item}\n ${sizes}\n`;
    } else message += `${index + 1}️⃣ ${item} - ₹${value}\n`;
  });
  message += `\n━━━━━━━━━━━━━━\nReply with item number.\n\n↩️ B = Back\n🏠 M = Main Menu\n🛒 C = Cart`;
  state.step = "ITEM"; await send(from, message);
}
async function showItemOptions(from, itemName, itemData) {
  const state = getCustomerState(from); state.item = itemName;
  if (typeof itemData === "object") {
    state.step = "SIZE";
    await send(from, `🍕 *${itemName}*\n\nChoose your size:\n\n1️⃣ Regular - ₹${itemData.R}\n2️⃣ Medium - ₹${itemData.M}\n3️⃣ Large - ₹${itemData.L}\n4️⃣ XL - ₹${itemData.XL}\n\n━━━━━━━━━━━━━━\n↩️ B = Back\n🏠 M = Main Menu\n🛒 C = Cart`); return;
  }
  state.step = "QUANTITY"; state.selectedPrice = itemData;
  await send(from, `🍽️ *${itemName}*\n\nPrice: ₹${itemData}\n\nHow many would you like?\n\nExample:\n2\n\n━━━━━━━━━━━━━━\n↩️ B = Back\n🏠 M = Main Menu\n🛒 C = Cart`);
}
async function addToCart(from, quantity) {
  const state = getCustomerState(from); let price = state.selectedPrice;
  if (state.size) {
    const category = MENU[state.category]; let items = state.section? category.sections[state.section] : category.items;
    price = items[state.item][state.size];
  }
  const total = price * quantity;
  state.cart.push({ category: state.category, section: state.section, item: state.item, size: state.size, quantity: quantity, price: price, total: total });
  state.step = "AFTER_ADD";
  await send(from, `✅ *ITEM ADDED TO CART*\n\n🍽️ ${state.item}\n${state.size? `📏 Size: ${state.size}\n` : ""}🔢 Quantity: ${quantity}\n💰 Price: ₹${total}\n\nWhat would you like to do?\n\n1️⃣ Add More Items\n2️⃣ View Cart\n3️⃣ Checkout\n\n↩️ B = Back\n🏠 M = Main Menu`);
}
async function showCart(from) {
  const state = getCustomerState(from);
  if (!state.cart || state.cart.length === 0) { await send(from, `🛒 *YOUR CART IS EMPTY*\n\nPlease select something from the menu.\n\n🏠 M = Main Menu`); return; }
  let message = `🛒 *YOUR CART*\n\n━━━━━━━━━━━━━━\n`; let grandTotal = 0;
  state.cart.forEach((cartItem, index) => {
    message += `\n${index + 1}. ${cartItem.item}\n`; if (cartItem.size) message += ` Size: ${cartItem.size}\n`;
    message += ` Qty: ${cartItem.quantity}\n ₹${cartItem.total}\n`; grandTotal += cartItem.total;
  });
  message += `\n━━━━━━━━━━━━━━\n💰 *TOTAL: ₹${grandTotal}*\n\n1️⃣ Add More Items\n2️⃣ Checkout\n3️⃣ Clear Cart\n\n↩️ B = Back\n🏠 M = Main Menu`;
  state.step = "CART"; await send(from, message);
}
function getCartTotal(state) { return state.cart.reduce((total, item) => total + item.total, 0); }
function createOrderText(state) {
  let text = ""; state.cart.forEach((item, index) => {
    text += `${index + 1}. ${item.item}`; if (item.size) text += ` (${item.size})`;
    text += ` x ${item.quantity} = ₹${item.total}\n`;
  }); return text;
}
async function checkout(from) {
  const state = getCustomerState(from);
  if (!state.cart || state.cart.length === 0) { await send(from, "🛒 Your cart is empty."); return; }
  const total = getCartTotal(state); const orderText = createOrderText(state);
  state.step = "CONFIRM_ORDER";
  await send(from, `🧾 *ORDER SUMMARY*\n\n━━━━━━━━━━━━━━\n\n${orderText}\n━━━━━━━━━━━━━━\n\n💰 *TOTAL: ₹${total}*\n\nPlease confirm your order:\n\n1️⃣ Confirm Order\n2️⃣ Add More Items\n3️⃣ Cancel Order\n\nReply with 1, 2 or 3.`);
}
async function sendOrderToManager(from) {
  const state = getCustomerState(from); const table = state.table || getCustomerTable(from);
  const total = getCartTotal(state); const orderText = createOrderText(state);
  await send(from, `✅ *ORDER CONFIRMED*\n\nTable: ${table}\n\n${orderText}\n💰 Total: ₹${total}\n\n⌛ Waiting for the restaurant manager...`);
  await send(MANAGER, `🔔 *NEW ORDER*\n\n━━━━━━━━━━━━━━\n\n🏷️ Table: ${table}\n\n${orderText}\n💰 Total: ₹${total}\n\nCustomer: ${from}\n\n━━━━━━━━━━━━━━\n\nReply:\n${table} Ready in 10 mins`);
  state.step = "WAITING_MANAGER";
}
async function clearCart(from) {
  const state = getCustomerState(from); state.cart = []; state.step = "MAIN_MENU";
  await send(from, `🗑️ Cart cleared.\n\n🏠 Returning to Main Menu...`); await showMainMenu(from);
}
async function handleBack(from) {
  const state = getCustomerState(from);
  switch (state.step) {
    case "SECTION": state.category = null; state.section = null; state.step = "MAIN_MENU"; await showMainMenu(from); break;
    case "ITEM": if (state.category) await showCategoryMenu(from, state.category); else await showMainMenu(from); break;
    case "SIZE": state.size = null;
      if (state.section) await showItems(from, state.category, MENU[state.category].sections[state.section]);
      else await showItems(from, state.category, MENU[state.category].items); break;
    case "QUANTITY": state.item = null; state.size = null;
      if (state.section) await showItems(from, state.category, MENU[state.category].sections[state.section]);
      else await showItems(from, state.category, MENU[state.category].items); break;
    case "AFTER_ADD": await showMainMenu(from); break;
    case "CART": await showMainMenu(from); break;
    case "CONFIRM_ORDER": await showCart(from); break;
    default: await showMainMenu(from);
  }
}
async function showItemsAgain(from) {
  const state = getCustomerState(from); const category = MENU[state.category];
  if (!category) { await showMainMenu(from); return; }
  if (state.section) await showItems(from, state.category, category.sections[state.section]);
  else await showItems(from, state.category, category.items);
}

/*

WEBHOOK

*/
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

    // MANAGER - SMART REPLY
    if (from === MANAGER && type === 'text') {
      const text = msg.text.body.trim();
      const match = text.match(/^(\d+)\s+(.*)/);
      if (match) {
        const table = match[1]; const reply = match[2];
        if (orders[table]) {
          await send(orders[table], `✅ *Manager Update*\n\n${reply}\n\nTable ${table}`);
          await send(MANAGER, `✓ Sent to Table ${table}`);
        } else await send(MANAGER, `❌ No customer found for Table ${table}`);
        return;
      }
      // If manager types only message without table number -> send to last table
      let lastTable = Object.keys(orders).pop();
      if (lastTable && orders[lastTable] && text.length > 1 && text.toLowerCase()!== 'yes' && text.toLowerCase()!== 'no') {
        await send(orders[lastTable], `✅ *Manager Update*\n\n${text}\n\nTable ${lastTable}`);
        await send(MANAGER, `✓ Sent to Table ${lastTable}`);
        return;
      }
      await send(MANAGER, `❌ Invalid format.\n\nSend:\n5 Ready in 10 mins`);
      return;
    }

    // LOCATION
    if (type === 'location') {
      const lat = msg.location.latitude; const lon = msg.location.longitude;
      const table = getCustomerTable(from);
      orders[table] = from;
      locationShared[from] = true;
      createCustomerState(from, table);
      const state = customerStates[from]; state.step = "MAIN_MENU";
      await send(from, `📍 *LOCATION SAVED* ✅\n\n🏷️ Table: ${table}\n\nWelcome to *Darbar Pizza* 🍕\n\nPlease choose from our menu.`);
      await showMainMenu(from);
      await send(MANAGER, `📍 *NEW TABLE*\n\nTable: ${table}\nCustomer: ${from}\nLocation: https://maps.google.com/?q=${lat},${lon}\n\nWaiting for order...`);
      return;
    }

    if (type === 'text') {
      const text = msg.text.body.trim(); const lower = normalize(text);

      // HI / TABLE SCAN
      if (lower === "hi" || lower === "hello" || lower === "hey" || lower.startsWith("hi table") || lower.includes("hi ")) {
        const tableMatch = text.match(/\d+/); const table = tableMatch? tableMatch[0] : "0";
        orders[table] = from;
        locationShared[from] = false; // FORCE location required
        createCustomerState(from, table);
        await send(from, `👋 *WELCOME TO DARBAR PIZZA* 🍕\n\n🏷️ Table: ${table}\n\n📍 Please share your location.\n\nWhatsApp:\nAttach → Location → Send Your Current Location\n\nAfter location I will show you menu.`);
        return;
      }

      // === LOCATION GATE - NEW LOGIC ===
      // If customer has NOT shared location, ANY message (No, emoji, number, etc) -> ask location again
      if (!locationShared[from]) {
        const table = getCustomerTable(from);
        await send(from, `📍 *Please share your location first* 🙏\n\n🏷️ Table: ${table}\n\nTo see menu, share your location:\n\n📎 Attach → Location → Send Current Location\n\nI will show menu after location.`);
        return;
      }

      // After location shared - normal menu flow
      const state = getCustomerState(from);
      if (lower === "m" || lower === "menu") { state.step = "MAIN_MENU"; await showMainMenu(from); return; }
      if (lower === "c" || lower === "cart") { await showCart(from); return; }
      if (lower === "b" || lower === "back") { await handleBack(from); return; }

      if (state.step === "MAIN_MENU") {
        const categories = Object.keys(MENU); const number = parseInt(text);
        if (isNaN(number) || number < 1 || number > categories.length) {
          await send(from, `❌ Invalid option.\n\nPlease choose 1 to ${categories.length}.\n\nB = Back\nM = Main Menu\nC = Cart`); return;
        }
        await showCategoryMenu(from, categories[number - 1]); return;
      }
      if (state.step === "SECTION") {
        const category = MENU[state.category]; const sections = Object.keys(category.sections); const number = parseInt(text);
        if (isNaN(number) || number < 1 || number > sections.length) {
          await send(from, `❌ Invalid section.\n\nB = Back\nM = Main Menu\nC = Cart`); return;
        }
        state.section = sections[number - 1]; await showItems(from, state.category, category.sections[state.section]); return;
      }
      if (state.step === "ITEM") {
        const category = MENU[state.category]; let items = state.section? category.sections[state.section] : category.items;
        const itemNames = Object.keys(items); const number = parseInt(text);
        if (isNaN(number) || number < 1 || number > itemNames.length) {
          await send(from, `❌ Invalid item.\n\nB = Back\nM = Main Menu\nC = Cart`); return;
        }
        await showItemOptions(from, itemNames[number - 1], items[itemNames[number - 1]]); return;
      }
      if (state.step === "SIZE") {
        const sizeMap = { "1": "R", "2": "M", "3": "L", "4": "XL" };
        if (!sizeMap[text]) { await send(from, `❌ Invalid size.\n\n1️⃣ Regular\n2️⃣ Medium\n3️⃣ Large\n4️⃣ XL\n\nB = Back`); return; }
        state.size = sizeMap[text];
        const category = MENU[state.category]; let items = state.section? category.sections[state.section] : category.items;
        state.selectedPrice = items[state.item][state.size];
        state.step = "QUANTITY";
        await send(from, `🍕 *${state.item}*\n\nSize: ${state.size}\nPrice: ₹${state.selectedPrice}\n\nHow many?\n\nExample: 2\n\nB = Back`); return;
      }
      if (state.step === "QUANTITY") {
        const quantity = parseInt(text);
        if (isNaN(quantity) || quantity <= 0 || quantity > 50) { await send(from, `❌ Enter valid quantity.\n\nExample: 2`); return; }
        await addToCart(from, quantity); return;
      }
      if (state.step === "AFTER_ADD") {
        if (text === "1") { state.step = "MAIN_MENU"; await showMainMenu(from); return; }
        if (text === "2") { await showCart(from); return; }
        if (text === "3") { await checkout(from); return; }
        await send(from, `Please choose:\n\n1️⃣ Add More Items\n2️⃣ View Cart\n3️⃣ Checkout`); return;
      }
      if (state.step === "CART") {
        if (text === "1") { state.step = "MAIN_MENU"; await showMainMenu(from); return; }
        if (text === "2") { await checkout(from); return; }
        if (text === "3") { await clearCart(from); return; }
        await send(from, `Please choose:\n\n1️⃣ Add More Items\n2️⃣ Checkout\n3️⃣ Clear Cart`); return;
      }
      if (state.step === "CONFIRM_ORDER") {
        if (text === "1") { await sendOrderToManager(from); return; }
        if (text === "2") { state.step = "MAIN_MENU"; await showMainMenu(from); return; }
        if (text === "3") { state.cart = []; state.step = "MAIN_MENU"; await send(from, `❌ Order cancelled.\n\nReturning to Main Menu...`); await showMainMenu(from); return; }
        await send(from, `Please select:\n\n1️⃣ Confirm Order\n2️⃣ Add More Items\n3️⃣ Cancel Order`); return;
      }
      if (state.step === "WAITING_MANAGER") {
        await send(from, `⌛ Your order already sent to restaurant.\n\nPlease wait for manager update.\n\n🏠 M = Main Menu`); return;
      }
      await send(from, `I didn't understand.\n\nM = Main Menu\nC = Cart\nB = Back`);
    }
  } catch (error) {
    console.error("Webhook Error:", error.response?.data || error.message || error);
  }
});

/*

QR PAGE + HEALTH

*/
app.get('/', (req, res) => {
  res.send(`
  <html><head><title>Darbar Pizza QR</title><meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <style>body{font-family:Arial;text-align:center;background:#fff;padding:20px}.card{display:inline-block;background:white;padding:15px;margin:10px;border-radius:12px;box-shadow:0 2px 8px #0002}</style>
  </head><body>
  <h1>🍕 Darbar Pizza - Table QR Codes</h1>
  <p>Print & stick on tables - Scan opens WhatsApp</p>
  <p>Bot Status: Running ✅ | Manager: ${MANAGER}</p>
  <div id="qrs"></div>
  <script>
    let container=document.getElementById('qrs');
    for(let i=1;i<=10;i++){
      let div=document.createElement('div'); div.className='card';
      div.innerHTML='<h3>Table '+i+'</h3><div id="qr-'+i+'"></div><div style="margin-top:8px"><a target="_blank" href="https://wa.me/${WHATSAPP_NUM}?text=Hi%20Table%20'+i+'">Table '+i+' Link</a></div>';
      container.appendChild(div);
      new QRCode(document.getElementById('qr-'+i), {text:'https://wa.me/${WHATSAPP_NUM}?text=Hi%20Table%20'+i, width:180, height:180});
    }
  </script>
  </body></html>
  `);
});

app.listen(PORT, () => console.log(`Darbar Pizza Bot running on ${PORT}`));
