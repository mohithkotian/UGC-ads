import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/express";
import { prisma } from "../configs/PrismaClient.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ======================================================
// PLAN LIMITS
// ======================================================
const PLAN_LIMITS: Record<string, number> = {
  FREE: 20,
  PRO: 80,
  PREMIUM: 300,
};

// ======================================================
// HELPER: Fetch real plan from Clerk API
// Works for free trials, upgrades, downgrades — everything
// ======================================================
const getPlanFromClerk = async (clerkUserId: string): Promise<string> => {
  try {
    // @ts-ignore — billing is experimental in Clerk SDK
    const subscription = await clerk.billing.getUserBillingSubscription(clerkUserId);
    console.log("Clerk subscription:", JSON.stringify(subscription, null, 2));

    if (!subscription) return "FREE";

    // Clerk BillingSubscription uses subscriptionItems (not items)
    const items = (subscription as any).subscriptionItems || [];
    // hey if someone  is reading this first of all hey stalker  fuck u andddd
    // listen this subscriptionItems  literally took a day to find the error and i was doing every thing except this and actual
    // i wrote .Items and that small word fucked me man and i was almost over it and kept doing it and finally solved it ....hooohohohhh
    // the song was listening when i solved was "HAND IN GLOVE" by the smiths
    // time taken for this shit was around 12 hrs and + today was like 3 hrs yeah
    // see u stalker and if kept reading this thank u :)
    const activeItem =
      items.find(
        (item: any) => item.status === "active" || item.isFreeTrial === true
      ) || items[0];

    const slug: string = activeItem?.plan?.slug?.toLowerCase() || "";
    console.log("Active plan slug:", slug);

    if (slug.includes("premium")) return "PREMIUM";
    if (slug.includes("pro")) return "PRO";

    return "FREE";
  } catch (err: unknown) {
    const e = err as { message?: string };
    // No subscription = FREE plan
    console.log("No active subscription found, defaulting to FREE:", e?.message);
    return "FREE";
  }
};

// ======================================================
// 1. Get User Credits
// Always fetches real plan from Clerk — never trusts DB plan
// ======================================================
export const getUserCredits = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ success: false });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false });
    }

    // Always get the real plan from Clerk
    const realPlan = await getPlanFromClerk(userId);

    // If plan in DB is different, sync it silently
    if (user.plan !== realPlan) {
      console.log(`Syncing plan for ${userId}: ${user.plan} → ${realPlan}`);
      await prisma.user.update({
        where: { clerkId: userId },
        data: { plan: realPlan },
      });
    }

    const baseLimit = PLAN_LIMITS[realPlan] || 20;
    const remainingCredits = baseLimit - user.usedCredits;

    return res.json({
      success: true,
      credits: remainingCredits,
      plan: realPlan,
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    Sentry.captureException(error);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================================
// 2. Update User Plan (fallback for manual sync)
// ======================================================
export const updateUserPlan = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Always fetch from Clerk directly — ignore body plan
    const realPlan = await getPlanFromClerk(userId);

    const updatedUser = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        plan: realPlan,
        usedCredits: 0,
      },
    });

    console.log(`Plan synced for ${userId}: ${updatedUser.plan}`);

    return res.json({
      success: true,
      plan: updatedUser.plan,
      credits: PLAN_LIMITS[updatedUser.plan] || 20,
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    Sentry.captureException(error);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================================
// 3. Get All Projects
// ======================================================
export const getAllProjects = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const projects = await prisma.project.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, projects });

  } catch (error: unknown) {
    const err = error as { message?: string };
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ======================================================
// 4. Get Project By Id
// ======================================================
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.projectId as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: dbUser.id },
    });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.json({ success: true, project });

  } catch (error: unknown) {
    const err = error as { message?: string };
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ======================================================
// 5. Toggle Project Public
// ======================================================
export const toggleProjectPublic = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.projectId as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: dbUser.id },
    });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { isPublished: !project.isPublished },
    });

    res.json({ success: true, isPublished: updatedProject.isPublished });

  } catch (error: unknown) {
    const err = error as { message?: string };
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: err.message });
  }
};