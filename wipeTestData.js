require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import all models
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Request = require('./models/Request');
const Withdraw = require('./models/Withdraw');
const Ebook = require('./models/Ebook');
const DailyStat = require('./models/DailyStat');
const WeeklyStat = require('./models/WeeklyStat');
const MonthlyStat = require('./models/MonthlyStat');
const JobMeta = require('./models/JobMeta');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper function to delete directory contents
const deleteDirectoryContents = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    console.log(`${colors.yellow}Directory not found: ${directoryPath}${colors.reset}`);
    return 0;
  }

  const files = fs.readdirSync(directoryPath);
  let deletedCount = 0;

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively delete subdirectory contents
      deletedCount += deleteDirectoryContents(filePath);
    } else {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  });

  return deletedCount;
};

// Function to get user confirmation
const getUserConfirmation = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\n${colors.red}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.red}WARNING: THIS WILL DELETE ALL DATA FROM THE DATABASE!${colors.reset}`);
    console.log(`${colors.red}${'='.repeat(70)}${colors.reset}\n`);
    console.log('This script will delete:');
    console.log(`${colors.yellow}  - All users${colors.reset}`);
    console.log(`${colors.yellow}  - All transactions${colors.reset}`);
    console.log(`${colors.yellow}  - All requests${colors.reset}`);
    console.log(`${colors.yellow}  - All withdrawals${colors.reset}`);
    console.log(`${colors.yellow}  - All ebooks${colors.reset}`);
    console.log(`${colors.yellow}  - All statistics (daily, weekly, monthly)${colors.reset}`);
    console.log(`${colors.yellow}  - All job metadata${colors.reset}`);
    console.log(`${colors.yellow}  - All uploaded files (proofs, ebooks, profile images)${colors.reset}\n`);

    rl.question(
      `${colors.cyan}Type 'DELETE ALL DATA' to confirm: ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer.trim() === 'DELETE ALL DATA');
      }
    );
  });
};

// Main function to wipe all test data
const wipeTestData = async () => {
  try {
    console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.blue}Starting Test Data Wipe Process${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);

    // Connect to MongoDB
    console.log(`${colors.cyan}Connecting to MongoDB...${colors.reset}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`${colors.green}✓ MongoDB connected successfully${colors.reset}\n`);

    // Get user confirmation
    const confirmed = await getUserConfirmation();

    if (!confirmed) {
      console.log(`\n${colors.yellow}Operation cancelled by user.${colors.reset}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n${colors.magenta}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.magenta}Starting data deletion...${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(70)}${colors.reset}\n`);

    // Delete all database collections
    console.log(`${colors.cyan}Deleting database collections...${colors.reset}\n`);

    const collections = [
      { model: User, name: 'Users' },
      { model: Transaction, name: 'Transactions' },
      { model: Request, name: 'Requests' },
      { model: Withdraw, name: 'Withdrawals' },
      { model: Ebook, name: 'Ebooks' },
      { model: DailyStat, name: 'Daily Statistics' },
      { model: WeeklyStat, name: 'Weekly Statistics' },
      { model: MonthlyStat, name: 'Monthly Statistics' },
      { model: JobMeta, name: 'Job Metadata' },
    ];

    let totalDeleted = 0;

    for (const { model, name } of collections) {
      const result = await model.deleteMany({});
      console.log(
        `${colors.green}✓ ${name}: ${result.deletedCount} document(s) deleted${colors.reset}`
      );
      totalDeleted += result.deletedCount;
    }

    console.log(
      `\n${colors.green}Total documents deleted: ${totalDeleted}${colors.reset}\n`
    );

    // Delete uploaded files
    console.log(`${colors.cyan}Deleting uploaded files...${colors.reset}\n`);

    const directories = [
      { path: path.join(__dirname, 'proofs'), name: 'Proof Images' },
      { path: path.join(__dirname, 'ebooks'), name: 'Ebook PDFs' },
      { path: path.join(__dirname, 'uploads'), name: 'User Uploads' },
    ];

    let totalFilesDeleted = 0;

    for (const { path: dirPath, name } of directories) {
      const deletedCount = deleteDirectoryContents(dirPath);
      console.log(
        `${colors.green}✓ ${name}: ${deletedCount} file(s) deleted${colors.reset}`
      );
      totalFilesDeleted += deletedCount;
    }

    console.log(
      `\n${colors.green}Total files deleted: ${totalFilesDeleted}${colors.reset}\n`
    );

    // Summary
    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.blue}Data Wipe Complete!${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
    console.log(`${colors.green}Summary:${colors.reset}`);
    console.log(`  - Database documents deleted: ${totalDeleted}`);
    console.log(`  - Files deleted: ${totalFilesDeleted}`);
    console.log(`\n${colors.green}Your database is now ready for production!${colors.reset}\n`);

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log(`${colors.cyan}✓ MongoDB connection closed${colors.reset}\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}Error wiping test data:${colors.reset}`, error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the script
wipeTestData();
