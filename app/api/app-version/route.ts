import packageJson from "../../../package.json";

export const dynamic="force-dynamic";
export async function GET(){
 const version=process.env.NEXT_PUBLIC_BUILD_COMMIT||process.env.AWS_COMMIT_ID||"unknown";
 return Response.json({version,commit:version,builtAt:process.env.NEXT_PUBLIC_BUILD_TIME||null,release:packageJson.version},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
