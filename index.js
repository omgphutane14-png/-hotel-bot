const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY = process.env.VERIFY_TOKEN;

const MANAGER = process.env.MANAGER_NUMBER;
const CHEF = process.env.CHEF_NUMBER;

const MERCHANT_UPI =
  process.env.MERCHANT_UPI_ID || "rushikeshphutane1@ybl";

const MERCHANT_NAME =
  process.env.MERCHANT_NAME || "Darbar Pizza";

const WHATSAPP_NUM = "919834309809";

/*
=========================================================
DATA
=========================================================
*/

// table -> customer number
const orders = {};

// customer -> state
const customerStates = {};

// table -> chef order
const chefOrders = {};

// table -> payment
const payments = {};

// customer -> inactivity timer
const sessionTimers = {};

// table -> session
const tableSessions = {};


/*
=========================================================
SESSION SETTINGS
=========================================================
*/

const SESSION_TIMEOUT =
  2 * 60 * 60 * 1000;


/*
=========================================================
SEND WHATSAPP MESSAGE
=========================================================
*/

async function send(to, text) {

  if (!to) return;

  for (let i = 0; i < text.length; i += 3500) {

    const chunk = text.substring(i, i + 3500);

    try {

      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: {
            body: chunk
          }
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

    } catch (error) {

      console.error(
        "WhatsApp send error:",
        error.response?.data || error.message
      );
    }
  }
}


/*
=========================================================
UTILITY
=========================================================
*/

function normalize(text) {

  return text
    .trim()
    .toLowerCase();
}


function getCustomerTable(from) {

  return (
    Object.keys(orders).find(
      table => orders[table] === from
    ) || "0"
  );
}


function createCustomerState(from, table) {

  customerStates[from] = {

    table,

    step: "MAIN_MENU",

    category: null,

    section: null,

    item: null,

    size: null,

    quantity: 0,

    selectedPrice: 0,

    cart: [],

    sessionActive: true,

    lastActivity: Date.now()
  };
}


function getCustomerState(from) {

  if (!customerStates[from]) {

    createCustomerState(
      from,
      getCustomerTable(from)
    );
  }

  return customerStates[from];
}


/*
=========================================================
SESSION MANAGEMENT
=========================================================
*/

/*
Every customer message resets the 2-hour timer.
*/

function refreshSession(from) {

  const state = customerStates[from];

  if (!state) return;

  state.lastActivity = Date.now();
  state.sessionActive = true;

  if (sessionTimers[from]) {

    clearTimeout(
      sessionTimers[from]
    );
  }

  sessionTimers[from] = setTimeout(
    () => expireCustomerSession(from),
    SESSION_TIMEOUT
  );
}


/*
=========================================================
EXPIRE SESSION
=========================================================
*/

async function expireCustomerSession(from) {

  const state = customerStates[from];

  if (!state) return;

  const table = state.table;

  try {

    await send(
      from,
      `
⏰ *SESSION CLOSED*

Your Table ${table} WhatsApp ordering session has expired after 2 hours of inactivity.

Thank you for visiting ${MERCHANT_NAME} 🍕

To place a new order, please scan the Table QR code again.
`
    );

  } catch (error) {

    console.error(
      "Session close error:",
      error.message
    );
  }


  /*
  Mark session inactive
  */

  state.sessionActive = false;


  /*
  Remove active customer/table mapping
  */

  delete orders[table];

  delete customerStates[from];

  delete tableSessions[table];

  /*
  Keep completed payment/order history in memory
  if you want reporting later.
  */

  delete sessionTimers[from];
}


/*
=========================================================
CHECK SESSION
=========================================================
*/

function isSessionActive(from) {

  const state = customerStates[from];

  if (!state) return false;

  if (!state.sessionActive) return false;

  const elapsed =
    Date.now() - state.lastActivity;

  if (elapsed >= SESSION_TIMEOUT) {

    state.sessionActive = false;

    return false;
  }

  return true;
}


/*
=========================================================
MENU
=========================================================
*/

