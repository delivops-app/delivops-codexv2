import './globals.css'
import { ReactNode } from 'react'
import { UserProvider } from '@auth0/nextjs-auth0/client'

import { BillingBanner } from '../components/BillingBanner'
import { BillingContent, BillingProvider } from '../components/BillingProvider'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <UserProvider>
          <BillingProvider>
            <BillingBanner />
            <BillingContent>{children}</BillingContent>
          </BillingProvider>
        </UserProvider>
      </body>
    </html>
  )
}
