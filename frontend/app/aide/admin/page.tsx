import Link from 'next/link'

const steps = [
  {
    title: 'Connexion',
    description:
      "Connectez-vous avec votre compte administrateur via le bouton « Se connecter » sur la page d’accueil.",
  },
  {
    title: 'Ajouter un chauffeur',
    description:
      "Depuis le tableau de bord, cliquez sur « Ajouter un chauffeur » pour ouvrir le formulaire d’invitation et envoyer une invitation par email.",
  },
  {
    title: 'Consulter les chauffeurs',
    description:
      "Accédez à la liste complète des chauffeurs via « Liste des chauffeurs » pour suivre leur statut et leurs informations.",
  },
  {
    title: 'Analyser la synthèse',
    description:
      "Ouvrez « Synthèse des chauffeurs » pour obtenir un aperçu des performances et des tournées clôturées.",
  },
  {
    title: 'Gérer les clients',
    description:
      "Utilisez le gestionnaire de clients pour ajouter, modifier ou désactiver des comptes clients selon les besoins de l’activité.",
  },
]

export default function AdminHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Guide administrateur Delivops</h1>
      <p>
        Ce guide présente les principales actions à réaliser pour piloter la plateforme
        Delivops en tant qu’administrateur.
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
