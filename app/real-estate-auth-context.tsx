"use client";
import {createContext,useContext,type ReactNode} from "react";

const RealEstateAccessTokenContext=createContext("");

export function RealEstateAuthProvider({accessToken,children}:{accessToken:string;children:ReactNode}){
 return <RealEstateAccessTokenContext.Provider value={accessToken}>{children}</RealEstateAccessTokenContext.Provider>;
}

export function useRealEstateAccessToken(){return useContext(RealEstateAccessTokenContext)}