const MENU = {

  "Veg Pizza": {

    type: "sections",

    sections: {

      "Darbar E Classic": {

        "Margherita": {
          R: 130,
          M: 180,
          L: 240,
          XL: 320
        },

        "Double Cheese Margherita": {
          R: 170,
          M: 210,
          L: 290,
          XL: 380
        },

        "Pesto Margherita Paradiso": {
          R: 160,
          M: 210,
          L: 280,
          XL: 380
        },

        "Cheese & Corn": {
          R: 160,
          M: 200,
          L: 270,
          XL: 360
        },

        "Corn Fusion": {
          R: 180,
          M: 230,
          L: 330,
          XL: 420
        },

        "Farm Fresh": {
          R: 170,
          M: 220,
          L: 320,
          XL: 400
        },

        "Corn & Veggie Delight": {
          R: 180,
          M: 230,
          L: 330,
          XL: 420
        },

        "Spicy Corn Mexicano": {
          R: 180,
          M: 230,
          L: 330,
          XL: 420
        },

        "Cheese Garlic": {
          R: 150,
          M: 200,
          L: 240,
          XL: 320
        },

        "Achari Do Pyaza": {
          R: 169,
          M: 209,
          L: 290,
          XL: 380
        }
      },


      "Darbar E Exotic": {

        "Paneer Makhani": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Spicy Paneer": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Paneer Tikka": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Farm House": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Veggie Paradise": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Mexican Green Wave": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Spiced Paneer": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Tandoori Paneer": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        },

        "Pesto Paneer Paradiso": {
          R: 210,
          M: 270,
          L: 370,
          XL: 490
        }
      },


      "Darbar E Super Exotic": {

        "Paneer Overload": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Maharaja Veg": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "All Veggies Madness": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Crowded House": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Indie Tandoori Paneer": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Double Paneer Supreme": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Devils Spiced Paneer": {
          R: 249,
          M: 319,
          L: 440,
          XL: 579
        }
      },


      "Darbar E Spicy Schezwan": {

        "Veggie Schezwan Delight": {
          R: 200,
          M: 260,
          L: 350,
          XL: 480
        },

        "Schezwan Paneer": {
          R: 220,
          M: 310,
          L: 400,
          XL: 540
        },

        "Schezwan Madness": {
          R: 220,
          M: 310,
          L: 400,
          XL: 540
        }
      }
    }
  },


  "Non-Veg Pizza": {

    type: "sections",

    sections: {

      "Darbar E Classic": {

        "Pepper BBQ Chicken": {
          R: 200,
          M: 250,
          L: 350,
          XL: 460
        },

        "Pepper BBQ Chicken & Onion": {
          R: 200,
          M: 250,
          L: 350,
          XL: 470
        },

        "Chicken Makhani": {
          R: 200,
          M: 250,
          L: 350,
          XL: 470
        },

        "Chicken Sausage": {
          R: 200,
          M: 250,
          L: 350,
          XL: 470
        },

        "Chicken Pepperoni": {
          R: 200,
          M: 250,
          L: 350,
          XL: 460
        },

        "Chicken Seekh Kebab": {
          R: 200,
          M: 250,
          L: 350,
          XL: 470
        },

        "Chicken Pepper Crunch": {
          R: 200,
          M: 250,
          L: 350,
          XL: 480
        },

        "Chicken Cheese Garlic": {
          R: 200,
          M: 250,
          L: 350,
          XL: 460
        },

        "Italian Chicken Feast": {
          R: 200,
          M: 250,
          L: 350,
          XL: 460
        },

        "Chicken Achari Do Pyaza": {
          R: 209,
          M: 260,
          L: 360,
          XL: 480
        }
      },


      "Darbar E Exotic": {

        "Mexican Chicken": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Chicken Peri Peri": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Chicken Tikka": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Darbar Delight": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Indie Tandoori Chicken": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Spicy Chicken & Corn": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Fire Me Up Chicken": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Double Trouble": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        },

        "Pesto Chicken Paradiso": {
          R: 220,
          M: 270,
          L: 370,
          XL: 500
        }
      },


      "Darbar E Super Exotic": {

        "Darbar Chicken Special": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Chicken Full Smash": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Fantastic Four": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Butter Chicken": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "Non Veg Supreme": {
          R: 240,
          M: 310,
          L: 420,
          XL: 550
        },

        "The Meat Eater": {
          R: 260,
          M: 330,
          L: 450,
          XL: 600
        },

        "Devils Chicken Pizza": {
          R: 249,
          M: 319,
          L: 440,
          XL: 579
        }
      },


      "Darbar E Spicy Schezwan": {

        "Schezwan Chicken Delight": {
          R: 220,
          M: 310,
          L: 400,
          XL: 540
        },

        "Schezwan Chicken Supreme": {
          R: 220,
          M: 310,
          L: 400,
          XL: 540
        }
      }
    }
  },


  "Beverages": {

    type: "sections",

    sections: {

      "Fruity Shakes": {
        "Strawberry Milkshake": 129,
        "Blueberry Milkshake": 129,
        "Mango Milkshake": 129,
        "Kiwi Milkshake": 129,
        "Strawberry Banana Milkshake": 129,
        "Berry Blast Milkshake": 129,
        "Strawberry Cheese Cake": 129,
        "Blueberry Cheese Cake": 129
      },

      "Exotic Shakes": {
        "Vanilla Milkshake": 119,
        "Bubblegum Milkshake": 119,
        "Butterscotch Milkshake": 119,
        "Salted Caramel Milkshake": 119,
        "Strawberry Cookie Shake": 119,
        "Toffee Shake": 119
      },

      "Chocolate Shakes": {
        "Chocolate Milkshake": 129,
        "Oreo Milkshake": 129,
        "KitKat Milkshake": 129,
        "Snicker Milkshake": 129,
        "Choco-Hazelnut Milkshake": 129,
        "Chocolate Bounty Milkshake": 129
      },

      "Cold Coffee": {
        "Cold Coffee": 109,
        "Coffee Mocha": 109,
        "Irish Coffee": 109,
        "Hazelnut": 109,
        "Tiramisu": 109
      },

      "Mojitos": {
        "Mint Mojito": 99,
        "Blue Mojito": 99,
        "Watermelon Mojito": 99,
        "Green Apple Mojito": 99,
        "Blueberry Mojito": 99,
        "Peach Mojito": 99,
        "Mango Mojito": 99,
        "Kiwi Mojito": 99
      },

      "Lemonade": {
        "Plain Lemonade": 79,
        "Watermelon Lemonade": 89,
        "Green Apple Lemonade": 89,
        "Cucumber Lemonade": 89
      },

      "Coolers / Refreshers": {
        "Kala Khata Twist": 89,
        "Chilli Guava": 89,
        "Cumin Masala": 89,
        "Tangy Mango": 89,
        "Nimbu Masala": 89,
        "Blueberry Cooler": 89,
        "Very Berry Lemonade": 89,
        "Mosambi Cooler": 89
      },

      "Ice Tea": {
        "Lemon Ice Tea": 79,
        "Peach Ice Tea": 79,
        "Watermelon Ice Tea": 79,
        "Cucumber Ice Tea": 79,
        "Blueberry Ice Tea": 79,
        "Mango Ice Tea": 79,
        "Passion Fruit Ice Tea": 79,
        "Green Apple Ice Tea": 79
      },

      "Soft Drinks & Juices": {
        "Coca-Cola": 40,
        "Sprite": 40,
        "Mix Fruit Juice": 50
      }
    }
  },


  "Starters": {
    type: "items",

    items: {
      "Hashbrown": 90,
      "Masala Wedges": 99,
      "Potato Shots": 99,
      "Cheesy Jalapeno Poppers": 99,
      "Chicken Nuggets (6 pcs)": 120,
      "Pizza Pockets": 130,
      "Crispy Chicken Strips (6 pcs)": 149,
      "Chicken Cheese Pockets": 160
    }
  },


  "Burgers": {
    type: "items",

    items: {
      "Classic Chicken King Burger": 100,
      "American Cheese Supreme Chicken Burger": 120,
      "Fiery Crunchy Chicken King Burger": 130,
      "Chicken Big King Burger": 190,
      "Fiery Aloo Tikki Burger": 90,
      "Spicy Paneer Burger": 120,
      "Veg Burger Combo": 199,
      "Paneer Burger Combo": 220,
      "Classic Chicken Burger Combo": 199,
      "Crunchy Chicken Burger Combo": 240
    }
  },


  "Sandwich": {
    type: "items",

    items: {
      "Cheese & Corn": 99,
      "Farm Fresh": 120,
      "Roasted Sandwich": 130,
      "Paneer Tikka": 150,
      "Paneer Chilli": 150,
      "Paneer Mexican": 150,
      "Tandoori Chicken": 150
    }
  },


  "Wraps": {
    type: "items",

    items: {
      "Aloo Tikki Wrap (Mexican)": 129,
      "Spicy Paneer Wrap": 149,
      "Paneer Tikka Wrap": 149,
      "Chicken Tandoori Zinger": 159,
      "Mexican Zinger": 159,
      "Peri Peri Wrap": 169,
      "Tandoori Wrap": 169
    }
  },


  "Pasta": {
    type: "items",

    items: {
      "Chicken Tikka Pasta": 160,
      "Paneer Tikka Pasta": 160
    }
  },


  "Garlic Bread": {
    type: "sections",

    sections: {

      "Veg Stuffed Garlic Bread": {
        "Garlic Bread Sticks": 90,
        "Mexican Stuffed Garlic Bread": 149,
        "Paneer Mexicano Stuffed Garlic Bread": 169,
        "Paneer Peri Peri Stuffed Garlic Bread": 169,
        "Paneer Tikka Stuffed Garlic Bread": 169
      },

      "Chicken Stuffed Garlic Bread": {
        "Mexican Chicken Stuffed Garlic Bread": 169,
        "Chicken Tikka Stuffed Garlic Bread": 169,
        "Chicken Peri Peri Stuffed Garlic Bread": 169,
        "Chicken Pepperoni Stuffed Garlic Bread": 169,
        "Italian Chicken Stuffed Garlic Bread": 169
      },

      "Garlic Bread Sides": {
        "Cheesy Garlic Bread (4 pcs)": 139,
        "Veg Supreme Garlic Bread (4 pcs)": 149,
        "Paneer Garlic Bread (4 pcs)": 159,
        "Paneer Tikka Garlic Bread (4 pcs)": 159,
        "Veggie Delight Garlic Bread (4 pcs)": 159,
        "Chicken Garlic Bread": 159
      }
    }
  },


  "Nachos": {
    type: "items",

    items: {
      "Smoked BBQ Nachos": 139,
      "Tandoori Tikka Nachos": 139,
      "Fiery Mexi Nachos": 139,
      "Cheese Overload Nachos": 149,
      "Paneer Tikka Nachos": 169,
      "Paneer Mexican Nachos": 169,
      "Fiery Mexican Chicken Nachos": 169,
      "Smoked BBQ Chicken Nachos": 169,
      "Chicken Tandoori Nachos": 169,
      "Butter Chicken Nachos": 169,
      "Cheese Loaded Nachos": 169
    }
  },


  "DFC": {
    type: "items",

    items: {
      "Crispy Chicken Strips - 3 pcs": 120,
      "Crispy Chicken Strips - 6 pcs": 230,
      "Crispy Chicken Hot Wings - 4 pcs": 140,
      "Crispy Chicken Hot Wings - 8 pcs": 260,
      "Crispy Chicken Lollypop - 4 pcs": 140,
      "Crispy Chicken Lollypop - 8 pcs": 260,
      "Chicken Pop Corn - M": 180,
      "Chicken Pop Corn - L": 340,
      "Hot & Crispy Fried Chicken - 1 pc": 90,
      "Hot & Crispy Fried Chicken - 2 pcs": 170,
      "Hot & Crispy Fried Chicken - 4 pcs": 320
    }
  },


  "Combos": {
    type: "items",

    items: {
      "Chicken Zinger Combo": 299,
      "Crispy Wrap Combo": 299,
      "Crunchy Fried Chicken Meal": 299,
      "Hot Wings Combo": 350,
      "Chicken Zinger Burger + Wings Combo": 369,
      "Chicken Zinger Burger + Pop Corn Combo": 420,
      "Fried Chicken (2 pcs) Combo": 560,
      "10 Pcs Love That Chicken Platter": 690,
      "11 Pcs Fried Chicken Party Meal": 750,
      "Family Combo": 1150,
      "Chicken Pop Corn Fries": 189,
      "Chicken Pop Corn Nachos": 179
    }
  },


  "Desserts": {
    type: "items",

    items: {
      "Choco Lava Cake": 60,
      "Red Velvet Lava Cake": 70,
      "Choco Overload Brownie": 60
    }
  }
};


