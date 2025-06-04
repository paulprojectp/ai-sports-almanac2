import './env.js';
export const metadata = {
  title: 'AI Sports Almanac',
  description: 'AI-powered sports predictions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
