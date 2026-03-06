import { Link, useNavigate } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { GhostButton, PrimaryButton } from "./Buttons"
import { useState } from "react"
import { motion } from "framer-motion"
import { assets } from "../assets/assets"
import { useClerk, useUser, UserButton } from "@clerk/clerk-react"
import { Sparkles, FolderEdit, GalleryHorizontal, DollarSign } from "lucide-react"
import { useCredits } from "./CreditsContext"

export default function Navbar() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { openSignIn, openSignUp } = useClerk()
  const { credits } = useCredits()
  const [isOpen, setIsOpen] = useState(false)

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Create", href: "/generate" },
    { name: "Community", href: "/community" },
    { name: "Plans", href: "/plans" },
  ]

  return (
    <motion.nav
      className="fixed top-5 left-0 right-0 z-50 px-4"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 250, damping: 70 }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-3">

        <Link to="/">
          <img src={assets.logo} alt="logo" className="h-8" />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          {navLinks.map((link) => (
            <Link key={link.name} to={link.href} className="hover:text-white transition">
              {link.name}
            </Link>
          ))}
        </div>

        {!user ? (
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => openSignIn()} className="text-sm text-gray-300 hover:text-white transition">
              Sign in
            </button>
            <PrimaryButton onClick={() => openSignUp()}>Get Started</PrimaryButton>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <GhostButton onClick={() => navigate("/plans")} className="border-none text-gray-300 sm:py-1.5">
              Credits: {credits}
            </GhostButton>

            <UserButton afterSignOutUrl="/">
              <UserButton.MenuItems>
                <UserButton.Action label="Generate" labelIcon={<Sparkles size={14} />} onClick={() => navigate("/generate")} />
                <UserButton.Action label="My Generations" labelIcon={<FolderEdit size={14} />} onClick={() => navigate("/my-generations")} />
                <UserButton.Action label="Community" labelIcon={<GalleryHorizontal size={14} />} onClick={() => navigate("/community")} />
                <UserButton.Action label="Plans" labelIcon={<DollarSign size={14} />} onClick={() => navigate("/plans")} />
              </UserButton.MenuItems>
            </UserButton>
          </div>
        )}

        {!user && (
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden">
            <Menu className="size-6 text-white" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 text-lg z-50">
          {navLinks.map((link) => (
            <Link key={link.name} to={link.href} onClick={() => setIsOpen(false)}>
              {link.name}
            </Link>
          ))}
          <button onClick={() => { setIsOpen(false); openSignIn() }}>Sign in</button>
          <PrimaryButton onClick={() => { setIsOpen(false); openSignUp() }}>Get Started</PrimaryButton>
          <button onClick={() => setIsOpen(false)} className="p-2 bg-white text-black rounded-md">
            <X />
          </button>
        </div>
      )}
    </motion.nav>
  )
}