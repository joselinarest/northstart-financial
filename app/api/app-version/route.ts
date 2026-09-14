import packageJson from "../../../package.json";

export const dynamic="force-dynamic";
export async function GET(){
 const version=process.env.AWS_COMMIT_ID||process.env.NEXT_PUBLIC_APP_VERSION||packageJson.version;
 return Response.json({version},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