/*
=========================================================
MAIN MENU
=========================================================
*/

async function showMainMenu(from) {

  await send(
    from,
    `
🍕 *WELCOME TO DARBAR PIZZA* 🍕

Please choose a category:

1️⃣ Veg Pizza
2️⃣ Non-Veg Pizza
3️⃣ Beverages
4️⃣ Starters
5️⃣ Burgers
6️⃣ Sandwich
7️⃣ Wraps
8️⃣ Pasta
9️⃣ Garlic Bread
🔟 Nachos
1️⃣1️⃣ DFC
1️⃣2️⃣ Combos
1️⃣3️⃣ Desserts

━━━━━━━━━━━━━━

Reply with number.

B = Back
M = Main Menu
C = Cart
`
  );
}


/*
=========================================================
CATEGORY
=========================================================
*/

async function showCategoryMenu(
  from,
  category
) {

  const menu = MENU[category];

  if (!menu) {

    await send(
      from,
      "❌ Category not found."
    );

    return;
  }

  const state =
    getCustomerState(from);

  state.category = category;
  state.section = null;
  state.item = null;
  state.size = null;

  if (menu.type === "sections") {

    const sections =
      Object.keys(menu.sections);

    let message = `
🍕 *${category.toUpperCase()}*

Choose a section:

`;

    sections.forEach(
      (section, index) => {

        message +=
          `${index + 1}️⃣ ${section}\n`;
      }
    );

    message += `
━━━━━━━━━━━━━━

B = Back
M = Main Menu
C = Cart
`;

    state.step = "SECTION";

    await send(
      from,
      message
    );

    return;
  }


  if (menu.type === "items") {

    await showItems(
      from,
      category,
      menu.items
    );
  }
}


/*
=========================================================
ITEM LIST
=========================================================
*/

async function showItems(
  from,
  category,
  items
) {

  const state =
    getCustomerState(from);

  const names =
    Object.keys(items);

  let message =
    `🍕 *${category.toUpperCase()}*\n`;

  if (state.section) {

    message +=
      `\n📂 *${state.section}*\n`;
  }

  message += "\n";

  names.forEach(
    (name, index) => {

      const value =
        items[name];

      if (
        typeof value === "object"
      ) {

        const sizes =
          Object.entries(value)
            .map(
              ([size, price]) =>
                `${size} ₹${price}`
            )
            .join(" | ");

        message +=
          `${index + 1}️⃣ ${name}\n` +
          `   ${sizes}\n`;

      } else {

        message +=
          `${index + 1}️⃣ ${name} - ₹${value}\n`;
      }
    }
  );

  message += `
━━━━━━━━━━━━━━

Reply item number.

B = Back
M = Main Menu
C = Cart
`;

  state.step = "ITEM";

  await send(
    from,
    message
  );
}


/*
=========================================================
ITEM OPTIONS
=========================================================
*/

