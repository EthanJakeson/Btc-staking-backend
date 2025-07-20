// File: backend/index.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/btcstaking";

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const depositSchema = new mongoose.Schema({
  wallet: String,
  amount: Number,
  date: { type: Date, default: Date.now },
  stakingDays: Number,
});

const withdrawalSchema = new mongoose.Schema({
  wallet: String,
  requestDate: { type: Date, default: Date.now },
});

const Deposit = mongoose.model("Deposit", depositSchema);
const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

const BTC_RECEIVE_ADDRESS = "bc1qtuvm3t942kmg0swplpj9s7nc0kkzrpmqlt693cnpxg37cgzyhxlqjqexau";

function calculateReward(amount, stakingDays) {
  let rate = 0;
  if (amount >= 0.07 && amount <= 5.5) rate = 0.08;
  if (amount > 5.5 && amount <= 20) rate = 0.10;
  return amount * rate * stakingDays;
}

// Routes
app.get("/deposit-address", (req, res) => {
  res.json({ address: BTC_RECEIVE_ADDRESS });
});

app.post("/deposit", async (req, res) => {
  const { wallet, amount, stakingDays } = req.body;
  if (!wallet || !amount || !stakingDays) return res.status(400).json({ error: "Missing fields" });
  if (amount < 0.07 || amount > 20) return res.status(400).json({ error: "Deposit out of bounds" });
  if (stakingDays < 20 || stakingDays > 90) return res.status(400).json({ error: "Staking period must be 20–90 days" });
  try {
    const deposit = new Deposit({ wallet, amount, stakingDays });
    await deposit.save();
    res.json({ message: "Deposit recorded", forwardTo: BTC_RECEIVE_ADDRESS });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/rewards/:wallet", async (req, res) => {
  const { wallet } = req.params;
  try {
    const deposit = await Deposit.findOne({ wallet });
    if (!deposit) return res.status(404).json({ error: "No deposit found" });

    const now = new Date();
    const elapsedDays = Math.min(
      Math.floor((now - new Date(deposit.date)) / (1000 * 60 * 60 * 24)),
      deposit.stakingDays
    );

    const rewards = calculateReward(deposit.amount, elapsedDays);
    res.json({ amount: deposit.amount, days: elapsedDays, rewards });
  } catch (err) {
    res.status(500).json({ error: "Could not calculate rewards" });
  }
});

app.post("/withdraw", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Wallet required" });
  try {
    const request = new Withdrawal({ wallet });
    await request.save();
    res.json({ message: "Withdrawal request received" });
  } catch (err) {
    res.status(500).json({ error: "Failed to store withdrawal request" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
