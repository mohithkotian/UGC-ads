import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { prisma } from "../configs/PrismaClient.js";
import { v2 as cloudinary } from "cloudinary";
import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const isDemoProvider = process.env.AI_PROVIDER === "demo" || !process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CREDENTIALS_JSON;

const PLAN_LIMITS: Record<string, number> = {
  FREE: 20,
  PRO: 80,
  PREMIUM: 300,
};

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const getAccessToken = async (): Promise<string> => {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to obtain Google access token");
  return tokenResponse.token;
};

//////////////////////////////////////////////////////
// IMAGE GENERATION (IMAGEN)
//////////////////////////////////////////////////////

const downloadAsDataUri = async (url: string): Promise<string> => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const mimeType = String(response.headers["content-type"] || "image/png").split(";")[0];
  return `data:${mimeType};base64,${Buffer.from(response.data).toString("base64")}`;
};

const generateImageWithImagen = async (
  prompt: string,
  aspectRatio?: string | null,
  fallbackImageUrl?: string,
): Promise<string> => {
  if (isDemoProvider) {
    if (!fallbackImageUrl) throw new Error("Demo provider requires an uploaded product image");
    console.warn("AI_PROVIDER=demo: using the uploaded product image as the generated image");
    return downloadAsDataUri(fallbackImageUrl);
  }

  const token = await getAccessToken();

  const response = await axios.post(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
    {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio === "9:16" || aspectRatio === "16:9" || aspectRatio === "1:1"
          ? aspectRatio
          : "1:1",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const base64Image = response.data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Image) throw new Error("Imagen returned no image");

  return `data:image/png;base64,${base64Image}`;
};

//////////////////////////////////////////////////////
// VIDEO GENERATION (VEO)
//////////////////////////////////////////////////////

const generateDemoVideo = async (imageUrl: string, aspectRatio?: string | null): Promise<string> => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ugc-demo-"));
  const inputPath = path.join(tempDir, "input");
  const outputPath = path.join(tempDir, "output.mp4");
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    await fs.promises.writeFile(inputPath, response.data);
    const size = aspectRatio === "9:16" ? "720:1280" : aspectRatio === "1:1" ? "1080:1080" : "1280:720";
    const filter = `scale=${size}:force_original_aspect_ratio=increase,crop=${size},zoompan=z='min(zoom+0.0015,1.08)':d=150:s=${size}:fps=30`;
    await execFileAsync("ffmpeg", [
      "-y", "-loop", "1", "-i", inputPath, "-t", "5", "-vf", filter,
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
    ]);
    const video = await fs.promises.readFile(outputPath);
    return `data:video/mp4;base64,${video.toString("base64")}`;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
};

const generateVideoWithVeo = async (
  imageUrl: string,
  prompt: string,
  aspectRatio?: string | null,
): Promise<string> => {
  if (isDemoProvider) {
    console.warn("AI_PROVIDER=demo: generating a deterministic Ken Burns demo video with FFmpeg");
    return generateDemoVideo(imageUrl, aspectRatio);
  }

  const token = await getAccessToken();

  const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const imageBase64 = Buffer.from(imageResponse.data).toString("base64");
  const mimeType = String(imageResponse.headers["content-type"] || "image/png").split(";")[0];
  const ratio = aspectRatio === "9:16" ? "9:16" : "16:9";

  //////////////////////////////////////////////////////
  // SUBMIT VIDEO JOB
  //////////////////////////////////////////////////////

  const submitResponse = await axios.post(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-2.0-generate-001:predictLongRunning`,
    {
      instances: [
        {
          prompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType,
          },
        },
      ],
      parameters: {
        aspectRatio: ratio,
        sampleCount: 1,
        durationSeconds: 5,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const operationName: string = submitResponse.data.name;
  console.log("Veo operation started:", operationName);

  //////////////////////////////////////////////////////
  // POLLING - must use fetchPredictOperation (POST)
  // NOT a GET to the operation URL
  //////////////////////////////////////////////////////

  const fetchUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/veo-2.0-generate-001:fetchPredictOperation`;

  console.log("Polling URL:", fetchUrl);

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 15000));

    const freshToken = await getAccessToken();

    const pollResponse = await axios.post(
      fetchUrl,
      { operationName },
      {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const operation = pollResponse.data;
    console.log(`Poll ${i + 1}: done=${operation.done}`);

    if (operation.done) {
      if (operation.error) throw new Error(operation.error.message);

      // fetchPredictOperation returns videos array with gcsUri
      const videos = operation.response?.videos || operation.response?.predictions;
      const video = videos?.[0];

      if (!video) throw new Error("No video returned");

      // Try gcsUri first, then base64
      if (video.gcsUri) {
        const videoResp = await axios.get(video.gcsUri, { responseType: "arraybuffer" });
        const videoBase64 = Buffer.from(videoResp.data).toString("base64");
        return `data:video/mp4;base64,${videoBase64}`;
      }

      const videoBase64 = video.bytesBase64Encoded;
      if (!videoBase64) throw new Error("No video data returned");

      return `data:video/mp4;base64,${videoBase64}`;
    }
  }

  throw new Error("Video generation timed out");
};

