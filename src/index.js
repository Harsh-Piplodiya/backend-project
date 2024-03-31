// require('dotenv').config({path: './env'}); // this will also work just fine but for the sack of code consistency
import dotenv from 'dotenv';
import connectDB from './db/index.js';

// for using dotenv using 'import' we need to use experimental feature and do some change in the 'package.json' file
dotenv.config({
    path: './env'
});

connectDB()













/*
// this is one approach to connect to the DB
// this iffy fucntion is for connecting to our Database.

;( async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    } catch (error) {
        console.error("ERROR: " + error);
        throw error;
    }
})()
*/