async function showItemOptions(
  from,
  itemName,
  itemData
) {

  const state =
    getCustomerState(from);

  state.item = itemName;

  if (
    typeof itemData === "object"
  ) {

    state.step = "SIZE";

    await send(
      from,
      `
🍕 *${itemName}*

Choose size:

1️⃣ Regular - ₹${itemData.R}
2️⃣ Medium - ₹${itemData.M}
3️⃣ Large - ₹${itemData.L}
4️⃣ XL - ₹${itemData.XL}

B = Back
M = Main Menu
C = Cart
`
    );

    return;
  }


  state.selectedPrice =
    itemData;

  state.step =
    "QUANTITY";

  await send(
    from,
    `
🍽️ *${itemName}*

Price: ₹${itemData}

How many?

Example:
2

B = Back
M = Main Menu
C = Cart
`
  );
}


/*
=========================================================
ADD TO CART
=========================================================
*/

async function addToCart(
  from,
  quantity
) {

  const state =
    getCustomerState(from);

  let price =
    state.selectedPrice;

  if (state.size) {

    const category =
      MENU[state.category];

    const items =
      state.section
        ? category.sections[state.section]
        : category.items;

    price =
      items[state.item][state.size];
  }

  const total =
    price * quantity;

  state.cart.push({

    item: state.item,

    size: state.size,

    quantity,

    price,

    total
  });

  state.step =
    "AFTER_ADD";

  await send(
    from,
    `
✅ *ITEM ADDED*

${state.item}
${state.size ? `Size: ${state.size}\n` : ""}
Quantity: ${quantity}

💰 ₹${total}

1️⃣ Add More
2️⃣ View Cart
3️⃣ Checkout

B = Back
M = Main Menu
`
  );
}


/*
=========================================================
CART
=========================================================
*/

async function showCart(from) {

  const state =
    getCustomerState(from);

  if (
    !state.cart.length
  ) {

    await send(
      from,
      `
🛒 *YOUR CART IS EMPTY*

M = Main Menu
`
    );

    return;
  }

  let message =
    "🛒 *YOUR CART*\n\n";

  let total = 0;

  state.cart.forEach(
    (item, index) => {

      message +=
        `${index + 1}. ${item.item}`;

      if (item.size) {

        message +=
          ` (${item.size})`;
      }

      message +=
        ` x ${item.quantity} = ₹${item.total}\n`;

      total += item.total;
    }
  );

  message +=
    `\n━━━━━━━━━━━━━━\n` +
    `💰 *TOTAL: ₹${total}*\n\n` +
    `1️⃣ Add More\n` +
    `2️⃣ Checkout\n` +
    `3️⃣ Clear Cart\n\n` +
    `B = Back\n` +
    `M = Main Menu`;

  state.step =
    "CART";

  await send(
    from,
    message
  );
}


function getCartTotal(state) {

  return state.cart.reduce(
    (total, item) =>
      total + item.total,
    0
  );
}


function createOrderText(state) {

  let text = "";

  state.cart.forEach(
    (item, index) => {

      text +=
        `${index + 1}. ${item.item}`;

      if (item.size) {

        text +=
          ` (${item.size})`;
      }

      text +=
        ` x ${item.quantity} = ₹${item.total}\n`;
    }
  );

  return text;
}


/*
=========================================================
CHECKOUT
=========================================================
*/

async function checkout(from) {

  const state =
    getCustomerState(from);

  if (!state.cart.length) {

    await send(
      from,
      "🛒 Your cart is empty."
    );

    return;
  }

  const total =
    getCartTotal(state);

  const orderText =
    createOrderText(state);

  state.step =
    "CONFIRM_ORDER";

  await send(
    from,
    `
🧾 *ORDER SUMMARY*

${orderText}

━━━━━━━━━━━━━━

💰 *TOTAL: ₹${total}*

1️⃣ Confirm Order
2️⃣ Add More
3️⃣ Cancel

Reply with 1, 2 or 3.
`
  );
}


/*
=========================================================
SEND ORDER TO MANAGER
=========================================================
*/

async function sendOrderToManager(
  from
) {

  const state =
    getCustomerState(from);

  const table =
    state.table ||
    getCustomerTable(from);

  const total =
    getCartTotal(state);

  const orderText =
    createOrderText(state);


  chefOrders[table] = {

    orderText,

    total,

    customer: from,

    status: "PENDING_APPROVAL",

    createdAt:
      new Date().toISOString()
  };


  await send(
    from,
    `
✅ *ORDER SENT*

🏷️ Table ${table}

${orderText}

💰 Total: ₹${total}

⌛ Waiting for manager approval...
`
  );


  await send(
    MANAGER,
    `
🔔 *NEW ORDER - TABLE ${table}*

${orderText}

💰 Total: ₹${total}

Customer:
${from}

━━━━━━━━━━━━━━

Reply:

${table} Approved

or

${table} Rejected
`
  );


  state.step =
    "WAITING_MANAGER";
}


/*
=========================================================
PAYMENT
=========================================================
*/

async function showPaymentOptions(
  from,
  table
) {

  const order =
    chefOrders[table];

  if (!order) {

    await send(
      from,
      "❌ Order not found."
    );

    return;
  }

  const total =
    order.total;


  const upiLink =
    `upi://pay?pa=${MERCHANT_UPI}` +
    `&pn=${encodeURIComponent(MERCHANT_NAME)}` +
    `&am=${total}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(
      `Table ${table}`
    )}`;


  const qrImageLink =
    `https://api.qrserver.com/v1/create-qr-code/` +
    `?size=400x400&data=` +
    encodeURIComponent(upiLink);


  payments[table] = {

    table,

    total,

    customer: from,

    method: null,

    status: "AWAITING_METHOD",

    upiLink,

    qrImageLink,

    transactionId: null,

    createdAt:
      new Date().toISOString()
  };


  const state =
    getCustomerState(from);

  state.step =
    "PAYMENT";


  await send(
    from,
    `
💳 *PAYMENT - TABLE ${table}*

━━━━━━━━━━━━━━

💰 Amount Payable:
*₹${total}*

Choose payment method:

1️⃣ UPI
2️⃣ Cash

Reply 1 or 2.
`
  );


  /*
  Manager gets payment request
  */

  await send(
    MANAGER,
    `
🔔🔔🔔 *PAYMENT REQUEST* 🔔🔔🔔

🏷️ Table: ${table}

💰 Amount: ₹${total}

Customer:
${from}

Waiting for payment method.

━━━━━━━━━━━━━━

UPI:
${table} Paid UPI

Cash:
${table} Paid Cash
`
  );
}


/*
=========================================================
UPI PAYMENT
=========================================================
*/

