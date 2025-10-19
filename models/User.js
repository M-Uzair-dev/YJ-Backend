const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    balance: {
      type: Number,
      default: 0,
    },
    direct_income: {
      type: Number,
      default: 0,
    },
    passive_income: {
      type: Number,
      default: 0,
    },
    referral_code: {
      type: String,
      unique: true,
    },
    referral_of: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
    },
    plan: {
      type: String,
      enum: ['knowic', 'learnic', 'masteric'],
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique referral code before saving
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Generate unique referral code for new users
  if (this.isNew && !this.referral_code) {
    let referralCode;
    let isUnique = false;

    while (!isUnique) {
      referralCode = crypto.randomBytes(4).toString('hex'); // 8-character hex
      const existingUser = await this.constructor.findOne({ referral_code: referralCode });
      if (!existingUser) {
        isUnique = true;
      }
    }

    this.referral_code = referralCode;
  }

  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token and save to database
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiry to 1 hour
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
