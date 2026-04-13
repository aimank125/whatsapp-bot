const express = require("express");
const axios = require("axios");
const app = express();

const PORT = process.env.PORT || 3000;
app.use(express.json());

let users = {};

// ✅ UPDATED SERVICES (REAL ESTATE)
const serviceNames = {
  buy_property: "Buy Property",
  rent_property: "Rent Property",
  talk_agent: "Talk to Agent"
};

app.get("/", (req, res) => {
  res.send("Real Estate WhatsApp Bot Running 🚀");
});

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

// ✅ UPDATED MAIN MENU
const mainMenu = {
  type: "interactive",
  interactive: {
    type: "button",
    body: {
      text: "👋 Welcome!\nLooking for a property in UAE?\n\nChoose an option:"
    },
    action: {
      buttons: [
        { type: "reply", reply: { id: "buy_property", title: "🏠 Buy Property" } },
        { type: "reply", reply: { id: "rent_property", title: "🏢 Rent Property" } },
        { type: "reply", reply: { id: "talk_agent", title: "💬 Talk to Agent" } }
      ]
    }
  }
};

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

    // ✅ START / MAIN MENU
    if (input === "hi" || input === "start" || input === "main_menu") {
      user.step = "MAIN";
      reply = mainMenu;
    }

    // ✅ MAIN FLOW (UPDATED)
    else if (user.step === "MAIN") {
      if (input === "buy_property" || input === "rent_property") {
        user.selectedService = serviceNames[input];
        user.step = "ASK_LOCATION";
        reply = { text: { body: "📍 Preferred location? (e.g., Dubai Marina)" } };
      }

      else if (input === "talk_agent") {
        user.selectedService = "Talk to Agent";
        user.step = "ASK_NAME";
        reply = { text: { body: "📝 Please enter your full name:" } };
      }

      else {
        reply = mainMenu;
      }
    }

    // ✅ NEW STEPS (REAL ESTATE QUALIFICATION)
    else if (user.step === "ASK_LOCATION") {
      user.location = rawText;
      user.step = "ASK_BUDGET";
      reply = { text: { body: "💰 What is your budget?" } };
    }

    else if (user.step === "ASK_BUDGET") {
      user.budget = rawText;
      user.step = "ASK_PROPERTY_TYPE";
      reply = { text: { body: "🏠 Property type? (Apartment / Villa / Office)" } };
    }

    else if (user.step === "ASK_PROPERTY_TYPE") {
      user.propertyType = rawText;
      user.step = "ASK_NAME";
      reply = { text: { body: "📝 Please enter your full name:" } };
    }

    // ✅ EXISTING FLOW (UNCHANGED)
    else if (user.step === "ASK_NAME") {
      user.name = rawText;
      user.step = "ASK_EMAIL";
      reply = { text: { body: "📧 Please enter your email address:" } };
    }

    else if (user.step === "ASK_EMAIL") {
      const email = rawText;

      if (!email.includes("@") || !email.includes(".")) {
        reply = { text: { body: "❌ Invalid email. Please enter a valid email address:" } };
      } else {
        user.email = email;
        user.step = "ASK_PHONE";
        reply = { text: { body: "📱 Please enter your phone number:" } };
      }
    }

    else if (user.step === "ASK_PHONE") {
      const phone = rawText;

      if (!/^[0-9]{8,15}$/.test(phone)) {
        reply = { text: { body: "❌ Invalid phone number. Enter digits only (8–15 numbers):" } };
      } else {
        user.phone = phone;
        user.step = "MAIN";

        try {
          await axios.post(
            "https://script.google.com/macros/s/AKfycbzlw_lUnpcXUAbmGO_2NxNPUJinS8ZWNgsWruzBkM8iQbGWqxbKhtWi2SPIdCIMQtItrA/exec",
            {
              service: user.selectedService,
              name: user.name,
              email: user.email,
              phone: user.phone,
              location: user.location,
              budget: user.budget,
              propertyType: user.propertyType
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

🏠 Type: ${user.propertyType || "-"}
📍 Location: ${user.location || "-"}
💰 Budget: ${user.budget || "-"}

Our agent will contact you shortly.`
          }
        };
      }
    }

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