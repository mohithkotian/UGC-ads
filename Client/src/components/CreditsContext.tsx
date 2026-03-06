import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { useUser, useAuth } from "@clerk/clerk-react"
import api from "../configs/axios"

interface CreditsContextType {
  credits: number
  refetchCredits: () => void
}

export const CreditsContext = createContext<CreditsContextType>({
  credits: 0,
  refetchCredits: () => {},
})

export const useCredits = () => useContext(CreditsContext)

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [credits, setCredits] = useState<number>(0)

  const fetchCredits = useCallback(async () => {
    if (!user) return
    try {
      const token = await getToken()
      const { data } = await api.get("/api/user/credits", {
        headers: { Authorization: `Bearer ${token}` },
      })
      setCredits(data.credits)
    } catch (error) {
      console.error("Failed to fetch credits:", error)
    }
  }, [user, getToken])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  return (
    <CreditsContext.Provider value={{ credits, refetchCredits: fetchCredits }}>
      {children}
    </CreditsContext.Provider>
  )
}