//////////////////////////////////////////////////////
// CREATE PROJECT
//////////////////////////////////////////////////////

export const createProject = async (req: Request, res: Response) => {
  const { userId } = (req as any).auth();

  const {
    name = "New Project",
    aspectRatio,
    userPrompt,
    productName,
    productDescription,
    targetLength = 5,
  } = req.body;

  const images: Express.Multer.File[] = (req as any).files;

  if (!images || images.length < 2 || !productName) {
    return res.status(400).json({ message: "Upload at least 2 images and product name" });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const baseLimit = PLAN_LIMITS[dbUser.plan] || 20;
    if (baseLimit - dbUser.usedCredits < 5) {
      return res.status(401).json({ message: "Insufficient credits" });
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: { usedCredits: { increment: 5 } },
    });

    const uploadedImages = await Promise.all(
      images.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path);
        return result.secure_url;
      }),
    );

    const project = await prisma.project.create({
      data: {
        name,
        userId: dbUser.id,
        aspectRatio,
        userPrompt,
        productName,
        productDescription,
        targetLength: Number(targetLength),
        uploadedImages,
        isGenerating: true,
      },
    });

    const imagePrompt = `
Professional advertisement shot of ${productName}.
${productDescription}.
Cinematic lighting.
${userPrompt}
`.trim();

    const base64Image = await generateImageWithImagen(imagePrompt, aspectRatio, uploadedImages[0]);
    const uploadResult = await cloudinary.uploader.upload(base64Image);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        generatedImage: uploadResult.secure_url,
        isGenerating: false,
      },
    });

    res.json({ message: "Project created", projectId: project.id });

  } catch (error: any) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};

//////////////////////////////////////////////////////
// GENERATE VIDEO
//////////////////////////////////////////////////////

export const createVideo = async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ message: "Project ID missing" });

  try {
    const { userId } = (req as any).auth();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: dbUser.id },
    });
    if (!project || !project.generatedImage) {
      return res.status(404).json({ message: "Generated image not found" });
    }
    if (project.isGenerating) {
      return res.status(409).json({ message: "Generation is already in progress" });
    }

    const baseLimit = PLAN_LIMITS[dbUser.plan] || 20;
    if (baseLimit - dbUser.usedCredits < 10) {
      return res.status(401).json({ message: "Insufficient credits" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: dbUser.id },
        data: { usedCredits: { increment: 10 } },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { isGenerating: true, error: null },
      }),
    ]);

    // Veo is long-running. Return immediately and let the result page poll the project.
    void (async () => {
      try {
        const videoPrompt = `Dynamic cinematic movement showing ${project.productName || "the product"}.
High resolution advertisement video.`;
        const base64Video = await generateVideoWithVeo(
          project.generatedImage!,
          videoPrompt,
          project.aspectRatio,
        );
        const uploadResult = await cloudinary.uploader.upload(base64Video, {
          resource_type: "video",
        });
        await prisma.project.update({
          where: { id: projectId },
          data: { generatedVideo: uploadResult.secure_url, isGenerating: false, error: null },
        });
      } catch (error: any) {
        console.error("VIDEO ERROR:", error);
        Sentry.captureException(error);
        await prisma.project.update({
          where: { id: projectId },
          data: { isGenerating: false, error: error?.message || "Video generation failed" },
        });
      }
    })();

    return res.status(202).json({
      message: "Video generation started",
      projectId,
      status: "processing",
    });
  } catch (error: any) {
    console.error("VIDEO ERROR:", error);
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

//////////////////////////////////////////////////////
// GET PROJECT
//////////////////////////////////////////////////////

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

//////////////////////////////////////////////////////
// COMMUNITY
//////////////////////////////////////////////////////

export const getAllPublishedProjects = async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
};

//////////////////////////////////////////////////////
// DELETE
//////////////////////////////////////////////////////

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).auth();

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const projectId = req.params.projectId as string;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: dbUser.id },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    await prisma.project.delete({ where: { id: project.id } });

    res.json({ message: "Project deleted" });
  } catch (error: any) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};