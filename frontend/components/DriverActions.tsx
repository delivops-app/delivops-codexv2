'use client'

import Link from 'next/link'

export default function DriverActions() {
  return (
    <section className="mt-4 flex flex-col items-center">
      <Link
        href="/recuperer"
        className="rounded bg-blue-600 px-4 py-2 text-white"
      >
        Je récupère une tournée
      </Link>
      <Link
        href="/cloturer"
        className="mt-2 rounded bg-purple-600 px-4 py-2 text-white"
      >
        Je clôture une tournée
      </Link>
    </section>
  )
}
