import NotificationEventCenter from "@/app/notification-event-center";
export default async function Page({params}:{params:Promise<{eventId:string}>}){const {eventId}=await params;return <NotificationEventCenter eventId={eventId}/>;}
