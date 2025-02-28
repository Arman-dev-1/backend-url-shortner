import express from "express";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const BASE_URL = process.env.BASE_URL;
const REDIRECT_URL = process.env.REDIRECT_URL;

if (!MONGO_URI || !BASE_URL) {
  throw new Error("Missing MONGO_URI or BASE_URL in environment variables");
}

// Connect to MongoDB (urlshortener database)
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, dbName: "urlshortener" })
  .then(() => console.log("MongoDB Connected to urlshortener"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Define URL Schema
const urlSchema = new mongoose.Schema({
  shortId: String,
  originalUrl: String,
  users: [String], // Array to store user IDs
});

const UrlModel = mongoose.model("Url", urlSchema);

app.use(express.json());
app.use(cors());

// Route to create a short URL
app.post("/shorten", async (req, res) => {
  try {
    const { url, id } = req.body;
    const userId = id;
    if (!url || !id) return res.status(400).json({ error: "URL and userId are required" });

    // Check if URL already exists
    let existingUrl = await UrlModel.findOne({ originalUrl: url });

    if (existingUrl) {
      // If user already exists, return existing short URL
      if (!existingUrl.users.includes(userId)) {
        existingUrl.users.push(userId);
        await existingUrl.save();
      }
      return res.status(200).json({ shortenedUrl: `${BASE_URL}/s/${existingUrl.shortId}` });
    }

    // Generate a new short ID
    const shortId = uuidv4().slice(0, 6);

    // Save new URL with user ID
    const newUrl = new UrlModel({ shortId, originalUrl: url, users: [userId] });
    await newUrl.save();

    const shortenedUrl = `${REDIRECT_URL}s/${shortId}`;
    res.status(201).json({ shortenedUrl });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Route to get all URLs created by a user
app.post("/user", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(userId);
    const userUrls = await UrlModel.find({ users: userId });

    if (userUrls.length === 0) {
      return res.status(404).json({ error: "No URLs found for this user" });
    }

    const response = userUrls.map(url => ({
      originalUrl: url.originalUrl,
      shortenedUrl: `${REDIRECT_URL}s/${url.shortId}`
    }));

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Route to redirect to the original URL
app.get("/s/:shortId", async (req, res) => {
  try {
    const { shortId } = req.params;
    const urlEntry = await UrlModel.findOne({ shortId });

    if (urlEntry) {
      return res.redirect(urlEntry.originalUrl);
    } else {
      return res.status(404).json({ error: "Short URL not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.get("/hello", (req, res) => {
  res.json({ message: "Hello, world!" }); // Ensure response is JSON
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
