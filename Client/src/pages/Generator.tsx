import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

import Title from "../components/Title"
import UploadZone from "../components/UploadZone"
import { PrimaryButton } from "../components/Buttons"
import { Loader2Icon, Wand2Icon } from "lucide-react"
import { useAuth, useUser } from "@clerk/clerk-react"
import api from "../configs/axios"

const Generator = () => {

  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [aspectRatio, setAspectRatio] = useState("9:16")
  const [productImage, setProductImage] = useState<File | null>(null)
  const [modelImage, setModelImage] = useState<File | null>(null)
  const [userPrompt, setUserPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "product" | "model"
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (type === "product") setProductImage(file)
      else setModelImage(file)
    }
  }

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!user) return toast("Please login to generate")

    if (!productImage || !modelImage || !name || !productName || !aspectRatio)
      return toast("Please fill all the required fields")

    try {
      setIsGenerating(true)

      const token = await getToken()

      const formData = new FormData()
      formData.append("name", name)
      formData.append("productName", productName)
      formData.append("productDescription", productDescription)
      formData.append("aspectRatio", aspectRatio)
      formData.append("userPrompt", userPrompt)
      formData.append("images", productImage)
      formData.append("images", modelImage)

      const { data } = await api.post("/api/project/create", formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      toast.success(data.message)
      navigate("/result/" + data.projectId)

    } catch (error: unknown) {
  setIsGenerating(false)
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  toast.error(err?.response?.data?.message || err.message || "Something went wrong")
}
  }

  return (
    <div className="min-h-screen text-white p-6 md:p-12 mt-28">
      <form onSubmit={handleGenerate} className="max-w-5xl mx-auto">
        <Title
          heading="Create In-Context Image"
          description="Upload your model and product images to generate stunning UGC short-form videos"
        />

        <div className="flex gap-20 max-sm:flex-col items-start justify-between mt-12">

          {/* LEFT COLUMN */}
          <div className="flex flex-col w-full sm:max-w-60 gap-8">
            <UploadZone
              label="Product Image"
              file={productImage}
              onClear={() => setProductImage(null)}
              onChange={(e) => handleFileChange(e, "product")}
            />
            <UploadZone
              label="Model Image"
              file={modelImage}
              onClear={() => setModelImage(null)}
              onChange={(e) => handleFileChange(e, "model")}
            />
          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full">

            <div className="mb-4 text-gray-300">
              <label className="block text-sm mb-4">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your project"
                required
                className="w-full bg-white/5 rounded-lg border-2 p-4 text-sm border-violet-200/10 focus:border-violet-500/50 outline-none transition-all"
              />
            </div>

            <div className="mb-4 text-gray-300">
              <label className="block text-sm mb-4">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter the name of the product"
                required
                className="w-full bg-white/5 rounded-lg border-2 p-4 text-sm border-violet-200/10 focus:border-violet-500/50 outline-none transition-all"
              />
            </div>

            <div className="mb-4 text-gray-300">
              <label className="block text-sm mb-4">Product Description</label>
              <textarea
                rows={4}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Enter the description"
                className="w-full bg-white/5 rounded-lg border-2 p-4 text-sm border-violet-200/10 focus:border-violet-500/50 outline-none resize-none transition-all"
              />
            </div>

            <div className="mb-4 text-gray-300">
              <label className="block text-sm mb-4">Aspect Ratio</label>
              <div className="flex gap-3">
                {["9:16", "1:1", "16:9"].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`p-2.5 bg-white/6 rounded ring-2 ${
                      aspectRatio === ratio
                        ? "ring-violet-500/50 bg-white/10"
                        : "ring-transparent"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 text-gray-300">
              <label className="block text-sm mb-4">User Prompt</label>
              <textarea
                rows={4}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Describe the vibe of the video"
                className="w-full bg-white/5 rounded-lg border-2 p-4 text-sm border-violet-200/10 focus:border-violet-500/50 outline-none resize-none transition-all"
              />
            </div>

          </div>
        </div>

        <div className="flex justify-center mt-10">
          <PrimaryButton
            disabled={isGenerating}
            className="px-10 py-3 rounded-md disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2Icon className="size-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2Icon className="size-5" />
                Generate
              </>
            )}
          </PrimaryButton>
        </div>

      </form>
    </div>
  )
}

export default Generator