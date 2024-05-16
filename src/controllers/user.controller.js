import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if account already exist - username, email
    // check for avatar, check for images
    // upload files to cloudinary, check avatar
    // create user object - create entry in DB
    // remove password and refresh token field from the response
    // check for user creation
    // return res

    const { username, email, fullName, password } = req.body;
    console.log("emali: ", email);

    if(
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required!");
    }

    const userExists = User.findOne({
        $or: [{ username }, { email }]
    })

    if(userExists){
        throw new ApiError(409, "User with the username or email already exists!")
    }

    // multer gives us access to the files, but we might or might not have access of the files then we take the first object of the avatar as it allows us to choose the path i.e from this we get the whole path of the avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!");
    }

    // uploading the files on cloudinary and getting the response
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required!");
    }

    // now doing entry into the DB
    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password
    })

    // now we need to check if the user was actually created or not?
    // using the select method we can remove the fields we do not want.
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!userCreated){
        throw new ApiError(500, "Something went wrong while registering the user.");
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated, "User registered Successfully!")
    )
})

export { registerUser }