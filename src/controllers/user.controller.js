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

    return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User registered Successfully!"))
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
    // console.log(email);

    // if(!username && !email){
    //     throw new ApiError(400, "Username or email is required!");
    // }

    if(!(username || email)){
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

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from the documents
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out."))
})

// creating endpoint so that when the access token of the user expires after hitting the endpoint they'll be assigned a new access token and refresh token, if their refresh token and the one stores in the DB is the same i.e if the session expires of the user coz access tokens are short lived or for any other reason than the refresh token can be checked to log user back in / restart or continue the session of the user.
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request.");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token.");
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used.");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed."
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token.");
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password.");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully."))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully."))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully."))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file missing.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading the avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully."))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage file missing.");
    }

    // TODO: delete old image

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading the coverImage");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated successfully."))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing.");
    }

    const channel = await User.aggregate([
        {   // 1st pipeline / stage -> in this we match the user
            $match: {
                username: username?.toLowerCase()
            }
        },
        {   // 2nd pipeline / stage -> counting the subscribers thorugh channel
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {   // 3rd pipeline / stage -> countign the channels subscribed_to through subscriber
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {   // 4th pipeline / stage -> adding some more fields to the OG User object / model.
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {   // 5th pipeline / stage -> 'project' is used for projection of only the fields that are demanded or necessary and not all.
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist.")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched successfully."))
})

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile
}