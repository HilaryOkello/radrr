"use client";

import { useState, useEffect } from "react";
import { reverseGeocode } from "@/lib/geocode";

export function useLocationName(gpsApprox: string | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!gpsApprox || gpsApprox === "unknown" || gpsApprox === "unavailable") return;
    reverseGeocode(gpsApprox).then(setName);
  }, [gpsApprox]);
  return name;
}
