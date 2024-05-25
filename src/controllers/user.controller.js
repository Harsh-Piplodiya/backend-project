import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        // both the token methods are from user.model
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // here we add value of the refresh token to the object
        user.refreshToken = refreshToken;
        // here using the save method we store the refresh token in the DB, but doing so normally will coz the DB to validate all the properties of the model but as here we only want to save the refresh token we use "validateBeforeSave" property and assign it as false. So that no validation occurs.
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token.");
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // TODO:-
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

    const userExists = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(userExists){
        throw new ApiError(409, "User with the username or email already exists!")
    }

    // multer gives us access to the files, but we might or might not have access of the files then we take the first object of the avatar as it allows us to choose the path i.e from this we get the whole path of the avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; // this was giving us error for undefined.

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

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

const loginUser = asyncHandler(async (req, res) => {
    // TODO:-
    // req body => data
    // username or email
    // find user
    // check password
    // generate access and refresh token
    // send cookies

    const { email, username, password } = req.body;

    if(!username || !email){
        throw new ApiError(400, "Username or Email is required!");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // cookies are modifiable from the front-end also but by making the options 'httpOnly' and 'secure' true, cookies are only modifiable from the server.
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully."
        )
    )
})

export { registerUser, loginUser }