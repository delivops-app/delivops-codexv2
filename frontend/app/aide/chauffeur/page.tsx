import Link from 'next/link'

const steps = [
  {
    title: 'Connexion',
    description:
      "Identifiez-vous avec votre compte chauffeur en utilisant le bouton « Se connecter » sur la page d’accueil.",
  },
  {
    title: 'Récupérer une tournée',
    description:
      "Depuis l’espace chauffeur, cliquez sur « Je récupère une tournée » pour accéder aux tournées disponibles et les accepter.",
  },
  {
    title: 'Consulter les détails',
    description:
      "Ouvrez la tournée assignée pour consulter les points de livraison, les horaires et les instructions spécifiques.",
  },
  {
    title: 'Suivre la tournée',
    description:
      "Effectuez les livraisons en respectant l’ordre indiqué et mettez à jour le statut de chaque étape si nécessaire.",
  },
  {
    title: 'Clôturer la tournée',
    description:
      "À la fin du parcours, choisissez « Je clôture une tournée » pour confirmer la finalisation et remonter les informations à l’équipe.",
  },
]

export default function DriverHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Guide chauffeur Delivops</h1>
      <p>
        Ce guide détaille les étapes essentielles pour assurer vos livraisons avec Delivops en toute simplicité.
      </p>
      <ol className="list-decimal space-y-4 pl-6">
        {steps.map((step) => (
          <li key={step.title}>
            <h2 className="text-xl font-semibold">{step.title}</h2>
            <p className="text-justify text-base text-gray-700">{step.description}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/"
        className="self-start rounded bg-blue-600 px-4 py-2 text-white"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
