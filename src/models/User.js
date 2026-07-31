const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false, //NEVER return password in queries by default
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    //LastCall Escrow Wallet System
    availableBalance: {
      type: Number,
      default: 2000, //Give new users $2000 to start bidding
      min: [0, "Balance can not be negative"],
    },
    frozenBalance: {
      type: Number,
      default: 0, //Money locked in Active bids,
      min: [0, "Frozen balance cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    watchlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Modern Mongoose: Use 'async function(next)' OR just remove 'next()' entirely
userSchema.pre('save', async function () {
  // If password isn't modified, just call next and exit
  if (!this.isModified('password')) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Tell Mongoose we are done
  } catch (error) {
    next(error); // Pass any errors to Mongoose
  }
});

//Instance Method: Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
