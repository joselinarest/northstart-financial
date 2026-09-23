import {runNotificationWorker} from "@/lib/notification-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){return runNotificationWorker(request);}
