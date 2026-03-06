import "./configs/instrument.mjs"
import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from "cors";
import { clerkMiddleware } from '@clerk/express'
import clerkWebhooks from "./controllers/clerk.js"; // Added .js to match your project style
import * as Sentry from "@sentry/node"
import userRouter from "./routes/userRouter.js";
import projectRouter from "./routes/projectRoutes.js"

const app = express();

// Middleware
app.use(cors());

// Webhook must come BEFORE express.json()
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhooks);

app.use(express.json());
app.use(clerkMiddleware());

const PORT = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});

// Sentry Debug Route
app.get("/debug-sentry", function mainHandler(req, res) {
    throw new Error("My first Sentry error!");
});

// Fixed: Ensure userRouter is correctly imported above
app.use('/api/user', userRouter)
app.use('/api/project',projectRouter)

// Sentry Error Handler (Must be after all routes)
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});