async function processUPIPayment(
  from,
  table
) {

  const payment =
    payments[table];

  if (!payment) {

    await send(
      from,
      "❌ Payment session not found."
    );

    return;
  }


  if (
    payment.status === "PAID"
  ) {

    await send(
      from,
      "✅ This order is already paid."
    );

    return;
  }


  payment.method =
    "UPI";

  payment.status =
    "WAITING_GATEWAY";


  await send(
    from,
    `
📱 *UPI PAYMENT*

🏷️ Table: ${table}

💰 Amount:
*₹${payment.total}*

Merchant:
${MERCHANT_NAME}

UPI ID:
${MERCHANT_UPI}

━━━━━━━━━━━━━━

📲 *SCAN QR*

${payment.qrImageLink}

━━━━━━━━━━━━━━

Or use this UPI link:

${payment.upiLink}

After successful payment, please wait for automatic confirmation.

⚠️ Do not pay twice.
`
  );


  await send(
    MANAGER,
    `
🔔🔔🔔 *UPI PAYMENT STARTED*

🏷️ Table: ${table}

💰 Amount:
₹${payment.total}

Customer:
${from}

UPI ID:
${MERCHANT_UPI}

Waiting for payment gateway confirmation.

━━━━━━━━━━━━━━

If automatic gateway confirmation is unavailable, verify the transaction and send:

${table} Paid UPI
`
  );
}


/*
=========================================================
CASH PAYMENT
=========================================================
*/

async function processCashPayment(
  from,
  table
) {

  const payment =
    payments[table];

  if (!payment) return;


  payment.method =
    "CASH";

  payment.status =
    "WAITING_CASH";


  await send(
    from,
    `
💵 *CASH PAYMENT SELECTED*

🏷️ Table: ${table}

💰 Amount:
*₹${payment.total}*

Please pay ₹${payment.total} to the waiter/counter.

After payment, the manager will confirm your payment.
`
  );


  /*
  Strong manager notification
  */

  await send(
    MANAGER,
    `
🔔🔔🔔🔔🔔🔔🔔🔔

💵 *CASH PAYMENT REQUIRED*

🏷️ TABLE: ${table}

💰 AMOUNT:
*₹${payment.total}*

Customer:
${from}

━━━━━━━━━━━━━━

⚠️ COLLECT CASH

Please collect:
*₹${payment.total}*

After receiving cash send:

${table} Paid Cash

━━━━━━━━━━━━━━

🔔 CASH PAYMENT ALERT 🔔
`
  );
}


/*
=========================================================
CONFIRM PAYMENT
=========================================================
*/

async function confirmPayment(
  table,
  method,
  transactionId = null
) {

  const payment =
    payments[table];

  if (!payment) {

    await send(
      MANAGER,
      `❌ No payment found for Table ${table}`
    );

    return;
  }


  /*
  Prevent duplicate payment
  */

  if (
    payment.status === "PAID"
  ) {

    await send(
      MANAGER,
      `
⚠️ Table ${table} is already marked PAID.

Amount:
₹${payment.total}

Transaction:
${payment.transactionId || "N/A"}
`
    );

    return;
  }


  payment.status =
    "PAID";

  payment.method =
    method;

  payment.transactionId =
    transactionId;


  const customer =
    payment.customer;


  /*
  MANAGER
  */

  await send(
    MANAGER,
    `
🔔🔔🔔🔔🔔🔔🔔

✅ *PAYMENT CONFIRMED*

🏷️ Table:
${table}

💰 Amount:
*₹${payment.total}*

💳 Method:
${method}

${transactionId
  ? `Transaction ID:\n${transactionId}\n`
  : ""}

━━━━━━━━━━━━━━

💰 *PAID*

Table ${table} payment completed.

🔔🔔🔔🔔🔔🔔🔔
`
  );


  /*
  CUSTOMER
  */

  await send(
    customer,
    `
✅ *PAYMENT SUCCESSFUL*

🏷️ Table:
${table}

💰 Amount:
*₹${payment.total}*

💳 Payment:
${method}

${transactionId
  ? `Transaction ID:\n${transactionId}\n`
  : ""}

━━━━━━━━━━━━━━

✅ *STATUS: PAID*

Thank you for visiting ${MERCHANT_NAME} 🍕

Your order is complete.

⏰ This WhatsApp session will close after 2 hours of inactivity.
`
  );


  /*
  CHEF
  */

  if (CHEF) {

    await send(
      CHEF,
      `
💰 *PAYMENT COMPLETED*

🏷️ Table:
${table}

💰 ₹${payment.total}

Method:
${method}

Status:
✅ PAID
`
    );
  }


  /*
  Mark order complete
  */

  if (chefOrders[table]) {

    chefOrders[table].paymentStatus =
      "PAID";

    chefOrders[table].status =
      "COMPLETED";
  }


  /*
  Start/restart 2-hour inactivity timer
  */

  refreshSession(customer);
}


/*
=========================================================
PAYMENT WEBHOOK
=========================================================
*/

/*
IMPORTANT:

This endpoint becomes automatic only when your
UPI/payment provider calls it after successful payment.

Example JSON:

{
  "table": "5",
  "amount": 730,
  "status": "SUCCESS",
  "transactionId": "TXN123456"
}

Connect your payment provider's webhook to:

POST /payment-webhook
*/

app.post(
  "/payment-webhook",
  async (req, res) => {

    try {

      const {
        table,
        amount,
        status,
        transactionId
      } = req.body;


      if (!table) {

        return res
          .status(400)
          .json({
            error: "table required"
          });
      }


      const payment =
        payments[table];


      if (!payment) {

        return res
          .status(404)
          .json({
            error:
              "payment not found"
          });
      }


      /*
      Only successful payments
      */

      if (
        String(status)
          .toUpperCase() !==
        "SUCCESS"
      ) {

        return res.json({
          received: true,
          message:
            "Payment not successful"
        });
      }


      /*
      IMPORTANT:
      Verify amount before marking PAID.
      */

      const webhookAmount =
        Number(amount);

      const expectedAmount =
        Number(payment.total);


      if (
        webhookAmount !==
        expectedAmount
      ) {

        await send(
          MANAGER,
          `
🚨 *PAYMENT AMOUNT MISMATCH*

Table: ${table}

Expected:
₹${expectedAmount}

Received:
₹${webhookAmount}

Payment NOT marked as paid.
`
        );

        return res
          .status(400)
          .json({
            error:
              "amount mismatch"
          });
      }


      /*
      Mark payment automatically
      */

      await confirmPayment(
        table,
        "UPI",
        transactionId || null
      );


      return res.json({
        success: true,
        table,
        amount:
          expectedAmount,
        status:
          "PAID"
      });

    } catch (error) {

      console.error(
        "Payment webhook error:",
        error.message
      );

      return res
        .status(500)
        .json({
          error:
            "payment webhook failed"
        });
    }
  }
);


/*
=========================================================
MANAGER WINDOW
=========================================================
*/

