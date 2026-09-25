import {NextResponse,type NextRequest} from 'next/server';
export function middleware(request:NextRequest){
 const referenceId=crypto.randomUUID(),headers=new Headers(request.headers);
 headers.set('x-request-id',referenceId);
 const response=NextResponse.next({request:{headers}});
 response.headers.set('x-request-id',referenceId);
 return response;
}
export const config={matcher:'/api/:path*'};
