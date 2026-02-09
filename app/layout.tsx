import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analizzatore Pianto Bebè',
  description: 'Analizza il pianto del tuo bambino usando l\'intelligenza artificiale',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#FFFFFF', color: '#1F2937' }}>
        {children}
      </body>
    </html>
  )
}
