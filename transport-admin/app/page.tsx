"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "./components/LoadingScreen";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // O administrador tem sessão?
    const adminData = localStorage.getItem("admin");
    
    if (adminData) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  return <LoadingScreen layout="viewport" tone="dark" />;
}
