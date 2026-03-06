import Title from './Title'
import { PricingTable, useAuth } from '@clerk/clerk-react'
import { useCredits } from './CreditsContext'
import axios from 'axios'

export default function Pricing() {
    const { getToken } = useAuth()
    const { credits, refetchCredits } = useCredits()

    const pollUntilCreditsChange = async (oldCredits: number) => {
        const maxAttempts = 10
        let attempts = 0

        const poll = async () => {
            attempts++
            try {
                const token = await getToken()
                const { data } = await axios.get(
                    `${import.meta.env.VITE_BACKEND_URL}/api/user/credits`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                if (data.credits !== oldCredits) {
                    refetchCredits()
                    return
                }
                if (attempts < maxAttempts) setTimeout(poll, 1000)
                else refetchCredits()
            } catch (err) {
                console.error("Poll error:", err)
            }
        }

        poll()
    }

    const handlePlanAreaClick = () => {
        setTimeout(() => pollUntilCreditsChange(credits), 2000)
    }

    return (
        <section id="pricing" className="py-20 bg-white/3 border-t border-white/6">
            <div className="max-w-6xl mx-auto px-4">
                <Title
                    title="Pricing"
                    heading="Pricing Plans"
                    description="Our Pricing Plans are simple,transparent and flexible.Choose the plan that best suits your needs"
                />
                <div
                    className="flex flex-wrap items-center justify-center max-w-5x1 mx-auto"
                    onClick={handlePlanAreaClick}
                >
                    <PricingTable
                        appearance={{
                            variables: { colorBackground: 'none' },
                            elements: {
                                pricingTableCardBody: 'bg-white/6',
                                pricingTableCardHeader: 'bg-white/10',
                                switchThumb: 'bg-white'
                            }
                        }}
                    />
                </div>
            </div>
        </section>
    )
}