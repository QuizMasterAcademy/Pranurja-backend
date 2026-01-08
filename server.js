const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

/* =====================================================
   🔔 RAZORPAY WEBHOOK (RAW BODY REQUIRED)
   ===================================================== */
app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const signature = req.headers["x-razorpay-signature"];

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.log("❌ Invalid webhook signature");
        return res.status(400).send("Invalid signature");
      }

      const event = JSON.parse(req.body.toString());
      console.log("✅ Webhook verified:", event.event);

      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;

        const order = orders[orderId];
        if (!order) {
          console.log("⚠️ Order not found");
          return res.status(200).send("Order not found");
        }

        order.status = "PAID";

        // 📧 SEND EMAIL TO OWNER
        await sendOrderEmail(order, payment.id);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).send("Webhook error");
    }
  }
);

/* =====================================================
   ✅ MIDDLEWARES (AFTER WEBHOOK)
   ===================================================== */
app.use(cors());
app.use(express.json());

/* =====================================================
   ✅ RAZORPAY INSTANCE
   ===================================================== */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

/* =====================================================
   🧠 TEMP ORDER STORAGE (USE DB LATER)
   ===================================================== */
const orders = {};

/* =====================================================
   ✅ TEST ROUTE
   ===================================================== */
app.get("/", (req, res) => {
  res.send("Pranurja Backend is running 🚀");
});

/* =====================================================
   ✅ CREATE ORDER ROUTE
   ===================================================== */
app.post("/create-order", async (req, res) => {
  try {
    const { amount, customer, cartItems } = req.body;

    if (!amount || isNaN(amount) || !customer || !cartItems) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const options = {
      amount: Math.round(amount * 100), // rupees → paise
      currency: "INR",
      receipt: `pranurja_receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // ✅ SAVE ORDER DETAILS
    orders[order.id] = {
      orderId: order.id,
      amount,
      customer,
      cartItems,
      status: "PENDING",
    };

    res.status(200).json(order);
  } catch (error) {
    console.error("Order Error:", error);
    res.status(500).json({ message: "Order creation failed" });
  }
});

/* =====================================================
   📧 EMAIL FUNCTION (SEND TO OWNER)
   ===================================================== */
async function sendOrderEmail(order, paymentId) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const itemsList = order.cartItems
    .map(item => `• ${item.name} × ${item.qty}`)
    .join("\n");

  const message = `
🛒 NEW ORDER RECEIVED

Customer Name: ${order.customer.name}
Mobile: ${order.customer.mobile}
Address: ${order.customer.address}

Items:
${itemsList}

Total Paid: ₹${order.amount}
Payment ID: ${paymentId}
`;

  await transporter.sendMail({
    from: `"Pranurja Orders" <${process.env.EMAIL_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: "New Order Received",
    text: message,
  });

  console.log("📧 Order email sent to owner");
}

/* =====================================================
   ✅ START SERVER
   ===================================================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
