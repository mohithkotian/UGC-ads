// Write google credentials from env to file at runtime — MUST BE FIRST
import fs from "fs"
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  fs.writeFileSync(
    "./google-credentials.json",
    process.env.GOOGLE_CREDENTIALS_JSON
  )
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "./google-credentials.json"
}

import "./configs/instrument.mjs"
import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from "cors";
import { clerkMiddleware } from '@clerk/express'
import clerkWebhooks from "./controllers/clerk.js";
import * as Sentry from "@sentry/node"
import userRouter from "./routes/userRouter.js";
import projectRouter from "./routes/projectRoutes.js"
import { trackVisitor } from "./middlewares/tracker";
import adminRouter from "./routes/admin";

const app = express();

app.use(cors());

app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhooks);

app.use(express.json());
app.use(clerkMiddleware());

const PORT = parseInt(process.env.PORT || "5000");

app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});

app.get("/debug-sentry", function mainHandler(req, res) {
    throw new Error("My first Sentry error!");
});

app.use('/api/user', userRouter)
app.use('/api/project', projectRouter)

Sentry.setupExpressErrorHandler(app);

// 0.0.0.0 is required for Render to detect the server is running
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});


app.use(trackVisitor);
app.use("/api/admin", adminRouter);