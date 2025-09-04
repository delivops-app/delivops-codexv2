import Link from "next/link"

export default function Home() {
  return (
    <main className="flex h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Delivops</h1>
        <Link
          href="/api/auth/login"
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Se connecter
        </Link>
      </div>
    </main>
  )
}
