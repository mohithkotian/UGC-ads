import express from "express";
import {
  createProject,
  createVideo,
  deleteProject,
  getAllPublishedProjects,
  getProjectById
} from "../controllers/projectController.js";

import { protect } from "../middlewares/auth.js";
import upload from "../configs/multer.js";

const projectRouter = express.Router();

// Create project
projectRouter.post(
  "/create",
  upload.array("images", 2),
  protect,
  createProject
);

// Generate video
projectRouter.post(
  "/video",
  protect,
  createVideo
);

// Community projects
projectRouter.get(
  "/published",
  getAllPublishedProjects
);

// Get single project
projectRouter.get(
  "/:projectId",
  protect,
  getProjectById
);

// Delete project
projectRouter.delete(
  "/:projectId",
  protect,
  deleteProject
);

export default projectRouter;