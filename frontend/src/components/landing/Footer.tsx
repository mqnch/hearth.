export default function Footer() {
  return (
    <footer className="bg-[#F0F7FF] border-t border-[#6BA3E8] py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:justify-between">
          <p className="text-base text-[#2C5F8D]">
            © {new Date().getFullYear()} ForeverHome. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-base text-[#2C5F8D] hover:text-[#1E3A5F] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-base text-[#2C5F8D] hover:text-[#1E3A5F] transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
