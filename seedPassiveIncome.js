require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Transaction = require("./models/Transaction");

// ===== CONFIGURATION =====
// Replace this with your user's MongoDB ObjectId
const USER_ID = "68f9f24aff4eaa40878fb051";

// Passive income transactions to create
const PASSIVE_INCOME_AMOUNTS = [100, 150, 200, 250, 300]; // Total: $1000
// =========================

async function seedPassiveIncome() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Validate USER_ID
    if (USER_ID === "YOUR_USER_ID_HERE") {
      console.error("❌ Please set the USER_ID variable in the script");
      process.exit(1);
    }

    // Find the user
    const user = await User.findById(USER_ID);
    if (!user) {
      console.error("❌ User not found with ID:", USER_ID);
      process.exit(1);
    }

    console.log(`\n👤 Found user: ${user.name} (${user.email})`);
    console.log(`💰 Current passive income: $${user.passive_income}`);

    // Create passive income transactions
    let totalAdded = 0;
    const transactions = [];

    for (const amount of PASSIVE_INCOME_AMOUNTS) {
      const transaction = await Transaction.create({
        user_id: USER_ID,
        type: "passive",
        amount: amount,
      });
      transactions.push(transaction);
      totalAdded += amount;
      console.log(`✅ Created passive income transaction: $${amount}`);
    }

    // Update user's passive income
    user.passive_income += totalAdded;
    await user.save();

    console.log(`\n✅ Successfully added ${transactions.length} transactions`);
    console.log(`💵 Total passive income added: $${totalAdded}`);
    console.log(`💰 New passive income balance: $${user.passive_income}`);
    console.log(`\n🎉 Done! You can now test the withdraw functionality.`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the script
seedPassiveIncome();
