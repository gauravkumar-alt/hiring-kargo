"use client";

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { Flip } from "gsap/Flip";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, Flip, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase);

// One house curve so every motion in the app feels related: fast out, long soft settle.
CustomEase.create("kargo", "M0,0 C0.16,1 0.3,1 1,1");
gsap.defaults({ ease: "kargo", duration: 0.6 });

if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.globalTimeline.timeScale(50);
}

// Dev only: lets the browser console (and testing tools) inspect and drive animations.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as { gsap: typeof gsap }).gsap = gsap;
}

export { gsap, Flip, ScrollTrigger, SplitText, useGSAP };
