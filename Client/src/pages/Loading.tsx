import { Loader2Icon } from "lucide-react"
import { useEffect } from "react"

const Loading = () => {

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "/"
    }, 6000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="h-screen flex flex-col">
      
      <div className="flex flex-1 items-center justify-center">
        <Loader2Icon className="size-7 animate-spin text-indigo-200" />
      </div>

    </div>
  )
}

export default Loading