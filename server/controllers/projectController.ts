import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { prisma } from "../configs/PrismaClient.js";
import { v2 as cloudinary } from "cloudinary";
import { GoogleAuth } from "google-auth-library";
import axios from "axios";

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

const generateImageWithImagen = async (prompt: string): Promise<string> => {
  const token = await getAccessToken();

  const response = await axios.post(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`,
    {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "1:1" },
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

const generateVideoWithVeo = async (
  imageUrl: string,
  prompt: string,
  aspectRatio?: string | null,
): Promise<string> => {
  const token = await getAccessToken();

  const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const imageBase64 = Buffer.from(imageResponse.data).toString("base64");
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
            mimeType: "image/jpeg",
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

    const base64Image = await generateImageWithImagen(imagePrompt);
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
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project || !project.generatedImage) {
      return res.status(404).json({ message: "Generated image not found" });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { isGenerating: true },
    });

    const videoPrompt = `
Dynamic cinematic movement showing ${project.productName}.
High resolution advertisement video.
`.trim();

    const base64Video = await generateVideoWithVeo(
      project.generatedImage,
      videoPrompt,
      project.aspectRatio,
    );

    const uploadResult = await cloudinary.uploader.upload(base64Video, {
      resource_type: "video",
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        generatedVideo: uploadResult.secure_url,
        isGenerating: false,
      },
    });

    res.json({ message: "Video generation complete", videoUrl: uploadResult.secure_url });

  } catch (error: any) {
    console.error("VIDEO ERROR:", error);
    Sentry.captureException(error);

    await prisma.project.update({
      where: { id: projectId },
      data: { isGenerating: false, error: error.message },
    });

    res.status(500).json({ message: error.message });
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