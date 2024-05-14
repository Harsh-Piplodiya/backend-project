import mongoose, { Schema } from mongoose;
import jwt from "jsonwebtoken"; // mongoose library used for tokens also based on cryptography
import bcrypt from "bcrypt"; // mongoose library based on cryptography used to hash passwords

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        avatar: {
            type: String, // cloudianry url
            required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required!'],
        },
        refreshToken: {
            type: String,
        }
    },
    {
        timestamps: true,
    }
)

// usign the "Pre hook" middleware we can perform some operation JUST before it gets saved into the DB, 
// this below function checks is the password has been modified or not and if it is modified(or created new) then it'll hash the password before storing it into the DB
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
})


// mongoose allows us to inject custom methods of our own using the "methods" middleware, the below function checks the password with the stored password to verify it.
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        //payload
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        // object
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        //payload
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        // object
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);