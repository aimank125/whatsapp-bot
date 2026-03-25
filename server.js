// server.js
const express = require("express");
const axios = require("axios");
const app = express();

const PORT = process.env.PORT || 3000;
app.use(express.json());

// 🧠 User memory
let users = {};

// 🧾 Service Name Mapping (for clean display)
const serviceNames = {
  open_account: "Open Digital Account",
  rda_account: "Open RDA Account",
  loan: "Loan Facilities",
  remittance: "Remittance Services",
  contact: "Talk to Agent",
  card_block: "Block Card",
  card_limit: "Increase Card Limit",
  card_replace: "Replace Card"
};

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
      text: "👋 Hello! I am Demo Bot 🤖\nTyping out. Tapping in — to Smarter Banking\n\nChoose an option:"
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

// ACCOUNT SERVICES MENU
const accountServicesMenu = {
  type: "interactive",
  interactive: {
    type: "list",
    body: { text: "📋 Account Services" },
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

// CARD SERVICES MENU
const cardServicesMenu = {
  type: "interactive",
  interactive: {
    type: "list",
    body: { text: "💳 Card Services" },
    action: {
      button: "Select Services",
      sections: [
        {
          title: "Card Options",
          rows: [
            { id: "card_block", title: "Block Card" },
            { id: "card_limit", title: "Increase Limit" },
            { id: "card_replace", title: "Replace Card" },
            { id: "main_menu", title: "⬅ Main Menu" }
          ]
        }
      ]
    }
  }
};

// WEBHOOK
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

    if (!users[from]) users[from] = { step: "MAIN" };
    const user = users[from];

    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
    let reply;

    // GLOBAL
    if (input === "hi" || input === "start" || input === "main_menu") {
      user.step = "MAIN";
      reply = mainMenu;
    }

    // MAIN MENU
    else if (user.step === "MAIN") {
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

      else if (input === "account_services") {
        user.step = "ACCOUNT_MENU";
        reply = accountServicesMenu;
      }

      else if (input === "card_services") {
        user.step = "CARD_SERVICES_MENU";
        reply = cardServicesMenu;
      }

      else reply = mainMenu;
    }

    // CARD ACTIVATION
    else if (user.step === "CARD_MENU") {
      if (input === "credit_card" || input === "debit_card") {
        user.step = "ASK_CNIC";
        reply = { text: { body: "🔐 Please enter your CNIC number:\n\n(Type MAIN MENU anytime)" } };
      } else reply = mainMenu;
    }

    else if (user.step === "ASK_CNIC") {
      user.step = "MAIN";
      reply = { text: { body: "❌ Unable to fetch details.\nPlease contact support.\n\nType MAIN MENU" } };
    }

    // ACCOUNT SERVICES → ALL COLLECT LEADS
    else if (user.step === "ACCOUNT_MENU" && listId) {
      if (listId !== "main_menu") {
        user.selectedService = serviceNames[listId];
        user.step = "ASK_NAME";
        reply = { text: { body: "📝 Please enter your full name to proceed:" } };
      } else {
        user.step = "MAIN";
        reply = mainMenu;
      }
    }

    // CARD SERVICES → ALL COLLECT LEADS
    else if (user.step === "CARD_SERVICES_MENU") {
      const serviceId = buttonId || listId;

      if (serviceId && serviceId !== "main_menu") {
        user.selectedService = serviceNames[serviceId];
        user.step = "ASK_NAME";
        reply = { text: { body: "📝 Please enter your full name to proceed:" } };
      } else {
        user.step = "MAIN";
        reply = mainMenu;
      }
    }

    // LEAD FLOW
    else if (user.step === "ASK_NAME") {
      user.name = rawText;
      user.step = "ASK_EMAIL";
      reply = { text: { body: "📧 Please enter your email address:" } };
    }

    else if (user.step === "ASK_EMAIL") {
      user.email = rawText;
      user.step = "ASK_PHONE";
      reply = { text: { body: "📱 Please enter your phone number:" } };
    }

    else if (user.step === "ASK_PHONE") {
      user.phone = rawText;
      user.step = "MAIN";

      try {
        await axios.post(
          "https://script.google.com/macros/s/AKfycbzlw_lUnpcXUAbmGO_2NxNPUJinS8ZWNgsWruzBkM8iQbGWqxbKhtWi2SPIdCIMQtItrA/exec",
          {
            service: user.selectedService,
            name: user.name,
            email: user.email,
            phone: user.phone
          }
        );
      } catch (err) {
        console.error("Google Sheets error:", err.message);
      }

      reply = {
        text: {
          body: `✅ Request Submitted!

📌 Service: ${user.selectedService}
👤 Name: ${user.name}
📧 Email: ${user.email}
📱 Phone: ${user.phone}

Our team will contact you soon.`
        }
      };
    }

    // SEND
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});