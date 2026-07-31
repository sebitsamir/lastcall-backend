const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10, //Connection pooling
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    //Exit process if the DB fails to connect -API is useless without it
    process.exit(1);
  }
};

module.exports = connectDB;
