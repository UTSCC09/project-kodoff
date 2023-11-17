import './globals.css'

export const metadata = {
  title: 'Next.js',
  description: 'Generated by Next.js',
}

export default function RootLayout({ children }) {
 return (
    <html lang="en">
      <head>
      <link href='https://fonts.googleapis.com/css?family=Josefin Sans:wght@400;500;600;700' rel='stylesheet'></link>
      </head>
      <body>{children}</body>
    </html>
  )
}
