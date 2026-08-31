"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/portfolio");
  }, [router]);

  return (
    <div className="p-8 text-center text-gray-500 font-medium font-['Jost']">
      Redirecting to portfolio…
    </div>
  );
}
