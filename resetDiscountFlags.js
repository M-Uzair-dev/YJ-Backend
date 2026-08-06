require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

// One-time migration for the "discount suppresses passive income" rule change.
//
// User.discounted used to be written on every discounted signup but was never
// read by anything. It is now load-bearing: a user carrying the flag generates
// no passive income for their referrer on ANY sale they make.
//
// Leaving the historical values in place would silently switch off passive
// income for referrers whose downline was onboarded at a discount months ago.
// This resets every flag to false so the new rule only governs purchases made
// from here on.
//
// Run once, after deploying the new logic:
//   node resetDiscountFlags.js          (preview only - writes nothing)
//   node resetDiscountFlags.js --apply  (performs the reset)

const APPLY = process.argv.includes("--apply");

async function resetDiscountFlags() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI is not set. Check your .env file.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const totalUsers = await User.countDocuments();
    const flagged = await User.countDocuments({ discounted: true });

    console.log(`\nUsers in database:      ${totalUsers}`);
    console.log(`Currently flagged:      ${flagged}`);

    if (flagged === 0) {
      console.log("\nNothing to reset - no user carries the flag.");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Show who is affected so the change is auditable before it happens
    const affected = await User.find({ discounted: true })
      .select("name email plan referral_of")
      .limit(50);

    console.log("\nAffected users (first 50):");
    affected.forEach((user) => {
      console.log(`  - ${user.name} <${user.email}> (${user.plan || "no plan"})`);
    });

    if (!APPLY) {
      console.log(
        `\nPreview only - nothing was written.\nRe-run with --apply to reset all ${flagged} flag(s) to false.`
      );
      await mongoose.connection.close();
      process.exit(0);
    }

    const result = await User.updateMany(
      { discounted: true },
      { $set: { discounted: false } }
    );

    console.log(`\nReset ${result.modifiedCount} user(s) to discounted: false`);

    const remaining = await User.countDocuments({ discounted: true });
    console.log(`Remaining flagged users: ${remaining}`);
    console.log("\nDone. The new passive income rule now applies to future purchases only.");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

resetDiscountFlags();
