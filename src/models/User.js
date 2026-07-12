const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
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
            minlength: 8,
            select: false, //NEVER return password in queries by default
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },

        //LastCall Escrow Wallet System
        availableBalance: {
            type: Number,
            default: 2000, //Give new users $2000 to start bidding
            min: [0, 'Balance can not be negative']
        },
        frozenBalance: {
            type: Number,
            default: 0, //Money locked in Active bids,
            min: [0, 'Frozen balance cannot be negative']
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            }
        }
    }
);

//Pre-save hook: Hash password before saving
userSchema.pre('save', async function (next) {
    //Only hash if password was modified(not other profile updates)
    if (!this.isModified('password')) return next();

    //12 salt rounds = Strong Security
    this.password = await bcrypt.hash(this.password, 12);
});

//Instance Method: Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;