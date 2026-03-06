import { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { prisma } from "../configs/PrismaClient.js";
import * as Sentry from "@sentry/node";

// ======================================================
// HELPER: Extract plan slug from multiple payload shapes
// Clerk sends different structures depending on event type
// ======================================================
const extractPlanSlug = (data: any): string | undefined => {
  return (
    data?.subscription_items?.[0]?.plan?.slug ||   // paymentAttempt.updated (upgrade)
    data?.subscription?.items?.[0]?.plan?.slug ||  // paymentAttempt.updated (downgrade)
    data?.items?.[0]?.plan?.slug ||                // subscription.created/updated (shape A)
    data?.subscription_items?.[0]?.plan?.slug      // subscription.created/updated (shape B)
  )?.toLowerCase();
};

// ======================================================
// HELPER: Map slug → DB plan string
// ======================================================
const getPlanFromSlug = (slug: string | undefined): string | undefined => {
  if (!slug) return undefined;
  if (slug.includes("premium")) return "PREMIUM";
  if (slug.includes("pro")) return "PRO";
  return undefined;
};

const clerkWebhooks = async (req: Request, res: Response) => {
  try {
    const evt: any = await verifyWebhook(req);
    const { data, type } = evt;

    console.log("EVENT TYPE:", type);
    console.log("EVENT DATA:", JSON.stringify(data, null, 2)); // Log full payload for debugging

    switch (type) {

      // ======================================================
      // USER CREATED
      // ======================================================
      case "user.created": {
        await prisma.user.create({
          data: {
            clerkId: data.id,
            email: data?.email_addresses?.[0]?.email_address,
            name: `${data?.first_name || ""} ${data?.last_name || ""}`,
            image: data?.image_url,
            plan: "FREE",
            usedCredits: 0,
          },
        });

        console.log("User created in DB");
        break;
      }

      // ======================================================
      // USER UPDATED
      // ======================================================
      case "user.updated": {
        await prisma.user.update({
          where: { clerkId: data.id },
          data: {
            email: data?.email_addresses?.[0]?.email_address,
            name: `${data?.first_name || ""} ${data?.last_name || ""}`,
            image: data?.image_url,
          },
        });

        console.log("User updated in DB");
        break;
      }

      // ======================================================
      // USER DELETED
      // ======================================================
      case "user.deleted": {
        await prisma.user.delete({
          where: { clerkId: data.id },
        });

        console.log("User deleted from DB");
        break;
      }

      // ======================================================
      // SUBSCRIPTION CREATED / UPDATED
      // Handles: free trials, upgrades, downgrades
      // ======================================================
      case "subscription.created":
      case "subscription.updated": {
        const clerkUserId = data?.user_id;
        const planSlug = extractPlanSlug(data);

        console.log("Subscription Plan Slug:", planSlug);
        console.log("Subscription User ID:", clerkUserId);

        const newPlan = getPlanFromSlug(planSlug);

        // Handle cancellation / downgrade to FREE
        // If no plan found but subscription exists, check if it's a cancellation
        const status = data?.status;
        if (status === "canceled" || status === "cancelled") {
          if (!clerkUserId) break;
          await prisma.user.update({
            where: { clerkId: clerkUserId },
            data: { plan: "FREE", usedCredits: 0 },
          });
          console.log("Subscription cancelled → plan set to FREE");
          break;
        }

        if (!clerkUserId || !newPlan) {
          console.log("Subscription: could not determine plan, skipping. Slug was:", planSlug);
          break;
        }

        await prisma.user.update({
          where: { clerkId: clerkUserId },
          data: { plan: newPlan, usedCredits: 0 },
        });

        console.log("Subscription plan updated to:", newPlan);
        break;
      }

      // ======================================================
      // PAYMENT ATTEMPT UPDATED
      // Handles: real payments (Premium), and paid downgrades
      // ======================================================
      case "paymentAttempt.updated": {
        console.log("Payment Status:", data?.status);

        if (data?.status !== "paid") {
          console.log("Payment not completed, skipping");
          break;
        }

        // Try multiple locations Clerk uses for userId
        const clerkUserId =
          data?.payer?.user_id ||
          data?.user_id ||
          data?.subscription?.user_id;

        // Try multiple locations Clerk uses for plan slug (varies by upgrade vs downgrade)
        const planSlug = extractPlanSlug(data);

        console.log("Payment Plan Slug:", planSlug);
        console.log("Payment User ID:", clerkUserId);

        const newPlan = getPlanFromSlug(planSlug);

        if (!clerkUserId || !newPlan) {
          console.log("Payment: could not determine plan, skipping. Slug was:", planSlug);
          break;
        }

        await prisma.user.update({
          where: { clerkId: clerkUserId },
          data: { plan: newPlan, usedCredits: 0 },
        });

        console.log("Payment plan updated to:", newPlan);
        break;
      }

      default:
        break;
    }

    res.json({ message: "Webhook Received: " + type });

  } catch (error: any) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};

export default clerkWebhooks;