async function handleManagerMessage(
  text
) {

  const match =
    text.match(
      /^(\d+)\s+(.+)$/i
    );


  /*
  Manager didn't include table
  */

  if (!match) {

    await send(
      MANAGER,
      `
❌ Invalid format.

Examples:

5 Approved

5 Paid UPI

5 Paid Cash

5 Rejected
`
    );

    return;
  }


  const table =
    match[1];

  const command =
    match[2]
      .trim()
      .toLowerCase();


  /*
  ==============================================
  APPROVED
  ==============================================
  */

  if (
    command.includes("approv") ||
    (
      command === "ok" &&
      !command.includes("paid")
    )
  ) {

    const order =
      chefOrders[table];

    if (!order) {

      await send(
        MANAGER,
        `❌ No order found for Table ${table}`
      );

      return;
    }


    order.status =
      "PENDING";


    await send(
      CHEF,
      `
👨‍🍳 *NEW ORDER*

🏷️ Table ${table}

${order.orderText}

💰 Total:
₹${order.total}

━━━━━━━━━━━━━━

Status:
⏳ PENDING

Reply:

${table} Preparing

${table} Ready
`
    );


    await send(
      MANAGER,
      `
✅ Table ${table}

Order sent to Chef.
`
    );


    await send(
      order.customer,
      `
✅ *ORDER APPROVED*

🏷️ Table ${table}

👨‍🍳 The kitchen has started processing your order.

Please wait...
`
    );

    return;
  }


  /*
  ==============================================
  PAYMENT - UPI
  ==============================================
  */

  if (
    command.includes("paid") &&
    command.includes("upi")
  ) {

    await confirmPayment(
      table,
      "UPI"
    );

    return;
  }


  /*
  ==============================================
  PAYMENT - CASH
  ==============================================
  */

  if (
    command.includes("paid") &&
    command.includes("cash")
  ) {

    await confirmPayment(
      table,
      "CASH"
    );

    return;
  }


  /*
  ==============================================
  GENERIC PAID
  ==============================================
  */

  if (
    command === "paid"
  ) {

    const payment =
      payments[table];

    if (!payment) {

      await send(
        MANAGER,
        `
❌ No payment pending for Table ${table}.
`
      );

      return;
    }


    await confirmPayment(
      table,
      payment.method ||
      "UPI/CASH"
    );

    return;
  }


  /*
  ==============================================
  REJECT
  ==============================================
  */

  if (
    command.includes("reject")
  ) {

    const order =
      chefOrders[table];

    if (order) {

      await send(
        order.customer,
        `
❌ *ORDER REJECTED*

Table ${table}

Please contact the restaurant staff.
`
      );


      await send(
        CHEF,
        `❌ Table ${table} order rejected.`
      );


      delete chefOrders[table];
    }

    return;
  }


  /*
  ==============================================
  GENERIC MANAGER MESSAGE
  ==============================================
  */

  if (
    orders[table]
  ) {

    await send(
      orders[table],
      `
👨‍💼 *Manager - Table ${table}*

${match[2]}
`
    );
  }
}


/*
=========================================================
CHEF WINDOW
=========================================================
*/

async function handleChefMessage(
  text
) {

  const match =
    text.match(
      /^(\d+)\s+(.+)$/i
    );


  if (!match) {

    await send(
      CHEF,
      `
❌ Invalid format.

Use:

5 Preparing

or

5 Ready
`
    );

    return;
  }


  const table =
    match[1];

  const status =
    match[2]
      .trim()
      .toLowerCase();


  const order =
    chefOrders[table];


  if (!order) {

    await send(
      CHEF,
      `
❌ No active order found for Table ${table}.
`
    );

    return;
  }


  /*
  ==============================================
  PREPARING
  ==============================================
  */

  if (
    status.includes("prepar") ||
    status.includes("cook") ||
    status.includes("start")
  ) {

    order.status =
      "PREPARING";


    await send(
      CHEF,
      `✓ Table ${table} marked as PREPARING.`
    );


    await send(
      MANAGER,
      `
👨‍🍳 *CHEF UPDATE*

🏷️ Table ${table}

Status:
🔥 PREPARING
`
    );


    await send(
      order.customer,
      `
👨‍🍳 *KITCHEN UPDATE*

🏷️ Table ${table}

🔥 Your order is now being prepared.

Please wait...
`
    );

    return;
  }


  /*
  ==============================================
  READY
  ==============================================
  */

  if (
    status.includes("ready") ||
    status.includes("done")
  ) {

    order.status =
      "READY";


    await send(
      CHEF,
      `
✓ Table ${table} marked as READY.
`
    );


    await send(
      MANAGER,
      `
✅ *CHEF - TABLE ${table} READY*

${order.orderText}

💰 Total:
₹${order.total}

💳 Payment request will be sent to customer.
`
    );


    await send(
      order.customer,
      `
✅ *ORDER READY* 🍕

🏷️ Table ${table}

${order.orderText}

💰 Total:
*₹${order.total}*

━━━━━━━━━━━━━━

💳 Your bill is ready.

Please complete payment.
`
    );


    /*
    Wait briefly and show payment
    */

    setTimeout(
      () =>
        showPaymentOptions(
          order.customer,
          table
        ),
      1000
    );

    return;
  }


  /*
  ==============================================
  UNKNOWN
  ==============================================
  */

  await send(
    CHEF,
    `
❌ Unknown status.

Use:

${table} Preparing

or

${table} Ready
`
  );
}


/*
=========================================================
WEBHOOK VERIFICATION
=========================================================
*/

app.get(
  "/webhook",
  (req, res) => {

    if (
      req.query[
        "hub.verify_token"
      ] === VERIFY
    ) {

      return res.send(
        req.query[
          "hub.challenge"
        ]
      );
    }

    res.sendStatus(403);
  }
);


/*
=========================================================
WHATSAPP WEBHOOK
=========================================================
*/

