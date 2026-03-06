import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import type { Project } from "../Types"
import { useAuth, useUser } from "@clerk/clerk-react"
import api from "../configs/axios"
import toast from "react-hot-toast"

import {
  Loader2Icon,
  RefreshCwIcon,
  ImageIcon,
  VideoIcon,
  SparklesIcon,
} from "lucide-react"

import { PrimaryButton, GhostButton } from "../components/Buttons"

const Result = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { user, isLoaded } = useUser()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  // ===============================
  // Fetch Project
  // ===============================
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return

    try {
      const token = await getToken()

      const response = await api.get<Project>(`/api/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const projectData = response.data

      setProject(projectData)
      setIsGenerating(projectData.isGenerating ?? false)
      setLoading(false)

    } catch (error: unknown) {

      const err = error as {
        response?: { data?: { message?: string } }
        message?: string
      }

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch project"
      )
    }
  }, [projectId, getToken])

  // ===============================
  // Generate Video
  // ===============================
  const handleGenerateVideo = async () => {
    if (!projectId) return

    try {
      setIsGeneratingVideo(true)

      const token = await getToken()

      const response = await api.post(
        "/api/project/video",
        { projectId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const videoUrl: string = response.data.videoUrl

      setProject(prev => {
        if (!prev) return prev

        return {
          ...prev,
          generatedVideo: videoUrl,
          isGenerating: false,
        }
      })

      toast.success(response.data.message)

    } catch (error: unknown) {

      const err = error as {
        response?: { data?: { message?: string } }
        message?: string
      }

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Video generation failed"
      )

    } finally {
      setIsGeneratingVideo(false)
    }
  }

  // ===============================
  // Initial Load
  // ===============================
  useEffect(() => {

    if (user && !project) {
      fetchProjectData()
    }

    if (isLoaded && !user) {
      navigate("/")
    }

  }, [user, isLoaded, project, navigate, fetchProjectData])

  // ===============================
  // Polling while generating
  // ===============================
  useEffect(() => {

    if (!user || !isGenerating) return

    const interval = setInterval(fetchProjectData, 10000)

    return () => clearInterval(interval)

  }, [user, isGenerating, fetchProjectData])

  // ===============================
  // Loading Screen
  // ===============================
  if (loading || !project) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2Icon className="animate-spin text-indigo-500 size-9" />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white p-6 md:p-12 mt-20">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex justify-between items-center mb-10">

          <h1 className="text-2xl md:text-3xl font-semibold">
            Generation Result
          </h1>

          <Link
            to="/generate"
            className="flex items-center gap-2 text-sm bg-white/10 px-4 py-2 rounded-md hover:bg-white/20 transition"
          >
            <RefreshCwIcon className="w-4 h-4" />
            New Generation
          </Link>

        </header>

        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT */}
          <div className="lg:col-span-2 flex justify-center">

            <div className="w-full max-w-md">

              <div className="bg-white/5 border border-white/10 rounded-2xl p-2">

                <div
                  className={`${
                    project.aspectRatio === "9:16"
                      ? "aspect-9/16"
                      : "aspect-video"
                  } bg-gray-900 rounded-xl overflow-hidden`}
                >

                  {project.generatedVideo ? (

                    <video
                      src={project.generatedVideo}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-cover"
                    />

                  ) : project.generatedImage ? (

                    <img
                      src={project.generatedImage}
                      alt="Generated"
                      className="w-full h-full object-cover"
                    />

                  ) : (

                    <div className="flex items-center justify-center h-full">
                      <Loader2Icon className="animate-spin size-6" />
                    </div>

                  )}

                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">

            {/* Download */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">

              <h3 className="text-lg font-semibold mb-4">Download</h3>

              <div className="flex flex-col gap-3">

                {project.generatedImage && (
                  <a href={project.generatedImage} download>
                    <GhostButton className="w-full justify-center py-3">
                      <ImageIcon className="size-4 mr-2" />
                      Download Image
                    </GhostButton>
                  </a>
                )}

                {project.generatedVideo && (
                  <a href={project.generatedVideo} download>
                    <GhostButton className="w-full justify-center py-3">
                      <VideoIcon className="size-4 mr-2" />
                      Download Video
                    </GhostButton>
                  </a>
                )}

              </div>

            </div>

            {/* Video Generator */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">

              <h3 className="text-lg font-semibold mb-2">Video Magic</h3>

              <p className="text-gray-400 text-sm mb-6">
                Turn this static image into a dynamic video.
              </p>

              {!project.generatedVideo && (

                <PrimaryButton
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                  className="w-full"
                >

                  {isGeneratingVideo ? (
                    <>
                      <Loader2Icon className="animate-spin size-4 mr-2" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="size-4 mr-2" />
                      Generate Video
                    </>
                  )}

                </PrimaryButton>

              )}

              {project.generatedVideo && (

                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-center text-sm font-medium">

                  Video Generated Successfully!

                </div>

              )}

            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

export default Result