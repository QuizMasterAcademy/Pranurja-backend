const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =====================================================
   ✅ RAZORPAY WEBHOOK (RAW BODY REQUIRED)
   ===================================================== */
app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      console.log("🔔 Razorpay Webhook Received");
      console.log(req.body.toString()); // raw payload

      // For now just acknowledge webhook
      res.status(200).send("Webhook received");
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
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({
        message: "Valid amount is required",
      });
    }

    const options = {
      amount: Math.round(amount * 100), // rupees → paise
      currency: "INR",
      receipt: `pranurja_receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json(order);
  } catch (error) {
    console.error("Razorpay Error:", error);
    res.status(500).json({
      message: "Order creation failed",
    });
  }
});

/* =====================================================
   ✅ START SERVER
   ===================================================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