app.post(
  "/webhook",
  async (req, res) => {

    res.sendStatus(200);

    try {

      const msg =
        req.body
          .entry?.[0]
          ?.changes?.[0]
          ?.value
          ?.messages?.[0];


      if (!msg) return;


      const from =
        msg.from;

      const type =
        msg.type;


      /*
      ==============================================
      CHEF
      ==============================================
      */

      if (
        from === CHEF &&
        type === "text"
      ) {

        await handleChefMessage(
          msg.text.body.trim()
        );

        return;
      }


      /*
      ==============================================
      MANAGER
      ==============================================
      */

      if (
        from === MANAGER &&
        type === "text"
      ) {

        await handleManagerMessage(
          msg.text.body.trim()
        );

        return;
      }


      /*
      ==============================================
      LOCATION
      ==============================================
      */

      if (
        type === "location"
      ) {

        const lat =
          msg.location.latitude;

        const lon =
          msg.location.longitude;


        const table =
          getCustomerTable(from);


        orders[table] =
          from;

        locationShared[from] =
          true;


        createCustomerState(
          from,
          table
        );


        const state =
          customerStates[from];


        state.step =
          "MAIN_MENU";

        state.sessionActive =
          true;


        refreshSession(from);


        tableSessions[table] = {

          customer: from,

          active: true,

          startedAt:
            new Date().toISOString()
        };


        await send(
          from,
          `
📍 *LOCATION SAVED* ✅

🏷️ Table: ${table}

Welcome to *${MERCHANT_NAME}* 🍕

Please choose from our menu.
`
        );


        await showMainMenu(
          from
        );


        await send(
          MANAGER,
          `
📍 *NEW TABLE*

🏷️ Table:
${table}

Customer:
${from}

Location:
https://maps.google.com/?q=${lat},${lon}

Waiting for order...
`
        );


        return;
      }


      /*
      ==============================================
      CUSTOMER TEXT
      ==============================================
      */

      if (
        type === "text"
      ) {

        const text =
          msg.text.body.trim();

        const lower =
          normalize(text);


        /*
        ==========================================
        NEW SESSION / HI
        ==========================================
        */

        if (
          lower === "hi" ||
          lower === "hello" ||
          lower === "hey" ||
          /^hi\s+\d+$/i.test(text)
        ) {

          const tableMatch =
            text.match(/\d+/);

          const table =
            tableMatch
              ? tableMatch[0]
              : "0";


          /*
          New session
          */

          orders[table] =
            from;


          locationShared[from] =
            false;


          createCustomerState(
            from,
            table
          );


          await send(
            from,
            `
👋 *WELCOME TO DARBAR PIZZA* 🍕

🏷️ Table:
${table}

📍 Please share your location.

WhatsApp:
Attach → Location → Send Current Location
`
          );

          return;
        }


        /*
        ==========================================
        EXISTING SESSION
        ==========================================
        */

        if (
          !isSessionActive(from)
        ) {

          await send(
            from,
            `
⏰ *SESSION EXPIRED*

Your previous Table ${getCustomerTable(from)} session has expired.

Please scan the Table QR code again to start a new session.
`
          );

          return;
        }


        /*
        Reset 2-hour inactivity timer
        */

        refreshSession(from);


        /*
        ==========================================
        LOCATION REQUIRED
        ==========================================
        */

        if (
          !locationShared[from]
        ) {

          await send(
            from,
            `
📍 *PLEASE SHARE LOCATION FIRST*

Table:
${getCustomerTable(from)}

Attach → Location → Send Current Location
`
          );

          return;
        }


        const state =
          getCustomerState(from);


        /*
        ==========================================
        PAYMENT
        ==========================================
        */

        if (
          state.step === "PAYMENT"
        ) {

          const table =
            state.table ||
            getCustomerTable(from);

          const payment =
            payments[table];


          if (!payment) {

            await send(
              from,
              `
❌ Payment session not found.

Please contact the manager.
`
            );

            return;
          }


          /*
          Already paid
          */

          if (
            payment.status === "PAID"
          ) {

            await send(
              from,
              `
✅ *ALREADY PAID*

Table:
${table}

Amount:
₹${payment.total}

Thank you! 🍕
`
            );

            return;
          }


          /*
          UPI
          */

          if (
            lower === "1" ||
            lower === "upi" ||
            lower.includes("upi")
          ) {

            await processUPIPayment(
              from,
              table
            );

            return;
          }


          /*
          CASH
          */

          if (
            lower === "2" ||
            lower === "cash"
          ) {

            await processCashPayment(
              from,
              table
            );

            return;
          }


          /*
          Customer says PAID
          */

          if (
            lower === "paid"
          ) {

            await send(
              from,
              `
⌛ *PAYMENT VERIFICATION*

Your payment has been reported.

The manager is verifying the payment.

Please wait for confirmation.
`
            );


            await send(
              MANAGER,
              `
🔔 *CUSTOMER SAYS PAID*

🏷️ Table:
${table}

💰 Amount:
₹${payment.total}

Method:
${payment.method || "Unknown"}

Please verify and confirm:

${table} Paid UPI

or

${table} Paid Cash
`
            );

            return;
          }


          /*
          Payment menu
          */

          await send(
            from,
            `
💳 *PAYMENT - TABLE ${table}*

💰 Amount:
*₹${payment.total}*

1️⃣ UPI
2️⃣ Cash

Reply 1 or 2.
`
          );

          return;
        }


        /*
        ==========================================
        GLOBAL COMMANDS
        ==========================================
        */

        if (
          lower === "m" ||
          lower === "menu"
        ) {

          state.step =
            "MAIN_MENU";

          await showMainMenu(
            from
          );

          return;
        }


        if (
          lower === "c" ||
          lower === "cart"
        ) {

          await showCart(from);

          return;
        }


        /*
        ==========================================
        BACK
        ==========================================
        */

        if (
          lower === "b" ||
          lower === "back"
        ) {

          state.step =
            "MAIN_MENU";

          await showMainMenu(
            from
          );

          return;
        }


        /*
        ==========================================
        MAIN MENU
        ==========================================
        */

        if (
          state.step === "MAIN_MENU"
        ) {

          const categories =
            Object.keys(MENU);

          const number =
            parseInt(text);


          if (
            isNaN(number) ||
            number < 1 ||
            number >
              categories.length
          ) {

            await send(
              from,
              `
❌ Invalid option.

Choose:
1-${categories.length}
`
            );

            return;
          }


          await showCategoryMenu(
            from,
            categories[number - 1]
          );

          return;
        }


        /*
        ==========================================
        SECTION
        ==========================================
        */

        if (
          state.step === "SECTION"
        ) {

          const category =
            MENU[state.category];

          const sections =
            Object.keys(
              category.sections
            );

          const number =
            parseInt(text);


          if (
            isNaN(number) ||
            number < 1 ||
            number >
              sections.length
          ) {

            await send(
              from,
              "❌ Invalid section."
            );

            return;
          }


          state.section =
            sections[number - 1];


          await showItems(
            from,
            state.category,
            category.sections[
              state.section
            ]
          );

          return;
        }


        /*
        ==========================================
        ITEM
        ==========================================
        */

        if (
          state.step === "ITEM"
        ) {

          const category =
            MENU[state.category];


          const items =
            state.section
              ? category.sections[
                  state.section
                ]
              : category.items;


          const names =
            Object.keys(items);


          const number =
            parseInt(text);


          if (
            isNaN(number) ||
            number < 1 ||
            number > names.length
          ) {

            await send(
              from,
              "❌ Invalid item."
            );

            return;
          }


          const itemName =
            names[number - 1];


          await showItemOptions(
            from,
            itemName,
            items[itemName]
          );

          return;
        }


        /*
        ==========================================
        SIZE
        ==========================================
        */

        if (
          state.step === "SIZE"
        ) {

          const sizeMap = {

            "1": "R",
            "2": "M",
            "3": "L",
            "4": "XL"
          };


          if (
            !sizeMap[text]
          ) {

            await send(
              from,
              `
❌ Invalid size.

1️⃣ Regular
2️⃣ Medium
3️⃣ Large
4️⃣ XL
`
            );

            return;
          }


          state.size =
            sizeMap[text];


          const category =
            MENU[state.category];


          const items =
            state.section
              ? category.sections[
                  state.section
                ]
              : category.items;


          state.selectedPrice =
            items[state.item][
              state.size
            ];


          state.step =
            "QUANTITY";


          await send(
            from,
            `
🍕 *${state.item}*

Size:
${state.size}

Price:
₹${state.selectedPrice}

How many?

Example:
2
`
          );

          return;
        }


        /*
        ==========================================
        QUANTITY
        ==========================================
        */

        if (
          state.step === "QUANTITY"
        ) {

          const quantity =
            parseInt(text);


          if (
            isNaN(quantity) ||
            quantity <= 0 ||
            quantity > 50
          ) {

            await send(
              from,
              `
❌ Invalid quantity.

Please enter a number between 1 and 50.
`
            );

            return;
          }


          await addToCart(
            from,
            quantity
          );

          return;
        }


        /*
        ==========================================
        AFTER ADD
        ==========================================
        */

        if (
          state.step === "AFTER_ADD"
        ) {

          if (text === "1") {

            state.step =
              "MAIN_MENU";

            await showMainMenu(
              from
            );

            return;
          }


          if (text === "2") {

            await showCart(
              from
            );

            return;
          }


          if (text === "3") {

            await checkout(
              from
            );

            return;
          }


          await send(
            from,
            `
1️⃣ Add More
2️⃣ View Cart
3️⃣ Checkout
`
          );

          return;
        }


        /*
        ==========================================
        CART
        ==========================================
        */

        if (
          state.step === "CART"
        ) {

          if (text === "1") {

            state.step =
              "MAIN_MENU";

            await showMainMenu(
              from
            );

            return;
          }


          if (text === "2") {

            await checkout(
              from
            );

            return;
          }


          if (text === "3") {

            state.cart = [];

            state.step =
              "MAIN_MENU";

            await send(
              from,
              "🗑️ Cart cleared."
            );

            await showMainMenu(
              from
            );

            return;
          }


          return;
        }


        /*
        ==========================================
        CONFIRM ORDER
        ==========================================
        */

        if (
          state.step ===
          "CONFIRM_ORDER"
        ) {

          if (text === "1") {

            await sendOrderToManager(
              from
            );

            return;
          }


          if (text === "2") {

            state.step =
              "MAIN_MENU";

            await showMainMenu(
              from
            );

            return;
          }


          if (text === "3") {

            state.cart = [];

            state.step =
              "MAIN_MENU";

            await send(
              from,
              "❌ Order cancelled."
            );

            await showMainMenu(
              from
            );

            return;
          }

          return;
        }


        /*
        ==========================================
        WAITING MANAGER
        ==========================================
        */

        if (
          state.step ===
          "WAITING_MANAGER"
        ) {

          await send(
            from,
            `
⌛ Your order is waiting for manager approval.

Please wait...
`
          );

          return;
        }


        /*
        ==========================================
        WAITING CHEF
        ==========================================
        */

        if (
          state.step ===
          "WAITING_CHEF"
        ) {

          await send(
            from,
            `
👨‍🍳 Your order is being prepared.

Please wait...
`
          );

          return;
        }
      }

    } catch (error) {

      console.error(
        "Webhook Error:",
        error.response?.data ||
        error.message ||
        error
      );
    }
  }
);


