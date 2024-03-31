// require('dotenv').config({path: './env'}); // this will also work just fine but for the sack of code consistency
import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

// for using dotenv using 'import' we need to use experimental feature and do some change in the 'package.json' file
dotenv.config({
    path: './env'
});

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.log("ERRR: ", error);
        throw error;
    })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port: ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MongoDB connection Failed!" + err);
})













/*
// this is one approach to connect to the DB

import express from 'express';
const app = express();

// this iffy fucntion is for connecting to our Database.
;( async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

        app.on("error", (error) => {
            console.log("ERRR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port: ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: " + error);
        throw error;
    }
})()
*/