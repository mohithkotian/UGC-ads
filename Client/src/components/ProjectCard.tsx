import { useState } from "react"
import type { Project } from "../Types"
import { useNavigate } from "react-router-dom"
import {
  EllipsisIcon,
  ImageIcon,
  Loader2Icon,
  Share2Icon,
  Trash2Icon,
  PlaySquareIcon,
} from "lucide-react"
import { GhostButton, PrimaryButton } from "./Buttons"
import { useAuth } from "@clerk/clerk-react"
import api from "../configs/axios"
import toast from "react-hot-toast"

interface ProjectCardProps {
  gen: Project
  setGenerations: React.Dispatch<React.SetStateAction<Project[]>>
  forCommunity?: boolean
}

const ProjectCard = ({
  gen,
  setGenerations,
  forCommunity = false,
}: ProjectCardProps) => {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this project?")
    if (!confirmDelete) return

    try {
      const token = await getToken()
      const { data } = await api.delete(`/api/project/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setGenerations((generations) => generations.filter((gen) => gen.id !== id))
      toast.success(data.message)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
      console.log(error)
    }
  }

  const togglePublish = async (projectId: string) => {
    try {
      const token = await getToken()
      const { data } = await api.get(`/api/user/publish/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setGenerations((generations) =>
        generations.map((gen) =>
          gen.id === projectId ? { ...gen, isPublished: data.isPublished } : gen
        )
      )
      toast.success(data.isPublished ? "Project published" : "Project unpublished")
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
      console.log(error)
    }
  }

  return (
    <div className="mb-4 break-inside-avoid">
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition group relative">

        {/* Preview */}
        <div
          className={`${
            gen?.aspectRatio === "9:16"
              ? "aspect-[9/16]"
              : gen?.aspectRatio === "1:1"
              ? "aspect-square"
              : "aspect-video"
          } relative overflow-hidden`}
        >
          {gen.generatedImage && (
            <img
              src={gen.generatedImage}
              alt={gen.productName}
              className={`absolute inset-0 w-full h-full object-cover transition duration-500 ${
                gen.generatedVideo
                  ? "group-hover:opacity-0"
                  : "group-hover:scale-105"
              }`}
            />
          )}

          {gen.generatedVideo && (
            <video
              src={gen.generatedVideo}
              muted
              loop
              playsInline
              autoPlay
              disablePictureInPicture
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition duration-500"
            />
          )}

          {!gen.generatedImage && !gen.generatedVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Loader2Icon className="size-7 animate-spin text-white" />
            </div>
          )}

          {/* Status badges */}
          <div className="absolute left-3 top-3 flex gap-2">
            {gen.isGenerating && (
              <span className="text-xs px-2 py-1 bg-yellow-600/30 text-yellow-300 rounded-full">
                Generating
              </span>
            )}
            {gen.isPublished && (
              <span className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded-full">
                Published
              </span>
            )}
          </div>

          {/* Action Menu */}
          {!forCommunity && (
            <div
              onMouseEnter={() => setMenuOpen(true)}
              onMouseLeave={() => setMenuOpen(false)}
              className="absolute right-3 top-3"
            >
              <EllipsisIcon className="bg-black/30 rounded-full p-1 size-7 cursor-pointer" />

              <ul
                className={`absolute right-0 mt-2 w-44 text-xs bg-black/80 backdrop-blur border border-gray-500/50 rounded-lg shadow-md py-1 z-10 ${
                  menuOpen ? "block" : "hidden"
                }`}
              >
                {gen.generatedImage && (
                  <a
                    href={gen.generatedImage}
                    download
                    className="flex gap-2 items-center px-4 py-2 hover:bg-black/20 cursor-pointer"
                  >
                    <ImageIcon size={14} />
                    Download Image
                  </a>
                )}

                {gen.generatedVideo && (
                  <a
                    href={gen.generatedVideo}
                    download
                    className="flex gap-2 items-center px-4 py-2 hover:bg-black/20 cursor-pointer"
                  >
                    <PlaySquareIcon size={14} />
                    Download Video
                  </a>
                )}

                {(gen.generatedVideo || gen.generatedImage) && (
                  <button
                    onClick={() =>
                      navigator.share?.({
                        url: gen.generatedVideo || gen.generatedImage,
                        title: gen.productName,
                        text: gen.productDescription,
                      })
                    }
                    className="flex gap-2 items-center px-4 py-2 hover:bg-black/20 cursor-pointer w-full text-left"
                  >
                    <Share2Icon size={14} />
                    Share
                  </button>
                )}

                <button
                  onClick={() => handleDelete(gen.id)}
                  className="flex gap-2 items-center px-4 py-2 hover:bg-red-950/20 text-red-400 cursor-pointer w-full text-left"
                >
                  <Trash2Icon size={14} />
                  Delete
                </button>
              </ul>
            </div>
          )}

          {/* Uploaded preview images */}
          {gen.uploadedImages && gen.uploadedImages.length >= 2 && (
            <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition duration-500">
              <img
                src={gen.uploadedImages[0]}
                alt="product"
                className="w-14 h-14 object-cover rounded-full border border-white/20 shadow-lg"
              />
              <img
                src={gen.uploadedImages[1]}
                alt="model"
                className="w-14 h-14 object-cover rounded-full -mt-6 ml-8 border border-white/20 shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">{gen.productName}</h3>
              {gen.createdAt && (
                <p className="text-sm text-gray-400 mt-1">
                  Created: {new Date(gen.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {gen.aspectRatio && (
              <span className="text-xs px-3 py-1 bg-white/10 text-gray-300 rounded-full">
                Aspect: {gen.aspectRatio}
              </span>
            )}
          </div>

          {gen.updatedAt && (
            <p className="text-xs text-gray-500 mt-2">
              Updated: {new Date(gen.updatedAt).toLocaleDateString()}
            </p>
          )}

          {gen.productDescription && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <div className="text-sm text-gray-300">{gen.productDescription}</div>
            </div>
          )}

          {gen.userPrompt && (
            <div className="mt-3">
              <div className="text-sm text-gray-300">{gen.userPrompt}</div>
            </div>
          )}

          {!forCommunity && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <GhostButton
                className="text-xs justify-center"
                onClick={() => { navigate(`/result/${gen.id}`); scrollTo(0, 0) }}
              >
                View Details
              </GhostButton>
              <PrimaryButton
                onClick={() => togglePublish(gen.id)}
                className="rounded-md"
              >
                {gen.isPublished ? "Unpublish" : "Publish"}
              </PrimaryButton>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default ProjectCard