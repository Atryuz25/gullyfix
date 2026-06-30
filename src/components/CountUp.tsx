"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface CountUpProps {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CountUp({ value, duration = 1.5, delay = 0, className, style }: CountUpProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  
  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut", delay });
    return controls.stop;
  }, [value, count, duration, delay]);
  
  return <motion.span className={className} style={style}>{rounded}</motion.span>;
}