/*
=========================================================
TABLE QR PAGE
=========================================================
*/

app.get(
  "/qr",
  (req, res) => {

    res.send(`
<!DOCTYPE html>

<html>

<head>

<title>Darbar Pizza Table QR</title>

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js">
</script>

<style>

body {
  font-family: Arial;
  text-align: center;
}

.card {
  display: inline-block;
  padding: 15px;
  margin: 10px;
  box-shadow: 0 2px 8px #0002;
  border-radius: 12px;
}

</style>

</head>

<body>

<h1>🍕 Darbar Pizza Table QR</h1>

<div id="qrs"></div>

<script>

const container =
  document.getElementById("qrs");

for (let i = 1; i <= 10; i++) {

  const card =
    document.createElement("div");

  card.className = "card";

  card.innerHTML =
    "<h3>Table " +
    i +
    "</h3>" +
    "<div id='qr-" +
    i +
    "'></div>";

  container.appendChild(card);


  new QRCode(
    document.getElementById(
      "qr-" + i
    ),
    {
      text:
        "https://wa.me/${WHATSAPP_NUM}" +
        "?text=Hi%20Table%20" +
        i,

      width: 180,
      height: 180
    }
  );
}

</script>

</body>

</html>
`);
  }
);


/*
=========================================================
MERCHANT UPI QR
=========================================================
*/

app.get(
  "/payqr",
  (req, res) => {

    const upi =
      `upi://pay?pa=${MERCHANT_UPI}` +
      `&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}` +
      `&cu=INR`;


    const qr =
      `https://api.qrserver.com/v1/create-qr-code/` +
      `?size=400x400&data=` +
      encodeURIComponent(upi);


    res.send(`
<!DOCTYPE html>

<html>

<body
  style="
    text-align:center;
    font-family:Arial
  "
>

<h1>🍕 Merchant UPI QR</h1>

<p>
${MERCHANT_NAME}
</p>

<p>
UPI:
${MERCHANT_UPI}
</p>

<img
  src="${qr}"
  width="400"
/>

<p>
Scan to Pay
</p>

<p>
Amount must be entered manually.
</p>

</body>

</html>
`);
  }
);


/*
=========================================================
HEALTH CHECK
=========================================================
*/

app.get(
  "/",
  (req, res) => {

    res.send(`
      <h2>🍕 Darbar Pizza WhatsApp Bot Running</h2>

      <p>Manager: ${MANAGER}</p>

      <p>Chef: ${CHEF}</p>

      <p>UPI: ${MERCHANT_UPI}</p>

      <p>
        <a href="/qr">
          Table QR Codes
        </a>
      </p>

      <p>
        <a href="/payqr">
          Merchant UPI QR
        </a>
      </p>
    `);
  }
);


/*
=========================================================
START SERVER
=========================================================
*/

app.listen(
  PORT,
  () => {

    console.log(
      `🍕 Darbar Pizza Bot running on port ${PORT}`
    );
  }
);
