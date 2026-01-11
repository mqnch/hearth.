"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <motion.footer 
      className="bg-[#FFF8E7] border-t border-[#D4A574] py-8 px-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:justify-between">
          <p className="text-base text-[#B8860B]">
            © {new Date().getFullYear()} hearth. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-base text-[#B8860B] hover:text-[#5C4033] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-base text-[#B8860B] hover:text-[#5C4033] transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
