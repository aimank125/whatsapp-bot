// server.js
const express = require("express");
const axios = require("axios");
const app = express();

const PORT = 3000;
app.use(express.json());

// 🧠 User memory
let users = {};

// Test route
app.get("/", (req, res) => {
  res.send("Advanced WhatsApp Bot Running 🚀");
});

// Webhook verification
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "mysecuretoken123";
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    console.log("WEBHOOK VERIFIED ✅");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// MAIN MENU
const mainMenu = {
  type: "interactive",
  interactive: {
    type: "button",
    body: {
      text: "👋 Hello! I am Aiman Bot 🤖\nTyping out. Tapping in — to Smarter Banking\n\nChoose an option:"
    },
    action: {
      buttons: [
        { type: "reply", reply: { id: "card_activation", title: "Card Activation" } },
        { type: "reply", reply: { id: "account_services", title: "Account Services" } },
        { type: "reply", reply: { id: "card_services", title: "Card Services" } }
      ]
    }
  }
};

// OTHER SERVICES MENU
const otherServicesMenu = {
  type: "interactive",
  interactive: {
    type: "list",
    body: { text: "📋 Other Services" },
    action: {
      button: "Select Services",
      sections: [
        {
          title: "Services",
          rows: [
            { id: "open_account", title: "Open Digital Account" },
            { id: "rda_account", title: "Open RDA Account" },
            { id: "loan", title: "Loan Facilities" },
            { id: "remittance", title: "Remittance Services" },
            { id: "contact", title: "Talk to Agent" },
            { id: "main_menu", title: "⬅ Main Menu" }
          ]
        }
      ]
    }
  }
};

// WEBHOOK POST
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const rawText = message.text?.body;
    const text = rawText?.toLowerCase();
    const buttonId = message?.interactive?.button_reply?.id;
    const listId = message?.interactive?.list_reply?.id;
    const input = buttonId || listId || text;

    // INIT USER
    if (!users[from]) users[from] = { step: "MAIN" };
    const user = users[from];

    // WhatsApp credentials
    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
    let reply;

    // GLOBAL COMMANDS
    if (input === "hi" || input === "start" || input === "main_menu") {
      user.step = "MAIN";
      reply = mainMenu;
    }

    // MAIN MENU LOGIC
    else if (user.step === "MAIN") {

      // CARD ACTIVATION
      if (input === "card_activation") {
        user.step = "CARD_MENU";
        reply = {
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: "💳 Card Activation\nSelect option:" },
            action: {
              buttons: [
                { type: "reply", reply: { id: "credit_card", title: "Credit Card" } },
                { type: "reply", reply: { id: "debit_card", title: "Debit Card" } },
                { type: "reply", reply: { id: "main_menu", title: "⬅ Main Menu" } }
              ]
            }
          }
        };
      }

      // ACCOUNT SERVICES / CARD SERVICES → Show Other Services menu
      else if (input === "account_services" || input === "card_services") {
        reply = otherServicesMenu;
      }

      else reply = mainMenu;
    }

    // CARD MENU
    else if (user.step === "CARD_MENU") {
      if (input === "credit_card" || input === "debit_card") {
        user.step = "ASK_CNIC";
        reply = { text: { body: "🔐 Please enter your CNIC number:\n\n(Type MAIN MENU anytime)" } };
      } else reply = mainMenu;
    }

    // CNIC PLACEHOLDER
    else if (user.step === "ASK_CNIC") {
      user.step = "MAIN";
      reply = { text: { body: "❌ Unable to fetch details.\nPlease contact support.\n\nType MAIN MENU" } };
    }

    // OPEN ACCOUNT FLOW → NAME
    else if (user.step === "ASK_NAME") {
      user.name = rawText;
      user.step = "ASK_EMAIL";
      reply = { text: { body: "📧 Please enter your email address:" } };
    }

    // EMAIL
    else if (user.step === "ASK_EMAIL") {
      user.email = rawText;
      user.step = "ASK_PHONE";
      reply = { text: { body: "📱 Please enter your phone number:" } };
    }

    // PHONE → Google Sheets
    else if (user.step === "ASK_PHONE") {
      user.phone = rawText;
      user.step = "MAIN";

      // 🔥 Send to Google Sheets
      try {
        await axios.post(
          "https://script.google.com/macros/s/AKfycbzlw_lUnpcXUAbmGO_2NxNPUJinS8ZWNgsWruzBkM8iQbGWqxbKhtWi2SPIdCIMQtItrA/exec",
          { name: user.name, email: user.email, phone: user.phone }
        );
        console.log("NEW LEAD SAVED:", user);
      } catch (gsErr) {
        console.error("Google Sheets save error:", gsErr.message);
      }

      reply = {
        text: {
          body: `✅ Account Request Submitted!\n\n👤 Name: ${user.name}\n📧 Email: ${user.email}\n📱 Phone: ${user.phone}\n\nOur team will contact you soon.`
        }
      };
    }

    // LIST MENU HANDLER (Other Services clicks)
    if (listId) {
      if (listId === "open_account") {
        user.step = "ASK_NAME";
        reply = { text: { body: "📝 Let's open your account!\n\nPlease enter your full name:" } };
      } else if (listId === "rda_account") {
        reply = { text: { body: "🌍 RDA Account info\n\n(Type MAIN MENU)" } };
      } else if (listId === "loan") {
        reply = { text: { body: "💰 Loan Facilities info\n\n(Type MAIN MENU)" } };
      } else if (listId === "remittance") {
        reply = { text: { body: "🌍 Remittance info\n\n(Type MAIN MENU)" } };
      } else if (listId === "contact") {
        reply = { text: { body: "📞 Connecting to agent...\n\n(Type MAIN MENU)" } };
      } else if (listId === "main_menu") {
        user.step = "MAIN";
        reply = mainMenu;
      }
    }

    // FALLBACK
    if (!reply) reply = mainMenu;

    // SEND MESSAGE
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: from, ...reply },
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" } }
    );

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});